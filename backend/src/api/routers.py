"""FastAPI routing layer (thin): validate input, delegate to the orchestrator."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_orchestrator
from src.core.models import AuditRequest, AuditState, InterfaceType
from src.scenarios.registry import list_techniques
from src.services.orchestrator import Orchestrator

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])
techniques_router = APIRouter(prefix="/api/v1/techniques", tags=["Techniques"])


@techniques_router.get("")
async def get_techniques() -> list[dict[str, str]]:
    """Return ATT&CK technique scenarios available for verification."""
    return list_techniques()


@router.post("/start", response_model=AuditState, status_code=202)
async def start_audit(
    request: AuditRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> AuditState:
    """Ingest a target configuration and launch a continuous verification audit."""
    if request.interface_type != InterfaceType.WEB_UI:
        raise HTTPException(status_code=400, detail="Only 'web-ui' interface is supported.")
    try:
        return await orchestrator.submit_audit(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to start audit: {exc}") from exc


@router.get("", response_model=list[AuditState])
async def list_audits(
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> list[AuditState]:
    return orchestrator.list_audits()


@router.get("/{audit_id}", response_model=AuditState)
async def get_audit(
    audit_id: str,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> AuditState:
    audit = orchestrator.get_audit(audit_id)
    if audit is None:
        raise HTTPException(status_code=404, detail="Audit not found")
    return audit
