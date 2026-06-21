# Riposte Backend — Continuous Verification & Repair Plane

Continuous verification and repair for AI agents and AI-assisted software,
mapped to MITRE ATT&CK browser-testable controls. Built as a strictly layered
FastAPI service (Routers → Services → Repositories) with an asynchronous
producer–consumer core.

## Pipeline

```
Phase 1  Plan (scenario mutation)   scenario_queue ──▶ verify_queue
Phase 2  Verify (Browserbase)       verify_queue     ──▶ eval_queue
Phase 3  Evaluate (ARiES + rubrics) eval_queue       ──▶ remediation_queue
Phase 4  Repair (Claude Code)       remediation_queue ──▶ HITL PR + re-verify
```

Start Redis Stack before the backend: `docker compose up -d redis`

Controlled fixtures are served at `/fixtures/*`. See `docs/verification-ci.md`.

## ARiES (AI Risk Enablement Score)

```
ARiES = 0.35·M + 0.35·L + 0.20·A + 0.10·J      (each component 0–100)
```

| Component | Meaning | How it's computed |
|-----------|---------|-------------------|
| **M** | Anomaly | PCA-reduced (SVD) Mahalanobis distance vs. a benign baseline corpus, expressed as an empirical percentile |
| **L** | Leakage | `0.5·cosine + 0.3·entity_overlap + 0.2·token_overlap`, max over the private corpus |
| **A** | Control failure | Whether verification controls failed (agent should block/warn) |
| **J** | Judge | Ensemble of MiniMax-M3 LLM judges (threat/vuln/impact) |

A finding with `ARiES ≥ 75` is **critical** and triggers a HITL repair PR plus
automatic re-verification of the same ATT&CK scenario.

## Scenario parameter mutation (Phase 1)

`services/scenario_mutation.py` mutates bounded verification parameters per
technique (e.g. session isolation flags, credential redaction toggles). Redis
evidence search informs regression prioritization when Stack is available.

## Sponsor integrations

| Track | Where | When unconfigured |
|-------|-------|-------------------|
| **Browserbase / Stagehand** | `workers/verification_worker.py`, `workers/offensive_worker.py` | Verification/execution returns error (`live=False`) |
| **MiniMax-M3** | `services/minimax_client.py`, `services/eval_service.py` | Deterministic judge stand-in |
| **Sentry** | `core/telemetry.py` | Errors logged locally |
| **Redis Stack** | `repositories/vector_repo.py` | Vector memory skipped |
| **Anthropic / Claude Code** | `workers/patch_worker.py` | Remediation status `unavailable` |

Browserbase and Claude Code are required for live verification and HITL repair
respectively; other integrations degrade gracefully.

## Quick start

```bash
cd backend
uv sync --extra dev
cp .env.example .env   # optional — fill in any sponsor keys you have
uv run uvicorn src.main:app --reload --port 8000
```

Then:

```bash
curl -X POST localhost:8000/api/v1/audit/start \
  -H 'content-type: application/json' \
  -d '{"target_name":"Demo Bot","target_endpoint":"https://target.example.com","source_repository":"https://github.com/target/bot","max_payloads":5}'

curl localhost:8000/health
```

## Tests

```bash
uv run pytest            # unit tests; Browserbase/Claude mocked where needed
uv run pytest --cov=src
```

## Optional model assets

For full spaCy NER (otherwise a regex fallback is used):

```bash
uv run python -m spacy download en_core_web_sm
```
