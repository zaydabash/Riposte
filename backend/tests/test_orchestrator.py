import asyncio

import pytest

import src.repositories.vector_repo as vector_repo_mod
from src.config import get_settings
from src.core.models import AuditRequest, AuditStatus
from src.services.orchestrator import Orchestrator


@pytest.mark.asyncio
async def test_full_pipeline_offline(monkeypatch):
    # Avoid any Redis network usage during the e2e run.
    monkeypatch.setattr(vector_repo_mod, "redis", None)

    settings = get_settings()
    orchestrator = Orchestrator(settings)
    await orchestrator.start()
    try:
        request = AuditRequest(
            target_name="Demo Bot",
            target_endpoint="https://target-agent.example.com",
            source_repository="https://github.com/target/bot",
            max_payloads=5,
        )
        state = await orchestrator.submit_audit(request)
        assert state.queued_payloads == 5

        # Wait for the pipeline to drain (includes repair re-validation audits).
        for _ in range(200):
            audit = orchestrator.get_audit(state.audit_id)
            if audit and audit.status == AuditStatus.COMPLETED:
                break
            await asyncio.sleep(0.05)

        audit = orchestrator.get_audit(state.audit_id)
        assert audit is not None
        assert len(audit.findings) == 5
        critical = [f for f in audit.findings if f.is_critical]
        assert critical, "expected verified control failures to produce critical findings"
        assert all(f.technique_id for f in audit.findings)
        # Every critical finding should yield a HITL remediation result.
        assert len(audit.remediations) >= len(critical)
        assert all(r.status in {"pr_simulated", "pr_created"} for r in audit.remediations)
        assert audit.status == AuditStatus.COMPLETED
        assert len(audit.verification_sessions) == 5
        assert all(s.status.value in {"completed", "error"} for s in audit.verification_sessions)
        assert all(len(s.steps) > 0 for s in audit.verification_sessions)
    finally:
        await orchestrator.stop()


def test_telemetry_status_offline():
    orchestrator = Orchestrator(get_settings())
    status = orchestrator.telemetry_status
    assert status["minimax_enabled"] is False
    assert status["browserbase_live"] is False
