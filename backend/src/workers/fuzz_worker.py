"""Phase 1: adversarial fuzzing worker.

Consumes a seed (``FuzzTask``), runs black-box token-level loss optimization
against the target to craft an adversarial payload, then enqueues that payload as
an ``AttackTask`` for the offensive arm. Target queries during optimization go
through the shared concurrency semaphore so live browser sessions stay
rate-limited.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from src.config import Settings
from src.core.models import AttackTask, FuzzTask, TargetResponse
from src.services.fuzzer_service import AdversarialFuzzer, OptimizationResult
from src.workers.offensive_worker import TargetExecutor

logger = logging.getLogger(__name__)


async def fuzz_worker(
    fuzz_queue: "asyncio.Queue",
    attack_queue: "asyncio.Queue",
    fuzzer: AdversarialFuzzer,
    executor: TargetExecutor,
    semaphore: asyncio.Semaphore,
    on_payload: Callable[[FuzzTask, OptimizationResult | None], Awaitable[None]],
    shutdown_event: asyncio.Event,
    settings: Settings | None = None,
) -> None:
    timeout = (settings.worker_task_timeout if settings else 300.0)
    while not shutdown_event.is_set():
        try:
            task: FuzzTask | None = await asyncio.wait_for(fuzz_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue

        if task is None:  # poison pill
            fuzz_queue.task_done()
            break

        try:
            await on_payload(task, None)
            query_fn = _make_query_fn(executor, task, semaphore)
            result = await asyncio.wait_for(fuzzer.optimize(task.seed, query_fn), timeout=timeout)
            await on_payload(task, result)
            await attack_queue.put(
                AttackTask(
                    audit_id=task.audit_id,
                    target_url=task.target_url,
                    payload=result.payload,
                    repo_url=task.repo_url,
                    task_id=task.task_id,
                )
            )
            logger.info(
                "Fuzzed audit %s: loss %.3f -> %.3f (Δ%.3f)",
                task.audit_id, result.initial_loss, result.final_loss,
                result.improvement,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("fuzz_worker error: %s", exc, exc_info=True)
            # Degrade to the raw seed so the audit still progresses.
            await attack_queue.put(
                AttackTask(
                    audit_id=task.audit_id,
                    target_url=task.target_url,
                    payload=task.seed,
                    repo_url=task.repo_url,
                    task_id=task.task_id,
                )
            )
        finally:
            fuzz_queue.task_done()


def _make_query_fn(
    executor: TargetExecutor, task: FuzzTask, semaphore: asyncio.Semaphore
):
    async def query(prompt: str) -> TargetResponse:
        async with semaphore:
            result = await executor.execute(
                AttackTask(
                    audit_id=task.audit_id, target_url=task.target_url,
                    payload=prompt, repo_url=task.repo_url,
                )
            )
        return TargetResponse(text=result.response, logprobs=None)

    return query
