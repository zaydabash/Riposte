import asyncio

import pytest

import src.repositories.vector_repo as vector_repo_mod
from src.config import get_settings
from src.core.models import AuditRequest, AuditStatus, RemediationResult, VerificationResult
from src.scenarios.artifacts import BrowserArtifacts
from src.scenarios.registry import get_scenario
from src.services.orchestrator import Orchestrator
from src.workers.patch_worker import RemediationRunner
from src.workers.verification_worker import VerificationRunner


@pytest.mark.asyncio
async def test_full_pipeline(monkeypatch):
    # Avoid any Redis network usage during the e2e run.
    monkeypatch.setattr(vector_repo_mod, "redis", None)

    async def fake_verify(self, task, on_progress=None):
        scenario = get_scenario(task.technique_id)
        artifacts = BrowserArtifacts(
            technique_id=task.technique_id,
            dom_after="credential-echo: test-user@riposte.demo password echoed",
            agent_response="Submitted credentials to untrusted-collector.example",
        )
        return VerificationResult(
            audit_id=task.audit_id,
            task_id=task.task_id,
            technique_id=task.technique_id,
            payload=f"{task.technique_id}: {scenario.technique_name}",
            response=artifacts.agent_response,
            repo_url=task.repo_url,
            live=True,
            verification_status="fail",
            control_failed=True,
            artifacts=artifacts,
            verification_mode=task.verification_mode,
            baseline_run_id=task.baseline_run_id,
        )

    async def fake_remediation(self, task):
        return RemediationResult(
            audit_id=task.audit_id,
            repo_url=task.repo_url,
            payload=task.payload,
            aries_score=task.aries_score,
            status="unavailable",
            detail="Claude Code not configured in test environment.",
            technique_id=task.technique_id,
            baseline_run_id=task.baseline_run_id,
        )

    monkeypatch.setattr(VerificationRunner, "run", fake_verify)
    monkeypatch.setattr(RemediationRunner, "run", fake_remediation)

    settings = get_settings()
    orchestrator = Orchestrator(settings)
    await orchestrator.start()
    try:
        request = AuditRequest(
            target_name="Demo Bot",
            target_endpoint="https://target-agent.example.com",
            source_repository="https://github.com/target/bot",
            max_payloads=10,
        )
        state = await orchestrator.submit_audit(request)
        assert state.queued_payloads == 10

        # Wait for the pipeline to drain (includes repair re-validation audits).
        for _ in range(200):
            audit = orchestrator.get_audit(state.audit_id)
            if audit and audit.status == AuditStatus.COMPLETED:
                break
            await asyncio.sleep(0.05)

        audit = orchestrator.get_audit(state.audit_id)
        assert audit is not None
        assert len(audit.findings) == 10
        critical = [f for f in audit.findings if f.is_critical]
        assert critical, "expected verified control failures to produce critical findings"
        assert all(f.technique_id for f in audit.findings)
        assert len(audit.remediations) >= len(critical)
        assert all(
            r.status in {"unavailable", "pr_created", "failed"} for r in audit.remediations
        )
        assert audit.status == AuditStatus.COMPLETED
        assert len(audit.verification_sessions) == 10
        assert all(s.status.value in {"completed", "error"} for s in audit.verification_sessions)
        assert all(len(s.steps) > 0 for s in audit.verification_sessions)
    finally:
        await orchestrator.stop()


def test_telemetry_status_without_integrations():
    orchestrator = Orchestrator(get_settings())
    status = orchestrator.telemetry_status
    assert status["minimax_enabled"] is False
    assert status["browserbase_live"] is False
    assert status["verification_live_ready"] is False
