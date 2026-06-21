"""Domain models shared across layers.

Repositories and services exchange these strongly-typed Pydantic models rather
than raw dicts or DB arrays (per the project's DDD rules).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

from src.scenarios.artifacts import BrowserArtifacts


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex


class InterfaceType(str, Enum):
    WEB_UI = "web-ui"


class AuditStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Severity(str, Enum):
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class VerificationMode(str, Enum):
    CONTINUOUS = "continuous"
    REPAIR_VALIDATION = "repair_validation"


class VerificationStepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"


class VerificationSessionStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    ERROR = "error"


class VerificationStepLog(BaseModel):
    """One declarative browser step in a verification session console."""

    index: int
    action: str
    label: str
    status: VerificationStepStatus = VerificationStepStatus.PENDING
    detail: str | None = None


class VerificationSession(BaseModel):
    """Live Browserbase session projection for the dashboard console."""

    task_id: str
    technique_id: str
    technique_name: str
    status: VerificationSessionStatus = VerificationSessionStatus.QUEUED
    live: bool = False
    session_id: str | None = None
    current_step_index: int = 0
    steps: list[VerificationStepLog] = Field(default_factory=list)
    agent_response: str | None = None
    dom_after: str | None = None
    verification_status: Literal["pass", "fail", "error"] | None = None
    error: str | None = None
    started_at: datetime | None = None
    updated_at: datetime = Field(default_factory=_now)


class FuzzSession(BaseModel):
    """Live projection of one fuzzer-generated target probe."""

    task_id: str
    seed: str
    target_url: str
    status: Literal["queued", "optimizing", "attacking", "evaluating", "completed", "error"] = "queued"
    generated_payload: str | None = None
    initial_loss: float | None = None
    final_loss: float | None = None
    response: str | None = None
    error: str | None = None
    updated_at: datetime = Field(default_factory=_now)


class AuditRequest(BaseModel):
    """Incoming audit configuration (API boundary)."""

    target_name: str = Field(..., min_length=1, max_length=200)
    target_endpoint: HttpUrl
    source_repository: HttpUrl
    interface_type: InterfaceType = InterfaceType.WEB_UI
    max_payloads: int = Field(default=10, ge=1, le=50)
    technique_ids: list[str] = Field(default_factory=list)
    verification_mode: VerificationMode = VerificationMode.CONTINUOUS
    baseline_run_id: str | None = None
    private_corpus: list[str] = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Proprietary documents the target must not disclose.",
    )
    benign_baseline: list[str] = Field(
        ...,
        min_length=2,
        max_length=500,
        description="On-topic benign responses used to fit the anomaly baseline.",
    )
    fuzz_seeds: list[str] = Field(
        default_factory=list,
        max_length=50,
        description="Optional adversarial seed prompts; derived from private_corpus when empty.",
    )


class ScenarioTask(BaseModel):
    """One ATT&CK verification scenario queued for parameter mutation and execution."""

    audit_id: str
    technique_id: str
    target_url: str
    repo_url: str
    parameters: dict[str, str] = Field(default_factory=dict)
    verification_mode: VerificationMode = VerificationMode.CONTINUOUS
    baseline_run_id: str | None = None
    task_id: str = Field(default_factory=_new_id)


class FuzzTask(BaseModel):
    """Legacy alias — scenario planning hands off via ScenarioTask."""

    audit_id: str
    target_url: str
    repo_url: str
    seed: str
    task_id: str = Field(default_factory=_new_id)


class TargetResponse(BaseModel):
    """A target's reply, optionally carrying token log-probabilities."""

    text: str
    logprobs: list[float] | None = None


class AttackTask(BaseModel):
    """A single payload queued for injection against a target."""

    audit_id: str
    target_url: str
    payload: str
    repo_url: str
    task_id: str = Field(default_factory=_new_id)


class AttackResult(BaseModel):
    """Raw outcome of injecting one payload (Phase 2 output)."""

    audit_id: str
    task_id: str
    payload: str
    response: str
    repo_url: str
    target_url: str | None = None
    live: bool = False
    error: str | None = None


class VerificationResult(BaseModel):
    """Outcome of one ATT&CK browser verification run (Phase 2 output)."""

    audit_id: str
    task_id: str
    technique_id: str
    payload: str
    response: str
    repo_url: str
    target_url: str | None = None
    live: bool = False
    verification_status: Literal["pass", "fail", "error"] = "pass"
    control_failed: bool = False
    artifacts: BrowserArtifacts
    error: str | None = None
    verification_mode: VerificationMode = VerificationMode.CONTINUOUS
    baseline_run_id: str | None = None


class AriesComponents(BaseModel):
    """The four calibrated sub-scores feeding the composite ARiES score."""

    M: float = Field(..., description="PCA-reduced Mahalanobis empirical percentile")
    L: float = Field(..., description="Composite semantic leakage score")
    A: float = Field(..., description="Adversarial attack-success score")
    J: float = Field(..., description="Ensemble LLM-judge score")


class Finding(BaseModel):
    """A fully evaluated verification outcome — the unit the dashboard renders."""

    audit_id: str
    task_id: str
    payload: str
    response: str
    repo_url: str
    target_url: str | None = None
    aries_score: float
    components: AriesComponents
    severity: Severity
    is_critical: bool
    leaked_documents: list[str] = Field(default_factory=list)
    technique_id: str | None = None
    artifacts_summary: str | None = None
    control_failed: bool = False
    recommended_controls: list[str] = Field(default_factory=list)
    detail: str | None = None
    created_at: datetime = Field(default_factory=_now)


class RemediationTask(BaseModel):
    """A critical finding handed off to Claude Code for a HITL patch."""

    audit_id: str
    repo_url: str
    target_url: str | None = None
    payload: str
    aries_score: float
    technique_id: str | None = None
    baseline_run_id: str | None = None
    task_id: str = Field(default_factory=_new_id)


class RemediationResult(BaseModel):
    """Outcome of a Claude Code remediation run."""

    audit_id: str
    repo_url: str
    target_url: str | None = None
    payload: str
    aries_score: float
    status: str
    pr_url: str | None = None
    detail: str | None = None
    validation_status: str | None = None
    baseline_run_id: str | None = None
    technique_id: str | None = None
    created_at: datetime = Field(default_factory=_now)


class AuditState(BaseModel):
    """Live, mutable-via-replacement view of an audit's progress."""

    audit_id: str = Field(default_factory=_new_id)
    target_name: str
    target_endpoint: str
    source_repository: str
    status: AuditStatus = AuditStatus.QUEUED
    queued_payloads: int = 0
    technique_ids: list[str] = Field(default_factory=list)
    verification_mode: VerificationMode = VerificationMode.CONTINUOUS
    baseline_run_id: str | None = None
    findings: list[Finding] = Field(default_factory=list)
    remediations: list[RemediationResult] = Field(default_factory=list)
    verification_sessions: list[VerificationSession] = Field(default_factory=list)
    fuzz_sessions: list[FuzzSession] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
