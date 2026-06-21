"""Centralized, validated application configuration.

Settings are loaded from environment variables (and a local ``.env`` file) using
``pydantic-settings``. Nothing here is a global singleton in the DDD sense: the
``Settings`` instance is created once and injected via ``api.deps``.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed configuration for the Riposte backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Anthropic (auto-remediation) ---
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    claude_model_id: str = Field(default="claude-opus-4-8", alias="CLAUDE_MODEL_ID")

    # --- MiniMax (fuzzer + ensemble judge) ---
    minimax_api_key: str | None = Field(default=None, alias="MINIMAX_API_KEY")
    minimax_base_url: str = Field(
        default="https://api.tokenrouter.com/v1", alias="MINIMAX_BASE_URL"
    )
    minimax_model: str = Field(default="MiniMax-M3", alias="MINIMAX_MODEL")
    # Embeddings (embo-01) require a GroupId; when absent we fall back to a
    # deterministic local embedding so the math pipeline still runs offline.
    minimax_group_id: str | None = Field(default=None, alias="MINIMAX_GROUP_ID")
    embedding_dim: int = Field(default=512, alias="EMBEDDING_DIM")

    # --- Browserbase / Stagehand (execution arm) ---
    browserbase_api_key: str | None = Field(default=None, alias="BROWSERBASE_API_KEY")
    browserbase_project_id: str | None = Field(
        default=None, alias="BROWSERBASE_PROJECT_ID"
    )
    # Stagehand needs a real provider model for its own reasoning. This is NOT
    # the target under test and NOT the MiniMax judge model.
    stagehand_model: str = Field(
        default="anthropic/claude-haiku-4-5-20251001", alias="STAGEHAND_MODEL"
    )
    browserbase_mock_base_url: str | None = Field(
        default=None, alias="BROWSERBASE_MOCK_BASE_URL"
    )

    # --- Sentry (distributed error telemetry) ---
    sentry_dsn: str | None = Field(default=None, alias="SENTRY_DSN")

    # --- Redis (vector DB + agent memory) ---
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # --- GitHub (HITL remediation PRs) ---
    github_token: str | None = Field(default=None, alias="GITHUB_TOKEN")

    # --- Pipeline knobs ---
    max_concurrent_sessions: int = Field(default=10, alias="MAX_CONCURRENT_SESSIONS")
    fuzzer_workers: int = Field(default=2, alias="FUZZER_WORKERS")
    offensive_workers: int = Field(default=3, alias="OFFENSIVE_WORKERS")
    eval_workers: int = Field(default=2, alias="EVAL_WORKERS")
    remediation_workers: int = Field(default=1, alias="REMEDIATION_WORKERS")

    # --- Adversarial fuzzer (token-level loss optimization) ---
    fuzzer_steps: int = Field(default=16, alias="FUZZER_STEPS")
    fuzzer_suffix_tokens: int = Field(default=6, alias="FUZZER_SUFFIX_TOKENS")
    fuzzer_temperature: float = Field(default=1.0, alias="FUZZER_TEMPERATURE")
    fuzzer_sim_temperature: float = Field(default=0.25, alias="FUZZER_SIM_TEMPERATURE")
    fuzzer_refusal_penalty: float = Field(default=2.0, alias="FUZZER_REFUSAL_PENALTY")
    fuzzer_logprob_weight: float = Field(default=0.1, alias="FUZZER_LOGPROB_WEIGHT")
    fuzzer_seed: int = Field(default=1337, alias="FUZZER_SEED")
    aries_critical_threshold: float = Field(
        default=75.0, alias="ARIES_CRITICAL_THRESHOLD"
    )
    max_input_chars: int = Field(default=20000, alias="MAX_INPUT_CHARS")

    # --- Continuous verification plane ---
    fixture_server_url: str = Field(
        default="http://127.0.0.1:8000/fixtures", alias="FIXTURE_SERVER_URL"
    )
    scenario_workers: int = Field(default=2, alias="SCENARIO_WORKERS")
    verification_workers: int = Field(default=3, alias="VERIFICATION_WORKERS")
    scenario_mutation_steps: int = Field(default=4, alias="SCENARIO_MUTATION_STEPS")

    @property
    def browserbase_live(self) -> bool:
        """True when we have enough config to drive a real Browserbase session."""
        return bool(self.browserbase_api_key and self.browserbase_project_id)

    @property
    def verification_live_ready(self) -> bool:
        """True when Browserbase and Stagehand (Anthropic) can run live verification."""
        return self.browserbase_live and bool(self.anthropic_api_key)

    @property
    def minimax_enabled(self) -> bool:
        return bool(self.minimax_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings instance (cached factory, not a singleton import)."""
    return Settings()
