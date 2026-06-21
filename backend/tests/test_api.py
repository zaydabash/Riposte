import pytest
from fastapi.testclient import TestClient

import src.repositories.vector_repo as vector_repo_mod
from src.main import create_app


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(vector_repo_mod, "redis", None)
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_health_reports_integrations(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "integrations" in body


def test_start_audit_returns_running_state(client):
    resp = client.post(
        "/api/v1/audit/start",
        json={
            "target_name": "Demo Bot",
            "target_endpoint": "https://target.example.com",
            "source_repository": "https://github.com/target/bot",
            "max_payloads": 3,
        },
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "running"
    assert body["queued_payloads"] == 6
    audit_id = body["audit_id"]

    got = client.get(f"/api/v1/audit/{audit_id}")
    assert got.status_code == 200


def test_rejects_non_web_ui_interface(client):
    resp = client.post(
        "/api/v1/audit/start",
        json={
            "target_name": "Demo",
            "target_endpoint": "https://target.example.com",
            "source_repository": "https://github.com/target/bot",
            "interface_type": "api",
        },
    )
    # Pydantic enum validation rejects unknown interface types at the boundary.
    assert resp.status_code == 422


def test_unknown_audit_returns_404(client):
    resp = client.get("/api/v1/audit/does-not-exist")
    assert resp.status_code == 404


def test_list_techniques(client):
    resp = client.get("/api/v1/techniques")
    assert resp.status_code == 200
    body = resp.json()
    assert any(t["technique_id"] == "T1185" for t in body)
