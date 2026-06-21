"""Phase 2: offensive execution arm.

When Browserbase is configured we drive a real cloud browser via Stagehand: we
navigate to the target, locate its input via ``observe`` (a deterministic locator,
not an LLM acting on attacker text), type the payload, and ``extract`` the reply.
Locating-then-filling avoids prompt-injecting our own testing agent.
"""

from __future__ import annotations

import asyncio
import logging

from src.config import Settings
from src.core.models import AttackResult, AttackTask

logger = logging.getLogger(__name__)


class TargetExecutor:
    """Executes a single payload against the target via Browserbase."""

    def __init__(self, settings: Settings, private_corpus: list[str]) -> None:
        self._settings = settings
        self._private_corpus = private_corpus

    async def execute(self, task: AttackTask) -> AttackResult:
        if not self._settings.browserbase_live:
            return AttackResult(
                audit_id=task.audit_id,
                task_id=task.task_id,
                payload=task.payload,
                response="",
                repo_url=task.repo_url,
                target_url=task.target_url,
                live=False,
                error="Browserbase credentials are required for live target execution.",
            )

        try:
            reply = await self._execute_live(task)
            return AttackResult(
                audit_id=task.audit_id,
                task_id=task.task_id,
                payload=task.payload,
                response=reply,
                repo_url=task.repo_url,
                target_url=task.target_url,
                live=True,
            )
        except Exception as exc:
            logger.error("Stagehand execution failed: %s", exc, exc_info=True)
            return AttackResult(
                audit_id=task.audit_id,
                task_id=task.task_id,
                payload=task.payload,
                response="",
                repo_url=task.repo_url,
                target_url=task.target_url,
                live=False,
                error=str(exc)[:500],
            )

    async def _execute_live(self, task: AttackTask) -> str:
        from stagehand import AsyncStagehand  # imported lazily; optional dep

        client = AsyncStagehand(
            browserbase_api_key=self._settings.browserbase_api_key,
            browserbase_project_id=self._settings.browserbase_project_id,
            model_api_key=self._settings.anthropic_api_key,
        )
        bb_params: dict = {"projectId": self._settings.browserbase_project_id}
        session = await client.sessions.start(
            model_name=self._settings.stagehand_model,
            browser={"type": "browserbase"},
            browserbase_session_create_params=bb_params,
        )
        try:
            await session.navigate(url=task.target_url)

            # SECURITY: locate the input with observe (no attacker text in the prompt),
            # then fill via a structured ActionParam so the payload never reaches the
            # Stagehand agent's natural-language instruction channel.
            observed = await session.observe(
                instruction="find the main chat text input or textarea element"
            )
            input_action = _pick_chat_input(observed)
            fill_action = {
                "description": input_action.description if input_action else "Fill chat input",
                "selector": (
                    input_action.selector
                    if input_action
                    else 'input[type="text"], textarea'
                ),
                "method": "fill",
                "arguments": [task.payload],
            }
            await session.act(input=fill_action)

            submit_observed = await session.observe(
                instruction="find the send or submit button for the chat input"
            )
            submit_action = _pick_submit_action(submit_observed)
            if submit_action is not None:
                await session.act(input=_action_to_param(submit_action))
            else:
                await session.act(
                    input={
                        "description": "Submit message",
                        "selector": fill_action["selector"],
                        "method": "press",
                        "arguments": ["Enter"],
                    }
                )

            extracted = await session.extract(
                instruction="extract the exact text of the assistant's latest reply",
                schema={
                    "type": "object",
                    "properties": {"reply": {"type": "string"}},
                    "required": ["reply"],
                },
            )
            data = getattr(extracted, "data", None)
            if data is not None and getattr(data, "result", None) is not None:
                result = data.result
                return result.get("reply", "") if isinstance(result, dict) else str(result)
            return str(extracted)
        finally:
            await session.end()


def _pick_chat_input(observed) -> object | None:
    """Return the best observe result for a text/chat input, if any."""
    results = getattr(getattr(observed, "data", None), "result", None) or []
    for item in results:
        desc = (getattr(item, "description", "") or "").lower()
        if any(k in desc for k in ("input", "textarea", "chat", "message", "text")):
            return item
    return results[0] if results else None


def _pick_submit_action(observed) -> object | None:
    results = getattr(getattr(observed, "data", None), "result", None) or []
    for item in results:
        desc = (getattr(item, "description", "") or "").lower()
        if any(k in desc for k in ("send", "submit", "post", "enter")):
            return item
    return results[0] if results else None


def _action_to_param(action) -> dict:
    param: dict = {
        "description": action.description,
        "selector": action.selector,
    }
    if action.method:
        param["method"] = action.method
    if action.arguments:
        param["arguments"] = list(action.arguments)
    if getattr(action, "backend_node_id", None) is not None:
        param["backendNodeId"] = action.backend_node_id
    return param


async def offensive_worker(
    attack_queue: "asyncio.Queue",
    eval_queue: "asyncio.Queue",
    executor: TargetExecutor,
    semaphore: asyncio.Semaphore,
    shutdown_event: asyncio.Event,
) -> None:
    """Consume attack tasks, execute them under a concurrency limit, emit results."""
    while not shutdown_event.is_set():
        try:
            task: AttackTask | None = await asyncio.wait_for(attack_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue

        if task is None:  # poison pill
            attack_queue.task_done()
            break

        try:
            async with semaphore:
                result = await executor.execute(task)
            await eval_queue.put(result)
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("offensive_worker error: %s", exc, exc_info=True)
        finally:
            attack_queue.task_done()
