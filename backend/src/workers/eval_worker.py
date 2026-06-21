"""Phase 3: evidence evaluation worker for verification results."""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Union

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

logger = logging.getLogger(__name__)

EvalInput = Union[VerificationResult, AttackResult]


async def eval_worker(
    eval_queue: "asyncio.Queue",
    remediation_queue: "asyncio.Queue",
    eval_service: EvalService,
    verification_service: VerificationService | None,
    on_finding: Callable[[Finding], Awaitable[None]],
    shutdown_event: asyncio.Event,
) -> None:
    while not shutdown_event.is_set():
        try:
            result: EvalInput | None = await asyncio.wait_for(eval_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue

        if result is None:
            eval_queue.task_done()
            break

        try:
            if isinstance(result, VerificationResult) and verification_service is not None:
                finding = await verification_service.evaluate(result)
            elif isinstance(result, AttackResult):
                finding = await eval_service.evaluate(result)
            else:
                raise TypeError(f"Unexpected eval input: {type(result)}")

            await on_finding(finding)
            if finding.is_critical:
                await remediation_queue.put(
                    RemediationTask(
                        audit_id=finding.audit_id,
                        repo_url=finding.repo_url,
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
                    aries_score=50.0,
                    components=AriesComponents(M=0, L=0, A=50, J=0),
                    severity=Severity.MEDIUM,
                    is_critical=False,
                    technique_id=result.technique_id,
                    artifacts_summary=result.artifacts.summary(),
                    control_failed=result.control_failed,
                    detail=str(exc)[:500],
                )
                await on_finding(finding)
        finally:
            eval_queue.task_done()
