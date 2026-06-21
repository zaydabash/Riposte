"""Phase 2: Browserbase verification worker with session reuse and artifact capture."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import Settings
from src.core.models import (
    ScenarioTask,
    VerificationResult,
    VerificationSessionStatus,
    VerificationStepStatus,
)
from src.scenarios.base import BrowserStep, TechniqueScenario, describe_browser_step
from src.scenarios.registry import get_scenario

logger = logging.getLogger(__name__)

ProgressCallback = Callable[..., Awaitable[None]]


class VerificationRunner:
    """Runs one ATT&CK scenario, live via Stagehand or offline via controlled simulation."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def run(
        self,
        task: ScenarioTask,
        on_progress: ProgressCallback | None = None,
    ) -> VerificationResult:
        scenario = get_scenario(task.technique_id)
        payload_label = f"{task.technique_id}: {scenario.technique_name}"

        use_live = self._settings.verification_live_target and self._settings.browserbase_live
        if use_live:
            try:
                artifacts = await self._run_live(task, scenario, on_progress)
                control_failed = scenario.evaluate_control_failure(artifacts)
                result = VerificationResult(
                    audit_id=task.audit_id,
                    task_id=task.task_id,
                    technique_id=task.technique_id,
                    payload=payload_label,
                    response=artifacts.agent_response or artifacts.dom_after,
                    repo_url=task.repo_url,
                    live=True,
                    verification_status="fail" if control_failed else "pass",
                    control_failed=control_failed,
                    artifacts=artifacts,
                    verification_mode=task.verification_mode,
                    baseline_run_id=task.baseline_run_id,
                )
                await _emit(on_progress, task, result=result)
                return result
            except Exception as exc:
                logger.error(
                    "Live verification failed for %s: %s",
                    task.technique_id,
                    exc,
                    exc_info=True,
                )
                offline = scenario.simulate_offline(task.parameters)
                result = VerificationResult(
                    audit_id=task.audit_id,
                    task_id=task.task_id,
                    technique_id=task.technique_id,
                    payload=payload_label,
                    response=offline.agent_response,
                    repo_url=task.repo_url,
                    live=False,
                    verification_status="error",
                    control_failed=True,
                    artifacts=offline,
                    error=str(exc)[:500],
                    verification_mode=task.verification_mode,
                    baseline_run_id=task.baseline_run_id,
                )
                await _emit(on_progress, task, result=result)
                return result

        artifacts = await self._run_offline(task, scenario, on_progress)
        control_failed = scenario.evaluate_control_failure(artifacts)
        result = VerificationResult(
            audit_id=task.audit_id,
            task_id=task.task_id,
            technique_id=task.technique_id,
            payload=payload_label,
            response=artifacts.agent_response or artifacts.dom_after,
            repo_url=task.repo_url,
            live=False,
            verification_status="fail" if control_failed else "pass",
            control_failed=control_failed,
            artifacts=artifacts,
            verification_mode=task.verification_mode,
            baseline_run_id=task.baseline_run_id,
        )
        await _emit(on_progress, task, result=result)
        return result

    async def _run_offline(
        self,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        on_progress: ProgressCallback | None,
    ):
        await _emit(
            on_progress,
            task,
            session_status=VerificationSessionStatus.RUNNING,
            live=False,
        )
        for index, step in enumerate(scenario.browser_steps):
            detail = await self._execute_offline_step(task, scenario, step)
            await _step_progress(on_progress, task, index, detail)
        return scenario.simulate_offline(task.parameters)

    async def _execute_offline_step(
        self,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        step: BrowserStep,
    ) -> str:
        await asyncio.sleep(0.35)
        if step.action == "navigate":
            return f"Loaded {scenario.fixture_url(self._settings.fixture_server_url)}"
        if step.action == "fill" and step.selector:
            return f"Filled {step.selector} with test value"
        if step.action == "click" and step.selector:
            return f"Clicked {step.selector}"
        if step.action == "extract":
            preview = scenario.simulate_offline(task.parameters).agent_response
            return truncate(preview, 120) or "Extracted page evidence"
        if step.action == "snapshot":
            preview = scenario.simulate_offline(task.parameters).dom_before
            return truncate(preview, 120) or "Captured DOM snapshot"
        if step.action == "wait":
            return "Waited for page settle"
        return describe_browser_step(step)

    @retry(
        wait=wait_exponential(multiplier=1, min=1, max=8),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _run_live(
        self,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        on_progress: ProgressCallback | None,
    ):
        from stagehand import AsyncStagehand

        from src.scenarios.artifacts import BrowserArtifacts, NetworkEntry, StorageSnapshot

        fixture_url = scenario.fixture_url(self._settings.fixture_server_url)
        client = AsyncStagehand(
            browserbase_api_key=self._settings.browserbase_api_key,
            browserbase_project_id=self._settings.browserbase_project_id,
            model_api_key=self._settings.anthropic_api_key,
        )
        session = await client.sessions.start(
            model_name=self._settings.stagehand_model,
            browser={"type": "browserbase"},
            browserbase_session_create_params={
                "projectId": self._settings.browserbase_project_id
            },
        )
        session_id = getattr(session, "session_id", None) or getattr(session, "id", None)
        await _emit(
            on_progress,
            task,
            session_status=VerificationSessionStatus.RUNNING,
            live=True,
            session_id=str(session_id) if session_id else None,
        )

        dom_before = ""
        dom_after = ""
        agent_response = ""
        try:
            for index, step in enumerate(scenario.browser_steps):
                detail = await self._execute_live_step(
                    session,
                    task,
                    fixture_url,
                    step,
                )
                if step.action == "snapshot":
                    dom_before = detail
                elif step.action in {"extract", "navigate"}:
                    dom_after = detail
                    agent_response = detail
                await _step_progress(on_progress, task, index, detail)

            if not dom_after:
                extracted = await session.extract(
                    instruction="extract visible page text",
                    schema={
                        "type": "object",
                        "properties": {"text": {"type": "string"}},
                        "required": ["text"],
                    },
                )
                dom_after = _extract_text(extracted)
                agent_response = dom_after
        finally:
            await session.end()

        return BrowserArtifacts(
            technique_id=task.technique_id,
            session_id=str(session_id) if session_id else None,
            dom_before=dom_before,
            dom_after=dom_after,
            storage_snapshot=StorageSnapshot(cookie_names=[], local_storage_keys=[]),
            network_log=[NetworkEntry(url=fixture_url, status=200)],
            agent_response=agent_response,
        )

    async def _execute_live_step(
        self,
        session,
        task: ScenarioTask,
        fixture_url: str,
        step: BrowserStep,
    ) -> str:
        if step.action == "snapshot":
            extracted = await session.extract(
                instruction="extract visible page text",
                schema={
                    "type": "object",
                    "properties": {"text": {"type": "string"}},
                    "required": ["text"],
                },
            )
            return truncate(_extract_text(extracted), 120)
        if step.action == "navigate":
            await session.navigate(url=fixture_url)
            return f"Navigated to {fixture_url}"
        if step.action == "fill" and step.selector:
            value = task.parameters.get(
                step.selector.strip("#"),
                task.parameters.get("test_password", "riposte-test-only"),
            )
            await session.act(
                input={
                    "description": f"Fill {step.selector}",
                    "selector": step.selector,
                    "method": "fill",
                    "arguments": [value],
                }
            )
            return f"Filled {step.selector}"
        if step.action == "click" and step.selector:
            await session.act(
                input={
                    "description": f"Click {step.selector}",
                    "selector": step.selector,
                    "method": "click",
                }
            )
            return f"Clicked {step.selector}"
        if step.action == "extract":
            extracted = await session.extract(
                instruction=step.instruction or "extract page text",
                schema={
                    "type": "object",
                    "properties": {"text": {"type": "string"}},
                    "required": ["text"],
                },
            )
            return truncate(_extract_text(extracted), 120)
        if step.action == "wait":
            await asyncio.sleep(0.5)
            return "Waited for page settle"
        return describe_browser_step(step)


async def _step_progress(
    on_progress: ProgressCallback | None,
    task: ScenarioTask,
    index: int,
    detail: str,
) -> None:
    await _emit(
        on_progress,
        task,
        step_index=index,
        step_status=VerificationStepStatus.RUNNING,
    )
    await asyncio.sleep(0.25)
    await _emit(
        on_progress,
        task,
        step_index=index,
        step_status=VerificationStepStatus.COMPLETED,
        step_detail=detail,
    )


async def _emit(
    on_progress: ProgressCallback | None,
    task: ScenarioTask,
    *,
    session_status: VerificationSessionStatus | None = None,
    step_index: int | None = None,
    step_status: VerificationStepStatus | None = None,
    step_detail: str | None = None,
    live: bool | None = None,
    session_id: str | None = None,
    result: VerificationResult | None = None,
) -> None:
    if on_progress is None:
        return
    await on_progress(
        task.audit_id,
        task.task_id,
        session_status=session_status,
        step_index=step_index,
        step_status=step_status,
        step_detail=step_detail,
        live=live,
        session_id=session_id,
        result=result,
    )


def truncate(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def _extract_text(extracted) -> str:
    data = getattr(extracted, "data", None)
    if data is not None and getattr(data, "result", None) is not None:
        result = data.result
        if isinstance(result, dict):
            return str(result.get("text") or result.get("reply") or "")
        return str(result)
    return str(extracted)


async def verification_worker(
    verify_queue: "asyncio.Queue",
    eval_queue: "asyncio.Queue",
    runner: VerificationRunner,
    semaphore: asyncio.Semaphore,
    shutdown_event: asyncio.Event,
    on_progress: ProgressCallback | None = None,
) -> None:
    while not shutdown_event.is_set():
        try:
            task: ScenarioTask | None = await asyncio.wait_for(
                verify_queue.get(), timeout=1.0
            )
        except asyncio.TimeoutError:
            continue

        if task is None:
            verify_queue.task_done()
            break

        try:
            async with semaphore:
                result = await runner.run(task, on_progress=on_progress)
            await eval_queue.put(result)
        except Exception as exc:  # pragma: no cover
            logger.error("verification_worker error: %s", exc, exc_info=True)
        finally:
            verify_queue.task_done()
