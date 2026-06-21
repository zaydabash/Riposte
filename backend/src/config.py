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
    claude_model_id: str = Field(default="claude-3-opus-20240229", alias="CLAUDE_MODEL_ID")

    # --- MiniMax (fuzzer + ensemble judge) ---
    minimax_api_key: str | None = Field(default=None, alias="MINIMAX_API_KEY")
    minimax_base_url: str = Field(
        default="https://api.tokenrouter.com/v1", alias="MINIMAX_BASE_URL"
    )
    minimax_model: str = Field(default="MiniMax-M3", alias="MINIMAX_MODEL")
    minimax_embedding_model: str = Field(default="embo-01", alias="MINIMAX_EMBEDDING_MODEL")
    # Native MiniMax embeddings may require GroupId. TokenRouter's OpenAI-compatible
    # route does not, so this is optional metadata instead of an enablement gate.
    minimax_group_id: str | None = Field(default=None, alias="MINIMAX_GROUP_ID")
    embedding_backend: str = Field(default="local", alias="EMBEDDING_BACKEND")
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

    # --- Sentry (distributed error telemetry) ---
    sentry_dsn: str | None = Field(default=None, alias="SENTRY_DSN")

    # --- Redis (vector DB + agent memory) ---
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # --- GitHub (HITL remediation PRs) ---
    github_token: str | None = Field(default=None, alias="GITHUB_TOKEN")

    # --- Pipeline knobs ---
    max_concurrent_sessions: int = Field(default=15, alias="MAX_CONCURRENT_SESSIONS")
    fuzzer_workers: int = Field(default=2, alias="FUZZER_WORKERS")
    offensive_workers: int = Field(default=3, alias="OFFENSIVE_WORKERS")
    eval_workers: int = Field(default=2, alias="EVAL_WORKERS")
    remediation_workers: int = Field(default=1, alias="REMEDIATION_WORKERS")
    default_max_techniques: int = Field(default=10, alias="DEFAULT_MAX_TECHNIQUES")
    default_max_fuzz_seeds: int = Field(default=5, alias="DEFAULT_MAX_FUZZ_SEEDS")

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
    aries_weight_m: float = Field(default=0.35, alias="ARIES_WEIGHT_M")
    aries_weight_l: float = Field(default=0.35, alias="ARIES_WEIGHT_L")
    aries_weight_a: float = Field(default=0.20, alias="ARIES_WEIGHT_A")
    aries_weight_j: float = Field(default=0.10, alias="ARIES_WEIGHT_J")
    aries_leak_doc_threshold: float = Field(
        default=50.0, alias="ARIES_LEAK_DOC_THRESHOLD"
    )
    aries_severity_high_threshold: float = Field(
        default=55.0, alias="ARIES_SEVERITY_HIGH_THRESHOLD"
    )
    aries_severity_medium_threshold: float = Field(
        default=35.0, alias="ARIES_SEVERITY_MEDIUM_THRESHOLD"
    )
    aries_severity_low_threshold: float = Field(
        default=15.0, alias="ARIES_SEVERITY_LOW_THRESHOLD"
    )
    aries_control_pass_a_cap: float = Field(
        default=15.0, alias="ARIES_CONTROL_PASS_A_CAP"
    )
    minimax_judge_ensemble_size: int = Field(
        default=3, alias="MINIMAX_JUDGE_ENSEMBLE_SIZE"
    )
    max_input_chars: int = Field(default=20000, alias="MAX_INPUT_CHARS")
    max_dashboard_field_chars: int = Field(
        default=2000, alias="MAX_DASHBOARD_FIELD_CHARS"
    )
    max_error_detail_chars: int = Field(default=500, alias="MAX_ERROR_DETAIL_CHARS")

    # --- HTTP / integration timeouts ---
    anthropic_http_timeout: float = Field(default=60.0, alias="ANTHROPIC_HTTP_TIMEOUT")
    claude_max_tokens: int = Field(default=4000, alias="CLAUDE_MAX_TOKENS")
    claude_temperature: float = Field(default=0.2, alias="CLAUDE_TEMPERATURE")
    minimax_http_timeout: float = Field(default=20.0, alias="MINIMAX_HTTP_TIMEOUT")
    redis_socket_timeout: float = Field(default=3.0, alias="REDIS_SOCKET_TIMEOUT")
    github_http_timeout: float = Field(default=30.0, alias="GITHUB_HTTP_TIMEOUT")
    worker_task_timeout: float = Field(default=300.0, alias="WORKER_TASK_TIMEOUT")
    github_default_branch: str = Field(default="main", alias="GITHUB_DEFAULT_BRANCH")
    sentry_traces_sample_rate: float = Field(
        default=1.0, alias="SENTRY_TRACES_SAMPLE_RATE"
    )
    cors_allowed_origins: str = Field(default="*", alias="CORS_ALLOWED_ORIGINS")

    # --- Continuous verification plane ---
    scenario_workers: int = Field(default=2, alias="SCENARIO_WORKERS")
    verification_workers: int = Field(default=3, alias="VERIFICATION_WORKERS")

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_allowed_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

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
