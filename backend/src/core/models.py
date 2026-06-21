"""Domain models shared across layers.

Repositories and services exchange these strongly-typed Pydantic models rather
than raw dicts or DB arrays (per the project's DDD rules).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, HttpUrl


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


class AuditRequest(BaseModel):
    """Incoming audit configuration (API boundary)."""

    target_name: str = Field(..., min_length=1, max_length=200)
    target_endpoint: HttpUrl
    source_repository: HttpUrl
    interface_type: InterfaceType = InterfaceType.WEB_UI
    max_payloads: int = Field(default=5, ge=1, le=50)


class FuzzTask(BaseModel):
    """A seed handed to the Phase-1 fuzzer to optimize into an adversarial payload."""

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
    live: bool = False
    error: str | None = None


class AriesComponents(BaseModel):
    """The four calibrated sub-scores feeding the composite ARiES score."""

    M: float = Field(..., description="PCA-reduced Mahalanobis empirical percentile")
    L: float = Field(..., description="Composite semantic leakage score")
    A: float = Field(..., description="Adversarial attack-success score")
    J: float = Field(..., description="Ensemble LLM-judge score")


class Finding(BaseModel):
    """A fully evaluated attack — the unit the dashboard renders (Phase 3 output)."""

    audit_id: str
    task_id: str
    payload: str
    response: str
    repo_url: str
    aries_score: float
    components: AriesComponents
    severity: Severity
    is_critical: bool
    leaked_documents: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)


class RemediationTask(BaseModel):
    """A critical finding handed off to Claude Code for a HITL patch."""

    audit_id: str
    repo_url: str
    payload: str
    aries_score: float
    task_id: str = Field(default_factory=_new_id)


class RemediationResult(BaseModel):
    """Outcome of a Claude Code remediation run."""

    audit_id: str
    repo_url: str
    payload: str
    aries_score: float
    status: str
    pr_url: str | None = None
    detail: str | None = None
    created_at: datetime = Field(default_factory=_now)


class AuditState(BaseModel):
    """Live, mutable-via-replacement view of an audit's progress."""

    audit_id: str = Field(default_factory=_new_id)
    target_name: str
    target_endpoint: str
    source_repository: str
    status: AuditStatus = AuditStatus.QUEUED
    queued_payloads: int = 0
    findings: list[Finding] = Field(default_factory=list)
    remediations: list[RemediationResult] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
