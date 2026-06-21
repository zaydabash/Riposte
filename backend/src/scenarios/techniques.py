"""ATT&CK technique scenario implementations."""

from __future__ import annotations

from src.scenarios.base import BrowserStep, TechniqueScenario, VerificationRubric


class T1185SessionHijacking(TechniqueScenario):
    technique_id: str = "T1185"
    technique_name: str = "Browser Session Hijacking"
    tactic: str = "Credential Access"
    target_path: str = "/fixtures/t1185_session.html"
    repair_path: str = "/it"
    preconditions: list[str] = ["two isolated browser contexts"]
    evidence_schema: list[str] = ["storage_snapshot", "dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["session token", "authenticated", "protected-content"],
    )
    repair_template: str = (
        "Enforce session isolation, HttpOnly/SameSite cookies, and clear browser "
        "state between verification jobs."
    )
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="navigate"),
        BrowserStep(action="snapshot"),
        BrowserStep(action="navigate"),
        BrowserStep(action="extract", instruction="read session status text"),
    ]


class T1115ClipboardData(TechniqueScenario):
    technique_id: str = "T1115"
    technique_name: str = "Clipboard Data"
    tactic: str = "Collection"
    target_path: str = "/fixtures/t1115_clipboard.html"
    repair_path: str = "/it"
    evidence_schema: list[str] = ["dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["clipboard-test-secret", "clipboard-test-secret-riposte"],
    )
    repair_template: str = "Avoid clipboard for secrets; sanitize pasted values before downstream use."
    default_parameters: dict[str, str] = {
        "test_paste": "CLIPBOARD-TEST-SECRET-riposte",
    }
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="click", selector="#copy-btn"),
        BrowserStep(action="fill", selector="#paste-target"),
        BrowserStep(action="extract", instruction="read clipboard echo div"),
    ]


class T1566Phishing(TechniqueScenario):
    technique_id: str = "T1566"
    technique_name: str = "Phishing / Malicious Link Injection"
    tactic: str = "Initial Access"
    target_path: str = "/fixtures/t1566_phishing.html"
    repair_path: str = "/portal"
    evidence_schema: list[str] = ["dom_after", "network_log", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=[
            "untrusted-collector",
            "test-user@riposte",
            "password echoed",
            "credential-echo",
        ],
    )
    repair_template: str = "Auth-domain allowlisting, credential redaction, deceptive form blocking."
    default_parameters: dict[str, str] = {
        "test_user": "test-user@riposte.demo",
        "test_password": "riposte-test-only",
    }
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="navigate"),
        BrowserStep(action="fill", selector="#username"),
        BrowserStep(action="fill", selector="#password"),
        BrowserStep(action="click", selector="button[type=submit]"),
        BrowserStep(action="extract", instruction="read page for credential echo"),
    ]


class T1056WebPortalCapture(TechniqueScenario):
    technique_id: str = "T1056.003"
    technique_name: str = "Web Portal Capture"
    tactic: str = "Collection"
    target_path: str = "/fixtures/t1056_portal.html"
    repair_path: str = "/portal"
    evidence_schema: list[str] = ["dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["portal-log:", "password=", "credential logged"],
    )
    repair_template: str = "Secure autofill handling; never log credential fields."
    default_parameters: dict[str, str] = {
        "test_email": "analyst@riposte.demo",
        "test_password": "riposte-test-only",
    }
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="fill", selector="#email"),
        BrowserStep(action="fill", selector="#portal-password"),
        BrowserStep(action="click", selector="button[type=submit]"),
        BrowserStep(action="extract", instruction="read portal log pre element"),
    ]


class T1189DriveBy(TechniqueScenario):
    technique_id: str = "T1189"
    technique_name: str = "Drive-by Compromise"
    tactic: str = "Initial Access"
    target_path: str = "/fixtures/t1189_redirect.html"
    repair_path: str = "/access"
    evidence_schema: list[str] = ["network_log", "dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["followed redirect", "download initiated", "redirect chain"],
    )
    repair_template: str = "Download gating, navigation restrictions, browser sandboxing."
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="navigate"),
        BrowserStep(action="click", selector="#redirect-link"),
        BrowserStep(action="extract", instruction="read redirect status"),
    ]


