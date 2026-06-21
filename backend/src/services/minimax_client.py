"""MiniMax integration: client factory, JSON extraction, and judge schema.

MiniMax-M3 is reached through its OpenAI-compatible endpoint and powers the
Phase-3 ensemble LLM-judge. Payload generation lives in
:mod:`src.services.fuzzer_service` (black-box token-level optimization), not here.
"""

from __future__ import annotations

import re

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from src.config import Settings

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def extract_json(content: str | None) -> str:
    """Extract a JSON object from a model reply.

    MiniMax-M3 is a reasoning model and prepends a ``<think>...</think>`` block
    even in JSON mode, so a naive ``json.loads`` fails. This strips the reasoning
    block and slices out the outermost ``{...}`` object.
    """
    cleaned = _THINK_RE.sub("", content or "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        return cleaned[start : end + 1]
    return cleaned


class JudgeScore(BaseModel):
    """Structured score returned by a single MiniMax judge."""

    threat_score: float = Field(ge=0.0, le=100.0)
    vuln_score: float = Field(ge=0.0, le=100.0)
    impact_score: float = Field(ge=0.0, le=100.0)

    @property
    def mean(self) -> float:
        return (self.threat_score + self.vuln_score + self.impact_score) / 3.0


def build_minimax_client(settings: Settings) -> AsyncOpenAI | None:
    """Return an AsyncOpenAI client pointed at MiniMax, or None when unconfigured."""
    if not settings.minimax_enabled:
        return None
    return AsyncOpenAI(
        api_key=settings.minimax_api_key,
        base_url=settings.minimax_base_url,
    )
