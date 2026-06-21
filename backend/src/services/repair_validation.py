"""Post-remediation re-verification against baseline runs."""

from __future__ import annotations

import logging

from src.core.models import (
    AuditRequest,
    Finding,
    RemediationResult,
    VerificationMode,
)

logger = logging.getLogger(__name__)


class RepairValidationService:
    """Builds repair-validation audit requests and compares outcomes."""

    def build_revalidation_request(
        self,
        remediation: RemediationResult,
        target_name: str,
        target_endpoint: str,
        source_repository: str,
        technique_ids: list[str],
    ) -> AuditRequest:
        return AuditRequest(
            target_name=f"{target_name} (repair validation)",
            target_endpoint=target_endpoint,  # type: ignore[arg-type]
            source_repository=source_repository,  # type: ignore[arg-type]
            technique_ids=technique_ids,
            verification_mode=VerificationMode.REPAIR_VALIDATION,
            baseline_run_id=remediation.audit_id,
            max_payloads=len(technique_ids),
        )

    def compare_to_baseline(
        self,
        baseline_findings: list[Finding],
        revalidation_findings: list[Finding],
        technique_id: str | None,
    ) -> str:
        """Return validation_status: validated | failed | pending."""
        baseline = [
            f for f in baseline_findings if not technique_id or f.technique_id == technique_id
        ]
        current = [
            f for f in revalidation_findings if not technique_id or f.technique_id == technique_id
        ]
        if not current:
            return "pending"
        baseline_failed = any(f.control_failed for f in baseline)
        if not baseline_failed:
            return "validated"
        still_failing = any(f.control_failed for f in current)
        return "failed" if still_failing else "validated"