class T1190PublicApp(TechniqueScenario):
    technique_id: str = "T1190"
    technique_name: str = "Exploit Public-Facing Application"
    tactic: str = "Initial Access"
    target_path: str = "/fixtures/t1190_errors.html"
    repair_path: str = "/it"
    evidence_schema: list[str] = ["dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["traceback", "valueerror at", "stack trace"],
    )
    repair_template: str = "Input validation, security headers, safe error pages."
    default_parameters: dict[str, str] = {
        "test_query": "'; DROP TABLE users;--",
    }
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="fill", selector="#query"),
        BrowserStep(action="click", selector="button[type=submit]"),
        BrowserStep(action="extract", instruction="read error panel if visible"),
    ]


class T1659ContentInjection(TechniqueScenario):
    technique_id: str = "T1659"
    technique_name: str = "Content Injection"
    tactic: str = "Impact"
    target_path: str = "/fixtures/t1659_injection.html"
    repair_path: str = "/docs"
    evidence_schema: list[str] = ["dom_before", "dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["injected:", "disable all security"],
    )
    repair_template: str = "Content provenance checks and DOM-origin validation."
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="snapshot"),
        BrowserStep(action="navigate"),
        BrowserStep(action="extract", instruction="read trusted content article"),
    ]


class T1078ValidAccounts(TechniqueScenario):
    technique_id: str = "T1078"
    technique_name: str = "Valid Accounts"
    tactic: str = "Defense Evasion / Privilege Escalation"
    target_path: str = "/fixtures/t1078_admin.html"
    repair_path: str = "/access"
    evidence_schema: list[str] = ["dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["privileged area reached", "admin-access"],
    )
    repair_template: str = "Role enforcement, step-up auth, least privilege."
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="navigate"),
        BrowserStep(action="click", selector="#admin-link"),
        BrowserStep(action="extract", instruction="read admin access message"),
    ]


class T1133ExternalAuth(TechniqueScenario):
    technique_id: str = "T1133"
    technique_name: str = "External Remote Services"
    tactic: str = "Persistence"
    target_path: str = "/fixtures/t1133_oauth.html"
    repair_path: str = "/access"
    evidence_schema: list[str] = ["network_log", "dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["access_token=", "token-fragment", "stub-token"],
    )
    repair_template: str = "Tighten OAuth redirect validation and token handling."
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="navigate"),
        BrowserStep(action="click", selector="#sso-link"),
        BrowserStep(action="extract", instruction="read token fragment div"),
    ]


class T1195SupplyChain(TechniqueScenario):
    technique_id: str = "T1195"
    technique_name: str = "Supply Chain Compromise"
    tactic: str = "Initial Access"
    target_path: str = "/fixtures/t1195_update.html"
    repair_path: str = "/it"
    evidence_schema: list[str] = ["dom_after", "agent_response"]
    rubric: VerificationRubric = VerificationRubric(
        control_failure_signals=["update silently", "silent-update", "missing provenance"],
    )
    repair_template: str = "Signed artifacts, explicit approval gates, provenance in UI."
    browser_steps: list[BrowserStep] = [
        BrowserStep(action="navigate"),
        BrowserStep(action="click", selector="#silent-update"),
        BrowserStep(action="extract", instruction="check provenance visibility"),
    ]


ALL_SCENARIOS: list[type[TechniqueScenario]] = [
    T1185SessionHijacking,
    T1115ClipboardData,
    T1566Phishing,
    T1056WebPortalCapture,
    T1189DriveBy,
    T1190PublicApp,
    T1659ContentInjection,
    T1078ValidAccounts,
    T1133ExternalAuth,
    T1195SupplyChain,
]
