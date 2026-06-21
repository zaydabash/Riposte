"""Phase 3: evidence evaluation worker for verification results."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from typing import Awaitable

from urllib.parse import urlparse

from src.config import Settings
from src.core.models import (
    AriesComponents,
    AttackResult,
    Finding,
    RemediationTask,
    Severity,
    VerificationResult,
)
from src.services.eval_service import EvalService
from src.services.verification_service import VerificationService
from src.scenarios.registry import get_scenario

logger = logging.getLogger(__name__)

EvalInput = VerificationResult | AttackResult
ScoringLookup = Callable[[str], tuple[EvalService, VerificationService | None]]


async def eval_worker(
    eval_queue: "asyncio.Queue",
    remediation_queue: "asyncio.Queue",
    scoring_lookup: ScoringLookup,
    on_finding: Callable[[Finding], Awaitable[None]],
    shutdown_event: asyncio.Event,
    settings: Settings | None = None,
) -> None:
    timeout = (settings.worker_task_timeout if settings else 300.0)
    while not shutdown_event.is_set():
        try:
            result: EvalInput | None = await asyncio.wait_for(eval_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue

        if result is None:
            eval_queue.task_done()
            break

        try:
            eval_service, verification_service = scoring_lookup(result.audit_id)
            if isinstance(result, VerificationResult) and verification_service is not None:
                finding = await asyncio.wait_for(verification_service.evaluate(result), timeout=timeout)
            elif isinstance(result, AttackResult):
                finding = await asyncio.wait_for(eval_service.evaluate(result), timeout=timeout)
            else:
                raise TypeError(f"Unexpected eval input: {type(result)}")

            await on_finding(finding)
            if finding.is_critical or finding.control_failed:
                repair_target = finding.target_url
                if finding.technique_id and finding.target_url:
                    parsed = urlparse(finding.target_url)
                    base = f"{parsed.scheme}://{parsed.netloc}"
                    repair_target = get_scenario(finding.technique_id).repair_url(base)
                await remediation_queue.put(
                    RemediationTask(
                        audit_id=finding.audit_id,
                        repo_url=finding.repo_url,
                        target_url=repair_target,
                        payload=finding.payload,
                        aries_score=finding.aries_score,
                        technique_id=finding.technique_id,
                        baseline_run_id=getattr(result, "baseline_run_id", None),
                    )
                )
                logger.info(
                    "[CRITICAL] verification ARiES %.2f for %s audit %s",
                    finding.aries_score,
                    finding.technique_id,
                    finding.audit_id,
                )
        except Exception as exc:  # pragma: no cover
            logger.error("eval_worker error: %s", exc, exc_info=True)
            if isinstance(result, VerificationResult):
                finding = Finding(
                    audit_id=result.audit_id,
                    task_id=result.task_id,
                    payload=result.payload,
                    response=result.response,
                    repo_url=result.repo_url,
                    target_url=result.target_url,
                    aries_score=0.0,
                    components=AriesComponents(M=0, L=0, A=0, J=0),
                    severity=Severity.SAFE,
                    is_critical=False,
                    technique_id=result.technique_id,
                    artifacts_summary=result.artifacts.summary(),
                    control_failed=result.control_failed,
                    detail=f"Evaluation failed: {str(exc)[:480]}",
                )
                await on_finding(finding)
            elif isinstance(result, AttackResult):
                finding = Finding(
                    audit_id=result.audit_id,
                    task_id=result.task_id,
                    payload=result.payload,
                    response=result.response,
                    repo_url=result.repo_url,
                    target_url=result.target_url,
                    aries_score=0.0,
                    components=AriesComponents(M=0, L=0, A=0, J=0),
                    severity=Severity.SAFE,
                    is_critical=False,
                    detail=f"Evaluation failed: {str(exc)[:480]}",
                )
                await on_finding(finding)
        finally:
            eval_queue.task_done()
