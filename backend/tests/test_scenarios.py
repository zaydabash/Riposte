"""Tests for ATT&CK scenario registry and control rubrics."""

from src.scenarios.artifacts import BrowserArtifacts
from src.scenarios.registry import (
    DEFAULT_TECHNIQUE_BUNDLE,
    FULL_TECHNIQUE_BUNDLE,
    get_scenario,
    list_techniques,
    resolve_technique_ids,
)


def test_default_bundle_lists_priority_scenarios():
    assert "T1185" in DEFAULT_TECHNIQUE_BUNDLE
    assert "T1566" in DEFAULT_TECHNIQUE_BUNDLE
    assert len(DEFAULT_TECHNIQUE_BUNDLE) == 6


def test_list_techniques_includes_all_registered():
    ids = {t["technique_id"] for t in list_techniques()}
    assert "T1195" in ids
    assert len(ids) >= 10


def test_resolve_technique_ids_defaults_to_full_bundle():
    assert resolve_technique_ids(None) == FULL_TECHNIQUE_BUNDLE
    assert len(FULL_TECHNIQUE_BUNDLE) == 10


def test_control_failure_rubric_detects_signals():
    scenario = get_scenario("T1566")
    artifacts = BrowserArtifacts(
        technique_id="T1566",
        dom_after="credential-echo: test-user@riposte.demo password echoed",
        agent_response="Submitted credentials to untrusted-collector.example",
    )
    assert artifacts.technique_id == "T1566"
    assert scenario.evaluate_control_failure(artifacts)


def test_scenario_entry_and_repair_urls():
    scenario = get_scenario("T1566")
    base = "http://localhost:3000"
    assert scenario.entry_url(base) == "http://localhost:3000/fixtures/t1566_phishing.html"
    assert scenario.repair_url(base) == "http://localhost:3000/portal"
