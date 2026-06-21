"""Distributed telemetry: Arize AX (or Phoenix fallback) tracing + Sentry errors.

Tracing prefers Arize AX when ``ARIZE_API_KEY`` / ``ARIZE_SPACE_ID`` are set
(matching the deployment ``.env``), and falls back to a local/hosted Phoenix
collector otherwise. Logging is configured to never emit prompts or PII.
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


def init_tracing(settings: Settings) -> bool:
    """Initialize OpenInference tracing into Arize AX or Phoenix."""
    tracer_provider = None

    if settings.arize_enabled:
        try:
            from arize.otel import register

            tracer_provider = register(
                space_id=settings.arize_space_id,
                api_key=settings.arize_api_key,
                project_name=settings.arize_project_name,
            )
            logger.info("Arize AX tracing initialized (project=%s)", settings.arize_project_name)
        except Exception as exc:  # pragma: no cover - optional dependency
            logger.warning("Arize AX init failed, trying Phoenix: %s", exc)

    if tracer_provider is None and settings.phoenix_collector_endpoint:
        try:
            from phoenix.otel import register

            tracer_provider = register(
                project_name=settings.phoenix_project_name,
                endpoint=settings.phoenix_collector_endpoint,
            )
            logger.info("Phoenix tracing initialized")
        except Exception as exc:  # pragma: no cover
            logger.warning("Phoenix init failed: %s", exc)

    if tracer_provider is None:
        return False

    try:
        from openinference.instrumentation.openai import OpenAIInstrumentor

        OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
    except Exception as exc:  # pragma: no cover
        logger.warning("OpenAI instrumentation skipped: %s", exc)

    return True


def init_telemetry(settings: Settings) -> None:
    """Initialize all telemetry. Safe to call once during FastAPI lifespan startup."""
    init_sentry(settings)
    init_tracing(settings)
