"""Browserbase REST client for session replay and observability logs."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from src.config import Settings

logger = logging.getLogger(__name__)


class BrowserbaseClient:
    """Thin async wrapper around Browserbase session APIs (DI-friendly)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base = settings.browserbase_api_base.rstrip("/")
        self._timeout = settings.browserbase_http_timeout

    @property
    def enabled(self) -> bool:
        return self._settings.browserbase_live and self._settings.replay_proxy_enabled

    def _headers(self) -> dict[str, str]:
        return {"X-BB-API-Key": self._settings.browserbase_api_key or ""}

    async def get_replay_metadata(self, session_id: str) -> dict[str, Any]:
        """Return page metadata for HLS session replay."""
        if not self._settings.browserbase_api_key:
            raise RuntimeError("Browserbase API key is not configured.")
        url = f"{self._base}/v1/sessions/{session_id}/replays"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, headers=self._headers())
            response.raise_for_status()
            return response.json()

    async def get_replay_playlist(self, session_id: str, page_id: str) -> str:
        """Fetch the HLS .m3u8 playlist body for one replay page."""
        if not self._settings.browserbase_api_key:
            raise RuntimeError("Browserbase API key is not configured.")
        url = f"{self._base}/v1/sessions/{session_id}/replays/{page_id}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                url,
                headers={
                    **self._headers(),
                    "Accept": "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
                },
            )
            response.raise_for_status()
            return response.text

    async def get_session_logs(self, session_id: str) -> list[dict[str, Any]]:
        """Return CDP-style session logs for network and storage forensics."""
        if not self._settings.browserbase_api_key:
            raise RuntimeError("Browserbase API key is not configured.")
        url = f"{self._base}/v1/sessions/{session_id}/logs"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url, headers=self._headers())
            if response.status_code == 404:
                return []
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                return data
            return []
