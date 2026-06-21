"""Browserbase session replay proxy routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse

from src.api.deps import get_app_settings, get_browserbase_client
from src.config import Settings
from src.services.browserbase_client import BrowserbaseClient

router = APIRouter(prefix="/api/v1/sessions", tags=["Browserbase"])


@router.get("/{session_id}/replays")
async def list_session_replays(
    session_id: str,
    client: BrowserbaseClient = Depends(get_browserbase_client),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    if not settings.replay_proxy_enabled or not settings.browserbase_live:
        raise HTTPException(status_code=503, detail="Browserbase replay is not configured.")
    try:
        return await client.get_replay_metadata(session_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{session_id}/replays/{page_id}")
async def get_session_replay_playlist(
    session_id: str,
    page_id: str,
    client: BrowserbaseClient = Depends(get_browserbase_client),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    if not settings.replay_proxy_enabled or not settings.browserbase_live:
        raise HTTPException(status_code=503, detail="Browserbase replay is not configured.")
    try:
        body = await client.get_replay_playlist(session_id, page_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return PlainTextResponse(
        content=body,
        media_type="application/vnd.apple.mpegurl",
    )
