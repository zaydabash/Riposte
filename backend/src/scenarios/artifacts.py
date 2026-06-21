"""Structured browser evidence captured during verification runs."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


def _new_id() -> str:
    return uuid.uuid4().hex


class StorageSnapshot(BaseModel):
    """Redacted browser storage state (names only, no secret values)."""

    cookie_names: list[str] = Field(default_factory=list)
    local_storage_keys: list[str] = Field(default_factory=list)


class NetworkEntry(BaseModel):
    """Sanitized network log entry — no auth headers or bodies with secrets."""

    url: str
    method: str = "GET"
    status: int = 0


class BrowserArtifacts(BaseModel):
    """Evidence bundle for one verification run."""

    run_id: str = Field(default_factory=_new_id)
    technique_id: str
    session_id: str | None = None
    secondary_session_id: str | None = None
    dom_before: str = ""
    dom_after: str = ""
    storage_snapshot: StorageSnapshot = Field(default_factory=StorageSnapshot)
    network_log: list[NetworkEntry] = Field(default_factory=list)
    screenshot_ref: str | None = None
    agent_response: str = ""

    def summary(self) -> str:
        """Sanitized one-line summary for Redis indexing and dashboard display."""
        parts = [
            self.technique_id,
            f"cookies={len(self.storage_snapshot.cookie_names)}",
            f"network={len(self.network_log)}",
        ]
        if self.agent_response:
            parts.append(f"response_len={len(self.agent_response)}")
        return " | ".join(parts)
