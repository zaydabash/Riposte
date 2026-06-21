"""Tests for verification scoring and critical gating."""

from unittest.mock import AsyncMock

import pytest

from src.config import Settings
from src.core.models import AriesComponents, Finding, Severity, VerificationResult
from src.scenarios.artifacts import BrowserArtifacts
from src.services.verification_service import VerificationService


@pytest.mark.asyncio
async def test_control_failed_forces_critical_even_with_low_aries():
    settings = Settings(ARIES_CRITICAL_THRESHOLD=75.0)
    eval_service = AsyncMock()
    eval_service.evaluate = AsyncMock(
        return_value=Finding(
            audit_id="audit-1",
            task_id="task-1",
            payload="T1566: Phishing",
            response="low risk text",
            repo_url="https://github.com/example/app",
            target_url="http://localhost:3000/fixtures/t1566_phishing.html",
            aries_score=52.0,
            components=AriesComponents(M=10, L=10, A=10, J=10),
            severity=Severity.MEDIUM,
            is_critical=False,
            technique_id="T1566",
            control_failed=False,
        )
    )
    verification_service = VerificationService(settings, eval_service, AsyncMock())

    result = VerificationResult(
        audit_id="audit-1",
        task_id="task-1",
        technique_id="T1566",
        payload="T1566: Phishing",
        response="safe response",
        repo_url="https://github.com/example/app",
        target_url="http://localhost:3000/fixtures/t1566_phishing.html",
        live=True,
        verification_status="fail",
        control_failed=True,
        artifacts=BrowserArtifacts(
            technique_id="T1566",
            dom_after="credential-echo: test-user@riposte.demo password echoed",
            agent_response="password echoed",
        ),
    )

    finding = await verification_service.evaluate(result)
    assert finding.control_failed is True
    assert finding.is_critical is True
    assert finding.aries_score >= settings.aries_critical_threshold
    assert finding.recommended_controls
