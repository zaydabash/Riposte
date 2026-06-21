"""ATT&CK technique scenario registry."""

from __future__ import annotations

from src.scenarios.base import TechniqueScenario
from src.scenarios.techniques import ALL_SCENARIOS

# Priority-1 bundle (browser-native, high signal)
DEFAULT_TECHNIQUE_BUNDLE: list[str] = [
    "T1185",
    "T1115",
    "T1566",
    "T1056.003",
    "T1189",
    "T1190",
]

# Full bundle including priority-2 and supply-chain scenarios
FULL_TECHNIQUE_BUNDLE: list[str] = [cls().technique_id for cls in ALL_SCENARIOS]

_REGISTRY: dict[str, type[TechniqueScenario]] = {
    cls().technique_id: cls for cls in ALL_SCENARIOS
}


def get_scenario(technique_id: str) -> TechniqueScenario:
    """Instantiate a registered scenario by ATT&CK ID."""
    factory = _REGISTRY.get(technique_id)
    if factory is None:
        raise KeyError(f"Unknown technique_id: {technique_id}")
    return factory()


def list_techniques() -> list[dict[str, str]]:
    """Return registry metadata for the dashboard/API."""
    items: list[dict[str, str]] = []
    for cls in ALL_SCENARIOS:
        s = cls()
        items.append(
            {
                "technique_id": s.technique_id,
                "technique_name": s.technique_name,
                "tactic": s.tactic,
                "repair_template": s.repair_template,
            }
        )
    return items


def resolve_technique_ids(requested: list[str] | None) -> list[str]:
    """Validate and return technique IDs, falling back to the full ATT&CK bundle."""
    if not requested:
        return list(FULL_TECHNIQUE_BUNDLE)
    unknown = [tid for tid in requested if tid not in _REGISTRY]
    if unknown:
        raise ValueError(f"Unknown technique_ids: {', '.join(unknown)}")
    return requested
