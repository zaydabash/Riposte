"""Parse Browserbase session logs into sanitized verification artifacts."""

from __future__ import annotations

import json
from typing import Any

from src.scenarios.artifacts import NetworkEntry, StorageSnapshot


def _parse_json_blob(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _nested(params: dict[str, Any], *keys: str) -> Any:
    current: Any = params
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def parse_network_log(logs: list[dict[str, Any]]) -> list[NetworkEntry]:
    """Extract sanitized network entries from Browserbase CDP session logs."""
    pending: dict[str, tuple[str, str]] = {}
    entries: list[NetworkEntry] = []
    seen: set[tuple[str, str, int]] = set()

    for entry in logs:
        method = str(entry.get("method") or "")
        request = _parse_json_blob(entry.get("request"))
        response = _parse_json_blob(entry.get("response"))
        params = _parse_json_blob(request.get("params")) or _parse_json_blob(
            response.get("params")
        )

        if method == "Network.requestWillBeSent":
            request_id = str(_nested(params, "requestId") or "")
            url = str(_nested(params, "request", "url") or "")
            http_method = str(_nested(params, "request", "method") or "GET")
            if request_id and url:
                pending[request_id] = (url, http_method)
            continue

        if method == "Network.responseReceived":
            request_id = str(_nested(params, "requestId") or "")
            url = str(_nested(params, "response", "url") or "")
            status = int(_nested(params, "response", "status") or 0)
            http_method = pending.get(request_id, ("", "GET"))[1]
            if not url and request_id in pending:
                url = pending[request_id][0]
            if not url:
                continue
            key = (url, http_method, status)
            if key in seen:
                continue
            seen.add(key)
            entries.append(NetworkEntry(url=url, method=http_method, status=status))

    return entries


def parse_storage_snapshot(logs: list[dict[str, Any]]) -> StorageSnapshot:
    """Extract cookie and localStorage key names only (no secret values)."""
    cookie_names: list[str] = []
    local_keys: list[str] = []

    for entry in logs:
        method = str(entry.get("method") or "")
        response = _parse_json_blob(entry.get("response"))
        result = _parse_json_blob(response.get("result"))

        if method == "Network.getCookies":
            cookies = result.get("cookies")
            if isinstance(cookies, list):
                for cookie in cookies:
                    if isinstance(cookie, dict):
                        name = cookie.get("name")
                        if name and name not in cookie_names:
                            cookie_names.append(str(name))

        if method in {"DOMStorage.getDOMStorageItems", "Storage.getDOMStorageItems"}:
            items = result.get("entries") or result.get("items")
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, (list, tuple)) and item:
                        key = str(item[0])
                        if key not in local_keys:
                            local_keys.append(key)
                    elif isinstance(item, dict):
                        key = item.get("key") or item.get("name")
                        if key and str(key) not in local_keys:
                            local_keys.append(str(key))

    return StorageSnapshot(
        cookie_names=cookie_names,
        local_storage_keys=local_keys,
    )
