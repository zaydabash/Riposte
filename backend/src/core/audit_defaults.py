"""Audit request normalization helpers."""

from __future__ import annotations

from urllib.parse import urlparse


def derive_target_name(endpoint: str, explicit: str | None = None) -> str:
    """Return a display name from an explicit label or the endpoint hostname."""
    if explicit and explicit.strip():
        return explicit.strip()[:200]
    host = urlparse(endpoint).hostname
    return host or "audit-target"
