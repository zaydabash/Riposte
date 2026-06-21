"""MITRE ATT&CK continuous verification — CI bundle reference.

Run the default priority-1 technique bundle against staging before merge:

```bash
docker compose up -d redis
cd backend && uvicorn src.main:app --port 8000 &
curl -X POST http://127.0.0.1:8000/api/v1/audit/start \\
  -H 'Content-Type: application/json' \\
  -d '{
    "target_name": "Staging Agent",
    "target_endpoint": "https://staging.example.com",
    "source_repository": "https://github.com/org/agent",
    "max_payloads": 6
  }'
```

Default bundle (see `src/scenarios/registry.py`):
- T1185 Browser Session Hijacking
- T1115 Clipboard Data
- T1566 Phishing
- T1056.003 Web Portal Capture
- T1189 Drive-by Compromise (defensive)
- T1190 Exploit Public-Facing Application (safe subset)

Full bundle adds T1659, T1078, T1133, T1195.

Browserbase credentials (`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`) are
required for verification runs. Controlled fixtures are served at `/fixtures/*`
and loaded in a real Browserbase session via Stagehand.

Redis Stack is required for regression memory (`docker compose up -d redis`).
