"""Phase 3: semantic evaluation worker.

Consumes raw attack results, computes the ARiES score, records the finding on the
audit, and — when a finding is critical — hands it off to the remediation queue.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from src.core.models import AttackResult, Finding, RemediationTask
from src.services.eval_service import EvalService

logger = logging.getLogger(__name__)


async def eval_worker(
    eval_queue: "asyncio.Queue",
    remediation_queue: "asyncio.Queue",
    eval_service: EvalService,
    on_finding: Callable[[Finding], Awaitable[None]],
    shutdown_event: asyncio.Event,
) -> None:
    while not shutdown_event.is_set():
        try:
            result: AttackResult | None = await asyncio.wait_for(eval_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue

        if result is None:  # poison pill
            eval_queue.task_done()
            break

        try:
            finding = await eval_service.evaluate(result)
            await on_finding(finding)
            if finding.is_critical:
                await remediation_queue.put(
                    RemediationTask(
                        audit_id=finding.audit_id,
                        repo_url=finding.repo_url,
                        payload=finding.payload,
                        aries_score=finding.aries_score,
                    )
                )
                logger.info(
                    "[CRITICAL] ARiES %.2f for audit %s — queued remediation",
                    finding.aries_score, finding.audit_id,
                )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("eval_worker error: %s", exc, exc_info=True)
        finally:
            eval_queue.task_done()
