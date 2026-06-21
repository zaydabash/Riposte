#!/usr/bin/env bash
# Start Redis for Riposte locally. Prefer Redis Stack (RediSearch + vector indexes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"

if command -v docker >/dev/null 2>&1; then
  echo "Starting Redis Stack via docker compose..."
  docker compose -f "$ROOT/docker-compose.yml" up -d redis
elif command -v brew >/dev/null 2>&1; then
  if brew list redis-stack 2>/dev/null || brew list --cask redis-stack 2>/dev/null; then
    echo "Starting Redis Stack (Homebrew cask)..."
    brew services start redis-stack 2>/dev/null || true
  else
    echo "Starting Homebrew redis (basic KV only — no RediSearch vector indexes)."
    echo "For full vector memory, either:"
    echo "  docker compose -f docker-compose.yml up -d redis"
    echo "  brew trust redis-stack/redis-stack && brew install --cask redis-stack"
    brew install redis 2>/dev/null || true
    brew services start redis
  fi
else
  echo "Install Docker or Homebrew, then re-run this script." >&2
  exit 1
fi

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli ping
fi

echo "Set REDIS_URL=$REDIS_URL in backend/.env"
