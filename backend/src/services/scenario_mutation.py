"""Bounded scenario parameter planning for continuous verification."""

from __future__ import annotations

import logging

from src.config import Settings
from src.core.models import ScenarioTask
from src.repositories.vector_repo import VectorRepository
from src.scenarios.base import TechniqueScenario
from src.scenarios.registry import get_scenario

logger = logging.getLogger(__name__)


class ScenarioMutationService:
    """Applies scenario default parameters; optionally informed by Redis regression memory."""

    def __init__(self, settings: Settings, vector_repo: VectorRepository | None = None) -> None:
        self._settings = settings
        self._vector_repo = vector_repo

    async def plan_task(self, task: ScenarioTask) -> ScenarioTask:
        """Merge registered scenario defaults into the task before live execution."""
        scenario = get_scenario(task.technique_id)
        params = dict(scenario.default_parameters)
        params.update(task.parameters)
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
