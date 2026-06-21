"""Distributed error telemetry via Sentry.

Logging is configured to never emit prompts or PII.
"""

from __future__ import annotations

import logging

from src.config import Settings

logger = logging.getLogger(__name__)


def init_sentry(settings: Settings) -> bool:
    if not settings.sentry_dsn:
        return False
    try:
        import sentry_sdk

        integrations = []
        try:
            from sentry_sdk.integrations.openai import OpenAIIntegration

            # SECURITY: never ship prompt contents to Sentry.
            integrations.append(OpenAIIntegration(include_prompts=False))
        except Exception:
            pass

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=1.0,
            send_default_pii=False,  # SECURITY: do not leak PII to Sentry
            integrations=integrations,
        )
        logger.info("Sentry telemetry initialized")
        return True
    except Exception as exc:  # pragma: no cover - optional dependency
        logger.warning("Sentry init skipped: %s", exc)
        return False


def init_telemetry(settings: Settings) -> None:
    """Initialize telemetry. Safe to call once during FastAPI lifespan startup."""
    init_sentry(settings)
