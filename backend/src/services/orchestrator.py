"""Async producer-consumer orchestrator for continuous verification & repair.

    Phase 1 (plan)        scenario_queue -> verify_queue
    Phase 2 (verify)      verify_queue     -> eval_queue
    Phase 3 (evaluate)    eval_queue       -> remediation_queue (if critical)
    Phase 4 (repair)      remediation_queue -> HITL PR + optional re-validation
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from src.config import Settings
from src.core.embeddings import EmbeddingProvider
from src.core.models import (
    AuditRequest,
    AuditState,
    AuditStatus,
    Finding,
    FuzzSession,
    FuzzTask,
    RemediationResult,
    RemediationTask,
    ScenarioTask,
    VerificationMode,
    VerificationResult,
    VerificationSession,
    VerificationSessionStatus,
    VerificationStepLog,
    VerificationStepStatus,
    _new_id,
)
from src.demos.fixtures import PRIVATE_CORPUS, SEED_PAYLOADS
from src.repositories.vector_repo import VectorRepository
from src.scenarios.base import describe_browser_step
from src.scenarios.registry import get_scenario, resolve_technique_ids
from src.services.eval_service import EvalService
from src.services.fuzzer_service import AdversarialFuzzer, OptimizationResult
from src.services.minimax_client import build_minimax_client
from src.services.repair_validation import RepairValidationService
from src.services.scenario_mutation import ScenarioMutationService
from src.services.verification_service import VerificationService
from src.workers.eval_worker import eval_worker
from src.workers.fuzz_worker import fuzz_worker
from src.workers.offensive_worker import TargetExecutor, offensive_worker
from src.workers.patch_worker import RemediationRunner, patch_worker
from src.workers.scenario_plan_worker import scenario_plan_worker
from src.workers.verification_worker import VerificationRunner, verification_worker

logger = logging.getLogger(__name__)


class Orchestrator:
    """Owns queues, services, worker tasks, and the in-memory audit store."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._embeddings = EmbeddingProvider(settings)

        minimax = build_minimax_client(settings)
        self._vector_repo = VectorRepository(settings)
        self._minimax = minimax
        self._eval_service: EvalService | None = None
        self._verification_service: VerificationService | None = None
        self._mutation = ScenarioMutationService(settings, self._vector_repo)
        self._fuzzer = AdversarialFuzzer(settings, self._embeddings)
        self._target_executor = TargetExecutor(settings, list(PRIVATE_CORPUS))
        self._verification_runner = VerificationRunner(settings)
        self._runner = RemediationRunner(settings)
        self._repair_validation = RepairValidationService()

        self.scenario_queue: asyncio.Queue = asyncio.Queue()
        self.verify_queue: asyncio.Queue = asyncio.Queue()
        self.fuzz_queue: asyncio.Queue = asyncio.Queue()
        self.attack_queue: asyncio.Queue = asyncio.Queue()
        self.eval_queue: asyncio.Queue = asyncio.Queue()
        self.remediation_queue: asyncio.Queue = asyncio.Queue()
        self._semaphore = asyncio.Semaphore(settings.max_concurrent_sessions)
        self._shutdown = asyncio.Event()

        self._audits: dict[str, AuditState] = {}
        self._audit_meta: dict[str, dict] = {}
        self._tasks: list[asyncio.Task] = []

    async def start(self) -> None:
        await self._initialize_scoring_services()
        await self._warm_redis_memory()
        for _ in range(self._settings.scenario_workers):
            self._tasks.append(asyncio.create_task(
                scenario_plan_worker(
                    self.scenario_queue,
                    self.verify_queue,
                    self._mutation,
                    self._shutdown,
                )
            ))
        for _ in range(self._settings.verification_workers):
            self._tasks.append(asyncio.create_task(
                verification_worker(
                    self.verify_queue,
                    self.eval_queue,
                    self._verification_runner,
                    self._semaphore,
                    self._shutdown,
                    self._update_verification_session,
                )
            ))
        for _ in range(self._settings.fuzzer_workers):
            self._tasks.append(asyncio.create_task(
                fuzz_worker(
                    self.fuzz_queue,
                    self.attack_queue,
                    self._fuzzer,
                    self._target_executor,
                    self._semaphore,
                    self._record_fuzz_payload,
                    self._shutdown,
                )
            ))
        for _ in range(self._settings.offensive_workers):
            self._tasks.append(asyncio.create_task(
                offensive_worker(
                    self.attack_queue,
                    self.eval_queue,
                    self._target_executor,
                    self._semaphore,
                    self._shutdown,
                )
            ))
        for _ in range(self._settings.eval_workers):
            self._tasks.append(asyncio.create_task(
                eval_worker(
                    self.eval_queue,
                    self.remediation_queue,
                    self._require_eval_service(),
                    self._require_verification_service(),
                    self._record_finding,
                    self._shutdown,
                )
            ))
        for _ in range(self._settings.remediation_workers):
            self._tasks.append(asyncio.create_task(
                patch_worker(
                    self.remediation_queue,
                    self._runner,
                    self._record_remediation,
                    self._shutdown,
                )
            ))
        logger.info("Orchestrator started with %d workers", len(self._tasks))

    async def _initialize_scoring_services(self) -> None:
        self._eval_service = await EvalService.create(
            settings=self._settings,
            embeddings=self._embeddings,
            private_corpus=list(PRIVATE_CORPUS),
            minimax=self._minimax,
            vector_repo=self._vector_repo,
        )
        self._verification_service = VerificationService(
            settings=self._settings,
            eval_service=self._eval_service,
            embeddings=self._embeddings,
            vector_repo=self._vector_repo,
        )

    def _require_eval_service(self) -> EvalService:
        if self._eval_service is None:
            raise RuntimeError("EvalService not initialized")
        return self._eval_service

    def _require_verification_service(self) -> VerificationService:
        if self._verification_service is None:
            raise RuntimeError("VerificationService not initialized")
        return self._verification_service

    async def _warm_redis_memory(self) -> None:
        """Seed Redis Stack indexes before workers accept traffic."""
        try:
            dim = await self._embeddings.scoring_dim()
            await self._vector_repo.ensure_index(dim)
            await self._vector_repo.ensure_private_index(dim)
            await self._vector_repo.ensure_evidence_index(dim)
            private_embeddings = await self._embeddings.embed_many_for_scoring(
                list(PRIVATE_CORPUS)
            )
            for i, (doc, embedding) in enumerate(zip(PRIVATE_CORPUS, private_embeddings)):
                await self._vector_repo.index_private_document(
                    str(i), doc, embedding
                )
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis memory warm-up skipped: %s", exc)

    async def stop(self) -> None:
        self._shutdown.set()
        for _ in range(self._settings.scenario_workers):
            await self.scenario_queue.put(None)
        for _ in range(self._settings.verification_workers):
            await self.verify_queue.put(None)
        for _ in range(self._settings.fuzzer_workers):
            await self.fuzz_queue.put(None)
        for _ in range(self._settings.offensive_workers):
            await self.attack_queue.put(None)
        for _ in range(self._settings.eval_workers):
            await self.eval_queue.put(None)
        for _ in range(self._settings.remediation_workers):
            await self.remediation_queue.put(None)
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        await self._vector_repo.close()
        logger.info("Orchestrator stopped")

    async def submit_audit(self, request: AuditRequest) -> AuditState:
        """Launch a verification audit for the requested ATT&CK technique bundle."""
        technique_ids = resolve_technique_ids(
            request.technique_ids or None
        )[: request.max_payloads]

        fuzz_seeds = SEED_PAYLOADS[: request.max_payloads]

        state = AuditState(
            target_name=request.target_name,
            target_endpoint=str(request.target_endpoint),
            source_repository=str(request.source_repository),
            status=AuditStatus.RUNNING,
            queued_payloads=len(technique_ids) + len(fuzz_seeds),
            technique_ids=technique_ids,
            verification_mode=request.verification_mode,
            baseline_run_id=request.baseline_run_id,
        )
        self._audits[state.audit_id] = state
        self._audit_meta[state.audit_id] = {
            "target_name": request.target_name,
            "target_endpoint": str(request.target_endpoint),
            "source_repository": str(request.source_repository),
        }

        for technique_id in technique_ids:
            scenario = get_scenario(technique_id)
            execution_url = str(request.target_endpoint)
            task_id = _new_id()
            state.verification_sessions.append(
                VerificationSession(
                    task_id=task_id,
                    technique_id=technique_id,
                    technique_name=scenario.technique_name,
                    steps=[
                        VerificationStepLog(
                            index=i,
                            action=step.action,
                            label=describe_browser_step(step),
                        )
                        for i, step in enumerate(scenario.browser_steps)
                    ],
                )
            )
            await self.scenario_queue.put(
                ScenarioTask(
                    audit_id=state.audit_id,
                    task_id=task_id,
                    technique_id=technique_id,
                    target_url=str(request.target_endpoint),
                    repo_url=str(request.source_repository),
                    verification_mode=request.verification_mode,
                    baseline_run_id=request.baseline_run_id,
                )
            )

        for seed in fuzz_seeds:
            task_id = _new_id()
            state.fuzz_sessions.append(
                FuzzSession(
                    task_id=task_id,
                    seed=seed,
                    target_url=str(request.target_endpoint),
                )
            )
            await self.fuzz_queue.put(
                FuzzTask(
                    audit_id=state.audit_id,
                    task_id=task_id,
                    target_url=str(request.target_endpoint),
                    repo_url=str(request.source_repository),
                    seed=seed,
                )
            )
        return state

    def get_audit(self, audit_id: str) -> AuditState | None:
        return self._audits.get(audit_id)

    def list_audits(self) -> list[AuditState]:
        return list(self._audits.values())

    @property
    def telemetry_status(self) -> dict[str, bool]:
        return {
            "browserbase_live": self._settings.browserbase_live,
            "verification_live_ready": self._settings.verification_live_ready,
            "minimax_enabled": self._settings.minimax_enabled,
            "redis_available": self._vector_repo.available,
            "redis_vector_search": self._vector_repo.vector_search_available,
            "redis_evidence_search": self._vector_repo.evidence_search_available,
            "remediation_live": self._runner.can_run_live,
            "embeddings_remote": self._embeddings.is_remote,
        }

    async def integration_status(self) -> dict[str, bool]:
        status = self.telemetry_status
        if self._vector_repo.available:
            status = {
                **status,
                "redis_available": await self._vector_repo.ping(),
            }
        return status

    async def _update_verification_session(
        self,
        audit_id: str,
        task_id: str,
        *,
        session_status: VerificationSessionStatus | None = None,
        step_index: int | None = None,
        step_status: VerificationStepStatus | None = None,
        step_detail: str | None = None,
        live: bool | None = None,
        session_id: str | None = None,
        result: VerificationResult | None = None,
    ) -> None:
        audit = self._audits.get(audit_id)
        if audit is None:
            return

        for i, session in enumerate(audit.verification_sessions):
            if session.task_id != task_id:
                continue

            updated = session.model_copy(deep=True)
            now = datetime.now(timezone.utc)
            updated.updated_at = now

            if session_status is not None:
                updated.status = session_status
                if session_status == VerificationSessionStatus.RUNNING and updated.started_at is None:
                    updated.started_at = now

            if live is not None:
                updated.live = live
            if session_id is not None:
                updated.session_id = session_id

            if step_index is not None and 0 <= step_index < len(updated.steps):
                updated.current_step_index = step_index
                step = updated.steps[step_index].model_copy()
                if step_status is not None:
                    step.status = step_status
                if step_detail is not None:
                    step.detail = step_detail[:2000]
                updated.steps[step_index] = step

            if result is not None:
                updated.status = (
                    VerificationSessionStatus.ERROR
                    if result.verification_status == "error"
                    else VerificationSessionStatus.EVALUATING
                )
                updated.verification_status = result.verification_status
                updated.agent_response = result.response[:2000] if result.response else None
                updated.dom_after = result.artifacts.dom_after[:2000] if result.artifacts.dom_after else None
                updated.live = result.live
                updated.session_id = result.artifacts.session_id or updated.session_id
                if result.error:
                    updated.error = result.error[:2000]
                for j, step in enumerate(updated.steps):
                    if step.status in {
                        VerificationStepStatus.PENDING,
                        VerificationStepStatus.RUNNING,
                    }:
                        updated.steps[j] = step.model_copy(
                            update={"status": VerificationStepStatus.COMPLETED}
                        )

            audit.verification_sessions[i] = updated
            audit.updated_at = now
            break

    async def _record_finding(self, finding: Finding) -> None:
        audit = self._audits.get(finding.audit_id)
        if audit is None:
            return
        for i, session in enumerate(audit.verification_sessions):
            if session.task_id == finding.task_id:
                audit.verification_sessions[i] = session.model_copy(
                    update={
                        "status": VerificationSessionStatus.COMPLETED,
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                break
        for i, session in enumerate(audit.fuzz_sessions):
            if session.task_id == finding.task_id:
                audit.fuzz_sessions[i] = session.model_copy(
                    update={
                        "status": "error" if finding.detail else "completed",
                        "response": finding.response[:2000],
                        "error": finding.detail[:500] if finding.detail else None,
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                break
        audit.findings.append(finding)
        audit.updated_at = datetime.now(timezone.utc)
        self._maybe_complete(audit)

    async def _record_fuzz_payload(
        self, task: FuzzTask, result: OptimizationResult | None
    ) -> None:
        """Persist generated fuzzer payloads for memory/debugging."""
        audit = self._audits.get(task.audit_id)
        if audit is not None:
            for i, session in enumerate(audit.fuzz_sessions):
                if session.task_id == task.task_id:
                    if result is None:
                        audit.fuzz_sessions[i] = session.model_copy(
                            update={
                                "status": "optimizing",
                                "updated_at": datetime.now(timezone.utc),
                            }
                        )
                    else:
                        audit.fuzz_sessions[i] = session.model_copy(
                            update={
                                "status": "attacking",
                                "generated_payload": result.payload[:2000],
                                "initial_loss": result.initial_loss,
                                "final_loss": result.final_loss,
                                "updated_at": datetime.now(timezone.utc),
                            }
                        )
                    audit.updated_at = datetime.now(timezone.utc)
                    break

        if result is None:
            return
        try:
            await self._vector_repo.index_payload(
                result.payload,
                result.payload,
                await self._embeddings.embed_for_scoring(result.payload),
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("Fuzzer payload indexing skipped: %s", exc)

    async def _record_remediation(self, result: RemediationResult) -> None:
        audit = self._audits.get(result.audit_id)
        if audit is None:
            return

        enriched = result.model_copy(update={"validation_status": "pending"})
        audit.remediations.append(enriched)
        audit.updated_at = datetime.now(timezone.utc)
        self._maybe_complete(audit)

        if (
            audit.verification_mode == VerificationMode.CONTINUOUS
            and enriched.technique_id
        ):
            meta = self._audit_meta.get(result.audit_id, {})
            revalidation = self._repair_validation.build_revalidation_request(
                enriched,
                meta.get("target_name", audit.target_name),
                meta.get("target_endpoint", audit.target_endpoint),
                meta.get("source_repository", audit.source_repository),
                [enriched.technique_id],
            )
            asyncio.create_task(self._run_revalidation(revalidation))

    async def _run_revalidation(self, request: AuditRequest) -> None:
        try:
            await self.submit_audit(request)
        except Exception as exc:  # pragma: no cover
            logger.warning("Repair re-validation enqueue failed: %s", exc)

    def _maybe_complete(self, audit: AuditState) -> None:
        if len(audit.findings) < audit.queued_payloads:
            return

        if audit.verification_mode == VerificationMode.REPAIR_VALIDATION:
            audit.status = AuditStatus.COMPLETED
            baseline = self._audits.get(audit.baseline_run_id or "")
            if baseline:
                for i, rem in enumerate(baseline.remediations):
                    if rem.technique_id in audit.technique_ids:
                        status = self._repair_validation.compare_to_baseline(
                            baseline.findings,
                            audit.findings,
                            rem.technique_id,
                        )
                        baseline.remediations[i] = rem.model_copy(
                            update={"validation_status": status}
                        )
            return

        critical = sum(1 for f in audit.findings if f.is_critical)
        if len(audit.remediations) >= critical:
            audit.status = AuditStatus.COMPLETED
