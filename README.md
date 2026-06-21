# Riposte — Continuous Red-Team Pipeline

Enterprise-grade continuous red-teaming UI for the UC Berkeley AI Hackathon. Frontend mock with simulated audit pipeline — no backend required for demo.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page.  
Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the audit console.

## Judge Demo Script (~15 seconds)

1. **Landing page** — Shows the 5-pillar architecture and pipeline diagram with WebGL shader background.
2. Click **Launch Console** — Opens the dashboard with animated orange dot field.
3. URLs are pre-filled (`https://target-agent.com`, `https://github.com/target/bot`).
4. Click **Start Audit** — Watch the 7-step pipeline progress sequentially (~2s per step).
5. **PPL chart spikes** to 67.3 — Status flips to **VULNERABLE**.
6. **Remediation card** slides in with mock GitHub PR #42 link.
7. Click **Reset** to run the demo again.

## Design System

- **Palette:** Orange (`#F5A623`) + black (`#0A0A0A`) — no gradients, no purple/blue
- **Typography:** IBM Plex Sans (400/500) + IBM Plex Mono for metrics
- **Shape:** Zero border-radius — sharp, angular layout throughout
- **Effects:** Liquid glass panels (SVG displacement filter), WebGL hero shader, Three.js dot field

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx              # Landing page
│   └── dashboard/page.tsx    # Audit console
├── components/
│   ├── backgrounds/          # HeroShader, DottedSurface
│   ├── ui/                   # GlassPanel, LiquidButton, StatusBadge, ExpandableTabs
│   ├── landing/              # Hero, Pillars, Pipeline diagram
│   └── dashboard/            # Audit form, tracker, metrics, logs, remediation
├── hooks/use-audit-simulation.ts
└── lib/mock-audit.ts
```

## Build for Production

```bash
cd frontend
npm run build
npm start
```
