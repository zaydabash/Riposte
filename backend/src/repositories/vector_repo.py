"""Redis Stack vector repository for payload memory and the private corpus.

Per the async/Redis rules, the client is created with ``decode_responses=False`` so
raw binary vectors round-trip without corruption, and ``FT.SEARCH`` queries always
specify ``RETURN``, ``SORTBY``, and ``LIMIT``. All public methods return typed
domain primitives (``list[str]``), never raw RediSearch arrays, and degrade to an
empty result if Redis Stack / the index is unavailable.
"""

from __future__ import annotations

import logging
import struct

import numpy as np

try:  # redis is optional at import time; the repo degrades gracefully without it.
    import redis.asyncio as redis
except Exception:  # pragma: no cover
    redis = None  # type: ignore

from src.config import Settings

logger = logging.getLogger(__name__)

PAYLOAD_INDEX = "idx:payloads"
PAYLOAD_PREFIX = "payload:"


def _to_bytes(vector: list[float] | np.ndarray) -> bytes:
    arr = np.asarray(vector, dtype=np.float32)
    return arr.tobytes()


class VectorRepository:
    """Thin, binary-safe wrapper over Redis Stack vector search."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = None
        if redis is not None:
            try:
                # Fail fast instead of hanging the event loop when Redis is
                # configured but unreachable.
                self._client = redis.from_url(
                    settings.redis_url,
                    decode_responses=False,
                    socket_connect_timeout=3.0,
                    socket_timeout=3.0,
                )
            except Exception as exc:  # pragma: no cover
                logger.warning("Redis client init failed: %s", exc)

    @property
    def available(self) -> bool:
        return self._client is not None

    async def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            return bool(await self._client.ping())
        except Exception as exc:
            logger.warning("Redis ping failed: %s", exc)
            return False

    async def ensure_index(self, dim: int) -> bool:
        """Create the HNSW vector index if it does not already exist."""
        if self._client is None:
            return False
        try:
            await self._client.execute_command("FT.INFO", PAYLOAD_INDEX)
            return True
        except Exception:
            pass
        try:
            await self._client.execute_command(
                "FT.CREATE", PAYLOAD_INDEX,
                "ON", "HASH", "PREFIX", "1", PAYLOAD_PREFIX,
                "SCHEMA",
                "payload_text", "TEXT",
                "embedding", "VECTOR", "HNSW", "6",
                "TYPE", "FLOAT32", "DIM", str(dim), "DISTANCE_METRIC", "COSINE",
            )
            return True
        except Exception as exc:  # pragma: no cover - network/index path
            logger.warning("FT.CREATE failed: %s", exc)
            return False

    async def index_payload(self, key: str, payload_text: str, embedding: list[float] | np.ndarray) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.hset(
                f"{PAYLOAD_PREFIX}{key}",
                mapping={
                    "payload_text": payload_text.encode("utf-8"),
                    "embedding": _to_bytes(embedding),
                },
            )
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("index_payload failed: %s", exc)
            return False

    async def search_similar_payloads(
        self, query_embedding: list[float] | np.ndarray, k: int = 5
    ) -> list[str]:
        """Return up to ``k`` previously-seen payloads nearest the query vector."""
        if self._client is None:
            return []
        query_vector = _to_bytes(query_embedding)
        query = f"*=>[KNN {k} @embedding $vec AS vector_score]"
        try:
            results = await self._client.execute_command(
                "FT.SEARCH", PAYLOAD_INDEX, query,
                "RETURN", "1", "payload_text",
                "SORTBY", "vector_score",
                "LIMIT", "0", str(k),
                "PARAMS", "2", "vec", query_vector,
                "DIALECT", "2",
            )
        except Exception as exc:
            logger.warning("FT.SEARCH failed: %s", exc)
            return []

        return self._parse_payload_results(results)

    @staticmethod
    def _parse_payload_results(results: list) -> list[str]:
        parsed: list[str] = []
        if not results or len(results) < 2:
            return parsed
        # Layout: [count, key1, [field, value, ...], key2, [...], ...]
        for i in range(2, len(results), 2):
            fields = results[i]
            if isinstance(fields, (list, tuple)):
                for j in range(0, len(fields) - 1, 2):
                    name = fields[j]
                    name = name.decode() if isinstance(name, bytes) else name
                    if name == "payload_text":
                        value = fields[j + 1]
                        parsed.append(
                            value.decode("utf-8") if isinstance(value, bytes) else str(value)
                        )
        return parsed

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # pragma: no cover
                pass
