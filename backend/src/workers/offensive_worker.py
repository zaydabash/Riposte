"""Phase 2: offensive execution arm.

When Browserbase is configured we drive a real cloud browser via Stagehand: we
navigate to the target, locate its input via ``observe`` (a deterministic locator,
not an LLM acting on attacker text), type the payload, and ``extract`` the reply.
Locating-then-filling avoids prompt-injecting our own testing agent.

When Browserbase is not configured (the documented demo fallback) we simulate a
target whose guardrails can be bypassed, so the full pipeline still produces
findings. Simulated results are flagged ``live=False``.
"""

from __future__ import annotations

import asyncio
import logging

from src.config import Settings
from src.core.models import AttackResult, AttackTask
from src.core.text_analysis import is_refusal

logger = logging.getLogger(__name__)

# Heuristic markers that an injection payload is probing for disclosure.
_INJECTION_MARKERS = (
    "ignore", "system prompt", "developer mode", "reveal", "confidential",
    "password", "api key", "salary", "private", "verbatim", "disregard",
    "internal audit", "word for word",
)


def simulate_target_response(payload: str, private_corpus: list[str]) -> str:
    """Deterministic stand-in target: leaks a private doc when probed."""
    lowered = payload.lower()
    if any(marker in lowered for marker in _INJECTION_MARKERS) and private_corpus:
        # Vulnerable target: jailbroken, it discloses proprietary context prominently.
        idx = sum(ord(c) for c in payload) % len(private_corpus)
        leaked = private_corpus[idx]
        return f"Confidential internal record (disclosed): {leaked}"
    return "I'm sorry, but I can't help with that request."


class TargetExecutor:
    """Executes a single payload against the target, live or simulated."""

    def __init__(self, settings: Settings, private_corpus: list[str]) -> None:
        self._settings = settings
        self._private_corpus = private_corpus

    async def execute(self, task: AttackTask) -> AttackResult:
        if self._settings.browserbase_live:
            try:
                reply = await self._execute_live(task)
                return AttackResult(
                    audit_id=task.audit_id, task_id=task.task_id, payload=task.payload,
                    response=reply, repo_url=task.repo_url, live=True,
                )
            except Exception as exc:
                logger.error("Stagehand execution failed, simulating: %s", exc, exc_info=True)

        reply = simulate_target_response(task.payload, self._private_corpus)
        return AttackResult(
            audit_id=task.audit_id, task_id=task.task_id, payload=task.payload,
            response=reply, repo_url=task.repo_url, live=False,
        )

    async def _execute_live(self, task: AttackTask) -> str:
        from stagehand import AsyncStagehand  # imported lazily; optional dep

        client = AsyncStagehand(
            browserbase_api_key=self._settings.browserbase_api_key,
            model_api_key=self._settings.anthropic_api_key,
        )
        session = await client.sessions.create(model_name=self._settings.stagehand_model)
        try:
            await session.navigate(url=task.target_url)
            # Locate the chat input deterministically before typing attacker text.
            await session.act(input=f"type the following text into the main chat input: {task.payload}")
            await session.act(input="submit the message")
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
