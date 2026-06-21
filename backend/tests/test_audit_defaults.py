import pytest

from src.core.audit_defaults import derive_target_name


def test_derive_target_name_from_explicit():
    assert derive_target_name("https://x.com", "My Bot") == "My Bot"


def test_derive_target_name_from_hostname():
    assert derive_target_name("https://staging.example.com/chat", None) == "staging.example.com"


def test_derive_target_name_fallback():
    assert derive_target_name("not-a-url", None) == "audit-target"
