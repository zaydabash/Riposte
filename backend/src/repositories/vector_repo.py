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
PRIVATE_INDEX = "idx:private"
PRIVATE_PREFIX = "private:"


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
        """Create the payload HNSW vector index if it does not already exist."""
        return await self._ensure_vector_index(
            PAYLOAD_INDEX, PAYLOAD_PREFIX, "payload_text", dim
        )

    async def ensure_private_index(self, dim: int) -> bool:
        """Create the private-corpus HNSW vector index if it does not already exist."""
        return await self._ensure_vector_index(
            PRIVATE_INDEX, PRIVATE_PREFIX, "document_text", dim
        )

    async def _ensure_vector_index(
        self, index_name: str, prefix: str, text_field: str, dim: int
    ) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.execute_command("FT.INFO", index_name)
            return True
        except Exception:
            pass
        try:
            await self._client.execute_command(
                "FT.CREATE", index_name,
                "ON", "HASH", "PREFIX", "1", prefix,
                "SCHEMA",
                text_field, "TEXT",
                "embedding", "VECTOR", "HNSW", "6",
                "TYPE", "FLOAT32", "DIM", str(dim), "DISTANCE_METRIC", "COSINE",
            )
            return True
        except Exception as exc:  # pragma: no cover - network/index path
            logger.warning("FT.CREATE %s failed: %s", index_name, exc)
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

    async def index_private_document(
        self, key: str, document_text: str, embedding: list[float] | np.ndarray
    ) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.hset(
                f"{PRIVATE_PREFIX}{key}",
                mapping={
                    "document_text": document_text.encode("utf-8"),
                    "embedding": _to_bytes(embedding),
                },
            )
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("index_private_document failed: %s", exc)
            return False

    async def search_similar_payloads(
        self, query_embedding: list[float] | np.ndarray, k: int = 5
    ) -> list[str]:
        """Return up to ``k`` previously-seen payloads nearest the query vector."""
        return await self._vector_search(
            PAYLOAD_INDEX, query_embedding, k, "payload_text"
        )

    async def search_similar_private_docs(
        self, query_embedding: list[float] | np.ndarray, k: int = 5
    ) -> list[str]:
        """Return up to ``k`` private corpus documents nearest the query vector."""
        return await self._vector_search(
            PRIVATE_INDEX, query_embedding, k, "document_text"
        )

    async def _vector_search(
        self,
        index_name: str,
        query_embedding: list[float] | np.ndarray,
        k: int,
        text_field: str,
    ) -> list[str]:
        if self._client is None:
            return []
        query_vector = _to_bytes(query_embedding)
        query = f"*=>[KNN {k} @embedding $vec AS vector_score]"
        try:
            results = await self._client.execute_command(
                "FT.SEARCH", index_name, query,
                "RETURN", "1", text_field,
                "SORTBY", "vector_score",
                "LIMIT", "0", str(k),
                "PARAMS", "2", "vec", query_vector,
                "DIALECT", "2",
            )
        except Exception as exc:
            logger.warning("FT.SEARCH %s failed: %s", index_name, exc)
            return []

        return self._parse_text_results(results, text_field)

    @staticmethod
    def _parse_text_results(results: list, text_field: str) -> list[str]:
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
                    if name == text_field:
                        value = fields[j + 1]
                        parsed.append(
                            value.decode("utf-8") if isinstance(value, bytes) else str(value)
                        )
        return parsed

    @staticmethod
    def _parse_payload_results(results: list) -> list[str]:
        return VectorRepository._parse_text_results(results, "payload_text")

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # pragma: no cover
                pass
