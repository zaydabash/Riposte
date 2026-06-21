"""Phase 2: Browserbase verification worker with artifact capture."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import Settings
from src.core.truncate import truncate_text
from src.core.models import (
    ScenarioTask,
    VerificationResult,
    VerificationSessionStatus,
    VerificationStepStatus,
)
from src.scenarios.artifacts import BrowserArtifacts, StorageSnapshot
from src.scenarios.base import BrowserStep, TechniqueScenario, describe_browser_step
from src.scenarios.browser_capture import parse_network_log, parse_storage_snapshot
from src.scenarios.registry import get_scenario
from src.services.browserbase_client import BrowserbaseClient

logger = logging.getLogger(__name__)

ProgressCallback = Callable[..., Awaitable[None]]

_STEP_LOG_LIMIT = 200
_EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {"text": {"type": "string"}},
    "required": ["text"],
}

_FILL_PARAM_ALIASES: dict[str, str] = {
    "username": "test_user",
    "password": "test_password",
    "email": "test_email",
    "portal-password": "test_password",
    "paste-target": "test_paste",
    "query": "test_query",
}


class VerificationRunner:
    """Runs one ATT&CK scenario via Browserbase + Stagehand."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._browserbase = BrowserbaseClient(settings)

    async def run(
        self,
        task: ScenarioTask,
        on_progress: ProgressCallback | None = None,
    ) -> VerificationResult:
        scenario = get_scenario(task.technique_id)
        payload_label = f"{task.technique_id}: {scenario.technique_name}"

        if not self._settings.browserbase_live:
            result = _error_result(
                task,
                payload_label,
                "Browserbase credentials are required for live verification.",
            )
            await _emit(
                on_progress,
                task,
                session_status=VerificationSessionStatus.ERROR,
                live=False,
                result=result,
            )
            return result

        try:
            if scenario.requires_dual_session:
                artifacts = await self._run_dual_session(task, scenario, on_progress)
            else:
                artifacts = await self._run_single_session(task, scenario, on_progress)
            control_failed = scenario.evaluate_control_failure(artifacts)
            result = VerificationResult(
                audit_id=task.audit_id,
                task_id=task.task_id,
                technique_id=task.technique_id,
                payload=payload_label,
                response=artifacts.agent_response or artifacts.dom_after,
                repo_url=task.repo_url,
                target_url=task.target_url,
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
            result = _error_result(
                task,
                payload_label,
                truncate_text(str(exc), self._settings.max_error_detail_chars) or "",
            )
            await _emit(
                on_progress,
                task,
                session_status=VerificationSessionStatus.ERROR,
                live=False,
                result=result,
            )
            return result

    @retry(
        wait=wait_exponential(multiplier=1, min=1, max=8),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def _run_single_session(
        self,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        on_progress: ProgressCallback | None,
    ) -> BrowserArtifacts:
        from stagehand import AsyncStagehand

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
        session_id = _session_id(session)
        await _emit(
            on_progress,
            task,
            session_status=VerificationSessionStatus.RUNNING,
            live=True,
            session_id=session_id,
        )

        dom_before = ""
        dom_after = ""
        try:
            if task.technique_id == "T1115":
                await self._grant_clipboard_permissions(session)

            for index, step in enumerate(scenario.browser_steps):
                log_detail, extracted = await self._execute_live_step(
                    session,
                    task,
                    scenario,
                    step,
                )
                if step.action == "snapshot" and extracted:
                    dom_before = extracted
                elif step.action == "extract" and extracted:
                    dom_after = extracted
                await _step_progress(on_progress, task, index, log_detail)

            final_text = await self._extract_visible_text(session)
            if final_text:
                dom_after = final_text
        finally:
            await session.end()

        return await self._build_artifacts(
            task=task,
            scenario=scenario,
            session_id=session_id,
            dom_before=dom_before,
            dom_after=dom_after,
        )

    async def _run_dual_session(
        self,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        on_progress: ProgressCallback | None,
    ) -> BrowserArtifacts:
        """T1185: victim session establishes state; attacker session probes isolation."""
        from stagehand import AsyncStagehand

        client = AsyncStagehand(
            browserbase_api_key=self._settings.browserbase_api_key,
            browserbase_project_id=self._settings.browserbase_project_id,
            model_api_key=self._settings.anthropic_api_key,
        )

        victim_session = await client.sessions.start(
            model_name=self._settings.stagehand_model,
            browser={"type": "browserbase"},
            browserbase_session_create_params={
                "projectId": self._settings.browserbase_project_id
            },
        )
        victim_id = _session_id(victim_session)
        await _emit(
            on_progress,
            task,
            session_status=VerificationSessionStatus.RUNNING,
            live=True,
            session_id=victim_id,
        )

        victim_dom_before = ""
        victim_dom_after = ""
        try:
            for index, step in enumerate(scenario.browser_steps):
                log_detail, extracted = await self._execute_live_step(
                    victim_session,
                    task,
                    scenario,
                    step,
                )
                if step.action == "snapshot" and extracted:
                    victim_dom_before = extracted
                elif step.action == "extract" and extracted:
                    victim_dom_after = extracted
                await _step_progress(on_progress, task, index, log_detail)

            victim_text = await self._extract_visible_text(victim_session)
            if victim_text:
                victim_dom_after = victim_text
        finally:
            await victim_session.end()

        victim_artifacts = await self._build_artifacts(
            task=task,
            scenario=scenario,
            session_id=victim_id,
            dom_before=victim_dom_before,
            dom_after=victim_dom_after,
        )

        attacker_session = await client.sessions.start(
            model_name=self._settings.stagehand_model,
            browser={"type": "browserbase"},
            browserbase_session_create_params={
                "projectId": self._settings.browserbase_project_id
            },
        )
        attacker_id = _session_id(attacker_session)
        await _emit(
            on_progress,
            task,
            session_status=VerificationSessionStatus.RUNNING,
            live=True,
            session_id=victim_id,
            secondary_session_id=attacker_id,
        )

        attacker_dom_after = ""
        try:
            await attacker_session.navigate(url=task.target_url)
            await _step_progress(
                on_progress,
                task,
                len(scenario.browser_steps),
                "Attacker session: navigate to protected route",
            )
            attacker_dom_after = await self._extract_with_instruction(
                attacker_session,
                "read session status and whether protected content is accessible",
            )
        finally:
            await attacker_session.end()

        attacker_artifacts = await self._build_artifacts(
            task=task,
            scenario=scenario,
            session_id=attacker_id,
            dom_before="",
            dom_after=attacker_dom_after,
        )

        return BrowserArtifacts(
            technique_id=task.technique_id,
            session_id=victim_id,
            secondary_session_id=attacker_id,
            dom_before=victim_artifacts.dom_before,
            dom_after=attacker_dom_after,
            agent_response=attacker_dom_after,
            storage_snapshot=victim_artifacts.storage_snapshot,
            network_log=[
                *victim_artifacts.network_log,
                *attacker_artifacts.network_log,
            ],
        )

    async def _build_artifacts(
        self,
        *,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        session_id: str | None,
        dom_before: str,
        dom_after: str,
    ) -> BrowserArtifacts:
        schema = set(scenario.evidence_schema)
        network_log = []
        storage_snapshot = StorageSnapshot()

        if session_id and self._settings.browserbase_live:
            try:
                logs = await self._browserbase.get_session_logs(session_id)
                if "network_log" in schema:
                    network_log = parse_network_log(logs)
                if "storage_snapshot" in schema:
                    storage_snapshot = parse_storage_snapshot(logs)
            except Exception as exc:
                logger.warning(
                    "Browserbase log capture skipped for %s: %s",
                    task.technique_id,
                    exc,
                )

        agent_response = dom_after
        return BrowserArtifacts(
            technique_id=task.technique_id,
            session_id=session_id,
            dom_before=dom_before if "dom_before" in schema else dom_before,
            dom_after=dom_after,
            agent_response=agent_response,
            storage_snapshot=storage_snapshot,
            network_log=network_log,
        )

    async def _grant_clipboard_permissions(self, session) -> None:
        """Best-effort clipboard permission grant for T1115 via CDP URL when present."""
        cdp_url = getattr(session, "cdp_url", None) or getattr(
            getattr(session, "data", None), "cdp_url", None
        )
        if not cdp_url:
            return
        try:
            import websockets
        except ImportError:
            logger.debug("websockets not installed; skipping clipboard CDP grant")
            return

        try:
            async with websockets.connect(cdp_url, open_timeout=5) as ws:
                for msg_id, method, params in (
                    (1, "Browser.grantPermissions", {"permissions": ["clipboardReadWrite"]}),
                    (2, "Browser.grantPermissions", {"permissions": ["clipboardSanitizedWrite"]}),
                ):
                    await ws.send(
                        json.dumps({"id": msg_id, "method": method, "params": params})
                    )
                    await asyncio.wait_for(ws.recv(), timeout=5)
        except Exception as exc:
            logger.debug("Clipboard permission grant skipped: %s", exc)

    async def _execute_live_step(
        self,
        session,
        task: ScenarioTask,
        scenario: TechniqueScenario,
        step: BrowserStep,
    ) -> tuple[str, str]:
        if step.action == "navigate":
            await session.navigate(url=task.target_url)
            return f"Navigated to {task.target_url}", ""

        if step.action == "fill" and step.selector:
            if task.technique_id == "T1115" and step.selector == "#paste-target":
                await session.act(
                    input={
                        "description": "Focus paste target",
                        "selector": step.selector,
                        "method": "click",
                    }
                )
                await session.act(
                    input={
                        "description": "Paste from clipboard",
                        "method": "press",
                        "arguments": ["Control+v"],
                    }
                )
                return "Pasted clipboard into #paste-target", ""

            value = _resolve_fill_value(step, task, scenario)
            await session.act(
                input={
                    "description": f"Fill {step.selector}",
                    "selector": step.selector,
                    "method": "fill",
                    "arguments": [value],
                }
            )
            return f"Filled {step.selector}", ""

        if step.action == "click" and step.selector:
            await session.act(
                input={
                    "description": f"Click {step.selector}",
                    "selector": step.selector,
                    "method": "click",
                }
            )
            return f"Clicked {step.selector}", ""

        if step.action in {"snapshot", "extract"}:
            instruction = step.instruction or "extract all visible page text"
            if step.selector:
                instruction = (
                    f"{instruction}. Focus on element {step.selector} if present."
                )
            extracted = await self._extract_with_instruction(session, instruction)
            label = (
                "Captured DOM snapshot"
                if step.action == "snapshot"
                else describe_browser_step(step)
            )
            return _truncate(extracted or label, _STEP_LOG_LIMIT), extracted

        if step.action == "wait":
            await asyncio.sleep(0.5)
            return "Waited for page settle", ""

        return describe_browser_step(step), ""

    async def _extract_visible_text(self, session) -> str:
        return await self._extract_with_instruction(
            session,
            "Extract the full visible text of the page, including all div, pre, "
            "and form field values currently shown to the user.",
        )

    async def _extract_with_instruction(self, session, instruction: str) -> str:
        extracted = await session.extract(
            instruction=instruction,
            schema=_EXTRACT_SCHEMA,
        )
        return _extract_text(extracted)


def _session_id(session) -> str | None:
    raw = getattr(session, "session_id", None) or getattr(session, "id", None)
    return str(raw) if raw else None


def _resolve_fill_value(
    step: BrowserStep,
    task: ScenarioTask,
    scenario: TechniqueScenario,
) -> str:
    if step.value is not None:
        return step.value

    params = {**scenario.default_parameters, **task.parameters}
    if not step.selector:
        raise ValueError("Fill step requires a selector")

    field_id = step.selector.lstrip("#")
    param_key = _FILL_PARAM_ALIASES.get(field_id, field_id.replace("-", "_"))
    for key in (param_key, field_id, field_id.replace("-", "_")):
        if key in params and params[key]:
            return params[key]

    raise ValueError(
        f"No fill value configured for {step.selector}. "
        f"Set scenario default_parameters or task.parameters."
    )


def _error_result(task: ScenarioTask, payload: str, error: str) -> VerificationResult:
    return VerificationResult(
        audit_id=task.audit_id,
        task_id=task.task_id,
        technique_id=task.technique_id,
        payload=payload,
        response="",
        repo_url=task.repo_url,
        target_url=task.target_url,
        live=False,
        verification_status="error",
        control_failed=False,
        artifacts=BrowserArtifacts(technique_id=task.technique_id),
        error=error,
        verification_mode=task.verification_mode,
        baseline_run_id=task.baseline_run_id,
    )


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
    secondary_session_id: str | None = None,
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
        secondary_session_id=secondary_session_id,
        result=result,
    )


def _truncate(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def _extract_text(extracted) -> str:
    if extracted is None:
        return ""
    if isinstance(extracted, str):
        return extracted.strip()

    data = getattr(extracted, "data", None)
    if data is not None:
        result = getattr(data, "result", None)
        if result is not None:
            if isinstance(result, dict):
                for key in ("text", "reply", "content", "value", "message"):
                    val = result.get(key)
                    if val:
                        return str(val).strip()
                parts = [str(v).strip() for v in result.values() if v]
                if parts:
                    return " ".join(parts).strip()
            return str(result).strip()

    for attr in ("text", "content", "result"):
        val = getattr(extracted, attr, None)
        if val:
            return str(val).strip()

    raw = str(extracted).strip()
    if raw.startswith("<") and "object" in raw.lower():
        return ""
    return raw


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
            try:
                scenario = get_scenario(task.technique_id)
                payload_label = f"{task.technique_id}: {scenario.technique_name}"
            except Exception:
                payload_label = task.technique_id
            await eval_queue.put(
                _error_result(
                    task,
                    payload_label,
                    truncate_text(str(exc), runner._settings.max_error_detail_chars) or "",
                ),
            )
        finally:
            verify_queue.task_done()
