"""ATT&CK technique scenario definitions for continuous verification."""

from __future__ import annotations

from urllib.parse import urljoin

from pydantic import BaseModel, Field

from src.scenarios.artifacts import BrowserArtifacts, NetworkEntry, StorageSnapshot


class VerificationRubric(BaseModel):
    """Pass/fail criteria for a technique scenario."""

    control_failure_signals: list[str] = Field(default_factory=list)


class BrowserStep(BaseModel):
    """Declarative browser action (no exploit code — controlled test steps)."""

    action: str  # navigate | fill | click | extract | wait | snapshot
    selector: str | None = None
    value: str | None = None
    instruction: str | None = None


def describe_browser_step(step: BrowserStep) -> str:
    """Human-readable label for dashboard console output."""
    if step.action == "navigate":
        return "Navigate to target"
    if step.action == "snapshot":
        return "Capture DOM snapshot (before)"
    if step.action == "fill" and step.selector:
        return f"Fill field {step.selector}"
    if step.action == "click" and step.selector:
        return f"Click {step.selector}"
    if step.action == "extract":
        return step.instruction or "Extract page evidence"
    if step.action == "wait":
        return "Wait for page settle"
    return step.action


class TechniqueScenario(BaseModel):
    """One ATT&CK-mapped verification scenario."""

    technique_id: str
    technique_name: str
    tactic: str
    preconditions: list[str] = Field(default_factory=list)
    evidence_schema: list[str] = Field(default_factory=list)
    rubric: VerificationRubric = Field(default_factory=VerificationRubric)
    repair_template: str = ""
    target_path: str = "/"
    repair_path: str = "/"
    default_parameters: dict[str, str] = Field(default_factory=dict)
    browser_steps: list[BrowserStep] = Field(default_factory=list)
    requires_dual_session: bool = False

    def entry_url(self, base_url: str) -> str:
        """Browser fixture URL for live verification."""
        return urljoin(base_url.rstrip("/") + "/", self.target_path.lstrip("/"))

    def repair_url(self, base_url: str) -> str:
        """Hub page URL used to route remediation patches to source files."""
        return urljoin(base_url.rstrip("/") + "/", self.repair_path.lstrip("/"))

    def evaluate_control_failure(self, artifacts: BrowserArtifacts) -> bool:
        """Return True when verification controls failed (risk exposed)."""
        text = " ".join(
            [
                artifacts.dom_after.lower(),
                artifacts.agent_response.lower(),
                " ".join(e.url.lower() for e in artifacts.network_log),
            ]
        )
        return any(sig.lower() in text for sig in self.rubric.control_failure_signals)
