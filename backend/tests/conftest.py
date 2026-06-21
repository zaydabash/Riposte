"""Test bootstrap: neutralize all external integrations so the suite runs offline.

Environment variables take precedence over the local ``.env`` file in
pydantic-settings, so setting these to empty disables the real MiniMax / Arize /
Sentry / Browserbase / Redis credentials during testing.
"""

import os

_OFFLINE_ENV = {
    "MINIMAX_API_KEY": "",
    "MINIMAX_GROUP_ID": "",
    "ARIZE_API_KEY": "",
    "ARIZE_SPACE_ID": "",
    "SENTRY_DSN": "",
    "BROWSERBASE_API_KEY": "",
    "BROWSERBASE_PROJECT_ID": "",
    "ANTHROPIC_API_KEY": "",
    "GITHUB_TOKEN": "",
    "PHOENIX_COLLECTOR_ENDPOINT": "",
    "REDIS_URL": "redis://localhost:6379/0",
    "FUZZER_WORKERS": "2",
    "OFFENSIVE_WORKERS": "2",
    "EVAL_WORKERS": "2",
    "REMEDIATION_WORKERS": "1",
    # Keep fuzzing fast and deterministic in tests.
    "FUZZER_STEPS": "6",
    "FUZZER_SUFFIX_TOKENS": "4",
}

for key, value in _OFFLINE_ENV.items():
    os.environ[key] = value

# Ensure any cached settings reflect the offline environment.
from src.config import get_settings  # noqa: E402

get_settings.cache_clear()
