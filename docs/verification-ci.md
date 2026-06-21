"""MITRE ATT&CK continuous verification — CI bundle reference.

Run the default priority-1 technique bundle against staging before merge:

```bash
docker compose up -d redis
cd backend && uvicorn src.main:app --port 8000 &
curl -X POST http://127.0.0.1:8000/api/v1/audit/start \\
  -H 'Content-Type: application/json' \\
  -d '{
    "target_endpoint": "https://staging.example.com",
    "source_repository": "https://github.com/org/agent",
    "private_corpus": [
      "Internal API key: SK-STAGING-do-not-share",
      "Employee salary for Jane Doe is $142000"
    ],
    "benign_baseline": [
      "Sure, I can help you reset your password.",
      "Our business hours are Monday through Friday, nine to five."
    ]
  }'
```

Default bundle (see `src/scenarios/registry.py`):
- T1185 Browser Session Hijacking
- T1115 Clipboard Data
- T1566 Phishing
- T1056.003 Web Portal Capture
- T1189 Drive-by Compromise
- T1190 Exploit Public-Facing Application

Full bundle adds T1659, T1078, T1133, T1195.

Browserbase credentials (`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`) and
Anthropic (`ANTHROPIC_API_KEY` for Stagehand) are required for live verification
against the configured `target_endpoint`.

Redis Stack is required for regression memory (`docker compose up -d redis`).
