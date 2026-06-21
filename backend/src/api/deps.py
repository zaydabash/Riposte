"""Dependency-injection providers for the API layer.

The orchestrator is created during app startup and stored on ``app.state``; routers
receive it via ``Depends`` rather than importing a module-level global.
"""

from __future__ import annotations

from fastapi import Depends, Request

from src.config import Settings, get_settings
from src.services.orchestrator import Orchestrator


def get_app_settings() -> Settings:
    return get_settings()


def get_orchestrator(request: Request) -> Orchestrator:
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if orchestrator is None:  # pragma: no cover - misconfiguration guard
        raise RuntimeError("Orchestrator not initialized")
    return orchestrator


__all__ = ["get_app_settings", "get_orchestrator", "Depends"]
