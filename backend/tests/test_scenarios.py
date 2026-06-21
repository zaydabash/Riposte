"""Tests for ATT&CK scenario registry and offline simulation."""

from src.scenarios.registry import DEFAULT_TECHNIQUE_BUNDLE, get_scenario, list_techniques


def test_default_bundle_lists_priority_scenarios():
    assert "T1185" in DEFAULT_TECHNIQUE_BUNDLE
    assert "T1566" in DEFAULT_TECHNIQUE_BUNDLE
    assert len(DEFAULT_TECHNIQUE_BUNDLE) == 6


def test_list_techniques_includes_all_registered():
    ids = {t["technique_id"] for t in list_techniques()}
    assert "T1195" in ids
    assert len(ids) >= 10


def test_offline_simulation_produces_artifacts():
    scenario = get_scenario("T1566")
    artifacts = scenario.simulate_offline({})
    assert artifacts.technique_id == "T1566"
    assert scenario.evaluate_control_failure(artifacts)
