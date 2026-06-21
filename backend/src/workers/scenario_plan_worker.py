"""Phase 1: scenario planning — bounded parameter mutation before browser verification."""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from src.core.models import ScenarioTask
from src.services.scenario_mutation import ScenarioMutationService

logger = logging.getLogger(__name__)


async def scenario_plan_worker(
    scenario_queue: "asyncio.Queue",
    verify_queue: "asyncio.Queue",
    mutation: ScenarioMutationService,
    shutdown_event: asyncio.Event,
) -> None:
    while not shutdown_event.is_set():
        try:
            task: ScenarioTask | None = await asyncio.wait_for(
                scenario_queue.get(), timeout=1.0
            )
        except asyncio.TimeoutError:
            continue

        if task is None:
            scenario_queue.task_done()
            break

        try:
            planned = await mutation.plan_task(task)
            await verify_queue.put(planned)
            logger.info(
                "Planned verification %s for audit %s",
                planned.technique_id,
                planned.audit_id,
            )
        except Exception as exc:  # pragma: no cover
            logger.error("scenario_plan_worker error: %s", exc, exc_info=True)
            await verify_queue.put(task)
        finally:
            scenario_queue.task_done()
