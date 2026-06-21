"""Bounded scenario parameter mutation for continuous verification."""

from __future__ import annotations

import logging
import random

from src.config import Settings
from src.core.models import ScenarioTask
from src.repositories.vector_repo import VectorRepository
from src.scenarios.base import TechniqueScenario
from src.scenarios.registry import get_scenario

logger = logging.getLogger(__name__)

# Parameter keys each technique can mutate during verification planning.
_MUTABLE_KEYS: dict[str, list[str]] = {
    "T1185": ["session_isolated"],
    "T1115": ["clipboard_redacted"],
    "T1566": ["phishing_blocked"],
    "T1056.003": ["credentials_redacted"],
    "T1189": ["navigation_blocked"],
    "T1190": ["safe_errors"],
    "T1659": ["injection_detected"],
    "T1078": ["role_enforced"],
    "T1133": ["token_redacted"],
    "T1195": ["update_gated"],
}


class ScenarioMutationService:
    """Mutates bounded verification parameters; optionally informed by Redis regression memory."""

    def __init__(self, settings: Settings, vector_repo: VectorRepository | None = None) -> None:
        self._settings = settings
        self._vector_repo = vector_repo
        self._rng = random.Random(settings.fuzzer_seed)

    async def plan_task(self, task: ScenarioTask) -> ScenarioTask:
        """Apply bounded parameter mutations for one scenario run."""
        scenario = get_scenario(task.technique_id)
        params = dict(scenario.default_parameters)
        params.update(task.parameters)

        keys = _MUTABLE_KEYS.get(task.technique_id, [])
        steps = max(1, self._settings.scenario_mutation_steps)
        for _ in range(steps):
            if not keys:
                break
            key = self._rng.choice(keys)
            params[key] = self._rng.choice(["true", "false"])

        await self._apply_regression_hints(scenario, params)
        return task.model_copy(update={"parameters": params})

    async def _apply_regression_hints(
        self, scenario: TechniqueScenario, params: dict[str, str]
    ) -> None:
        if self._vector_repo is None or not self._vector_repo.evidence_search_available:
            return
        try:
            from src.core.embeddings import EmbeddingProvider

            emb = EmbeddingProvider(self._settings).embed(scenario.technique_id)
            hits = await self._vector_repo.search_similar_evidence(emb, k=3)
            if hits:
                logger.debug(
                    "Regression memory hints for %s: %d prior runs",
                    scenario.technique_id,
                    len(hits),
                )
        except Exception as exc:  # pragma: no cover
            logger.debug("Regression hint lookup skipped: %s", exc)
