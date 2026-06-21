# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies first for better layer caching.
COPY pyproject.toml README.md ./
COPY src ./src
RUN uv pip install --system --no-cache .

EXPOSE 8000

# Non-root runtime user.
RUN useradd --create-home --uid 10001 riposte
USER riposte

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
