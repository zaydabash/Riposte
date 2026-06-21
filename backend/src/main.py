"""Riposte FastAPI application entry point.

Telemetry is initialized and the async orchestrator's worker pools are started
inside the lifespan context, and gracefully shut down on exit.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.deps import get_orchestrator
from src.api.routers import router as audit_router, techniques_router
from src.api.sessions_router import router as sessions_router
from src.config import get_settings
from src.core.telemetry import init_telemetry
from src.services.orchestrator import Orchestrator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("riposte")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_telemetry(settings)
    orchestrator = Orchestrator(settings)
    await orchestrator.start()
    app.state.orchestrator = orchestrator
    logger.info("Riposte backend ready: %s", orchestrator.telemetry_status)
    try:
        yield
    finally:
        await orchestrator.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Riposte — Continuous Verification & Repair Plane",
        description=(
            "Continuous verification and repair for AI agents and AI-assisted "
            "software, mapped to MITRE ATT&CK browser-testable controls."
        ),
        version="2.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(audit_router)
    app.include_router(techniques_router)
    app.include_router(sessions_router)

    @app.get("/health", tags=["Health"])
    async def health(orchestrator: Orchestrator = Depends(get_orchestrator)) -> dict:
        return {"status": "ok", "integrations": await orchestrator.integration_status()}

    return app


app = create_app()
