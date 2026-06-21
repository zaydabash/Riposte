"""Test bootstrap: neutralize external integrations for unit tests.

Environment variables take precedence over the local ``.env`` file in
pydantic-settings, so setting these to empty disables the real MiniMax /
Sentry / Browserbase / Redis credentials during testing.
"""

import os

_OFFLINE_ENV = {
    "MINIMAX_API_KEY": "",
    "MINIMAX_GROUP_ID": "",
    "SENTRY_DSN": "",
    "BROWSERBASE_API_KEY": "",
    "BROWSERBASE_PROJECT_ID": "",
    "ANTHROPIC_API_KEY": "",
    "GITHUB_TOKEN": "",
    "REDIS_URL": "redis://localhost:6379/0",
    "SCENARIO_WORKERS": "2",
    "VERIFICATION_WORKERS": "2",
    "EVAL_WORKERS": "2",
    "REMEDIATION_WORKERS": "1",
}

for key, value in _OFFLINE_ENV.items():
    os.environ[key] = value

# Ensure any cached settings reflect the offline environment.
from src.config import get_settings  # noqa: E402

get_settings.cache_clear()
