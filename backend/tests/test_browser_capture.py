"""Tests for Browserbase session log parsing."""

from src.scenarios.browser_capture import parse_network_log, parse_storage_snapshot


def test_parse_network_log_from_cdp_entries():
    logs = [
        {
            "method": "Network.requestWillBeSent",
            "request": {
                "params": {
                    "requestId": "req-1",
                    "request": {"url": "https://evil.example/collect", "method": "POST"},
                }
            },
        },
        {
            "method": "Network.responseReceived",
            "response": {
                "params": {
                    "requestId": "req-1",
                    "response": {"url": "https://evil.example/collect", "status": 302},
                }
            },
        },
    ]

    entries = parse_network_log(logs)
    assert len(entries) == 1
    assert entries[0].url == "https://evil.example/collect"
    assert entries[0].method == "POST"
    assert entries[0].status == 302


def test_parse_storage_snapshot_cookie_names_only():
    logs = [
        {
            "method": "Network.getCookies",
            "response": {
                "result": {
                    "cookies": [
                        {"name": "session_id", "value": "secret"},
                        {"name": "csrf", "value": "token"},
                    ]
                }
            },
        }
    ]

    snapshot = parse_storage_snapshot(logs)
    assert snapshot.cookie_names == ["session_id", "csrf"]
    assert snapshot.local_storage_keys == []
