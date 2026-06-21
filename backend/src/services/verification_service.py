"""Technique-specific verification rubrics mapped to ARiES findings."""

from __future__ import annotations

import logging

from src.config import Settings
from src.core.embeddings import EmbeddingProvider
from src.core.models import (
    AriesComponents,
    AttackResult,
    Finding,
    Severity,
    VerificationResult,
)
from src.repositories.vector_repo import VectorRepository
from src.scenarios.registry import get_scenario
from src.services.eval_service import EvalService, attack_success_score, severity_for

logger = logging.getLogger(__name__)


def _build_eval_text(result: VerificationResult) -> str:
    """Assemble unique browser evidence for per-technique ARiES scoring."""
    parts: list[str] = [f"technique={result.technique_id}"]
    for chunk in (
        result.artifacts.dom_before,
        result.artifacts.dom_after,
        result.artifacts.agent_response,
        result.response,
    ):
        text = (chunk or "").strip()
        if text and text not in parts:
            parts.append(text)
    return "\n".join(parts)


class VerificationService:
    """Evaluates verification runs with technique rubrics + ARiES components."""

    def __init__(
        self,
        settings: Settings,
        eval_service: EvalService,
        embeddings: EmbeddingProvider,
        vector_repo: VectorRepository | None = None,
    ) -> None:
        self._settings = settings
        self._eval_service = eval_service
        self._embeddings = embeddings
        self._vector_repo = vector_repo

    async def evaluate(self, result: VerificationResult) -> Finding:
        scenario = get_scenario(result.technique_id)
        control_failed = result.control_failed or scenario.evaluate_control_failure(
            result.artifacts
        )

        eval_text = _build_eval_text(result)
        attack_result = AttackResult(
            audit_id=result.audit_id,
            task_id=result.task_id,
            payload=result.payload,
            response=eval_text,
            repo_url=result.repo_url,
            target_url=result.target_url,
            live=result.live,
        )
        base = await self._eval_service.evaluate(attack_result)

        if control_failed:
            a_score = attack_success_score(eval_text)
        else:
            a_score = min(base.components.A, self._settings.aries_control_pass_a_cap)

        aries = (
            (self._settings.aries_weight_m * base.components.M)
            + (self._settings.aries_weight_l * base.components.L)
            + (self._settings.aries_weight_a * a_score)
            + (self._settings.aries_weight_j * base.components.J)
        )
        aries = float(round(aries, 2))
        if control_failed:
            aries = max(aries, self._settings.aries_critical_threshold)
        is_critical = control_failed or aries >= self._settings.aries_critical_threshold

        await self._index_evidence(result, control_failed)

        detail = result.error
        if result.verification_status == "error" and not detail:
            detail = "Verification run failed — see artifacts for partial evidence."

        return Finding(
            audit_id=result.audit_id,
            task_id=result.task_id,
            payload=result.payload,
            response=eval_text or result.response,
            repo_url=result.repo_url,
            target_url=result.target_url,
            aries_score=aries,
            components=AriesComponents(
                M=base.components.M,
                L=base.components.L,
                A=round(a_score, 2),
                J=base.components.J,
            ),
            severity=severity_for(aries, is_critical, self._settings),
            is_critical=is_critical,
            leaked_documents=base.leaked_documents,
            technique_id=result.technique_id,
            artifacts_summary=result.artifacts.summary(),
            control_failed=control_failed,
            recommended_controls=[scenario.repair_template] if control_failed else [],
            detail=detail,
        )

    async def _index_evidence(self, result: VerificationResult, control_failed: bool) -> None:
        if self._vector_repo is None:
            return
        summary = (
            f"{result.technique_id}|failed={control_failed}|"
            f"{result.artifacts.summary()}"
        )
        try:
            emb = await self._embeddings.embed_for_scoring(summary)
            await self._vector_repo.index_evidence(
                f"{result.audit_id}:{result.task_id}",
                summary,
                emb,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("index_evidence skipped: %s", exc)
