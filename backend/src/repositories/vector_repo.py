"""Redis Stack vector repository for payload memory and the private corpus.

Per the async/Redis rules, the client is created with ``decode_responses=False`` so
raw binary vectors round-trip without corruption, and ``FT.SEARCH`` queries always
specify ``RETURN``, ``SORTBY``, and ``LIMIT``. All public methods return typed
domain primitives (``list[str]``), never raw RediSearch arrays, and degrade to an
empty result if Redis Stack / the index is unavailable.
"""

from __future__ import annotations

import logging

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
EVIDENCE_INDEX = "idx:evidence"
EVIDENCE_PREFIX = "evidence:"


def _to_bytes(vector: list[float] | np.ndarray) -> bytes:
    arr = np.asarray(vector, dtype=np.float32)
    return arr.tobytes()


class VectorRepository:
    """Thin, binary-safe wrapper over Redis Stack vector search."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = None
        self._vector_search_available = False
        self._evidence_index_available = False
        if redis is not None:
            try:
                # Fail fast instead of hanging the event loop when Redis is
                # configured but unreachable.
                self._client = redis.from_url(
                    settings.redis_url,
                    decode_responses=False,
                    socket_connect_timeout=settings.redis_socket_timeout,
                    socket_timeout=settings.redis_socket_timeout,
                )
            except Exception as exc:  # pragma: no cover
                logger.warning("Redis client init failed: %s", exc)

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def vector_search_available(self) -> bool:
        """True only when RediSearch indexes (Redis Stack) are usable."""
        return self._vector_search_available

    async def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            return bool(await self._client.ping())
        except Exception as exc:
            logger.warning("Redis ping failed: %s", exc)
            return False

    @property
    def evidence_search_available(self) -> bool:
        return self._evidence_index_available

    async def ensure_evidence_index(self, dim: int) -> bool:
        """Create the evidence regression HNSW index if it does not already exist."""
        ok = await self._ensure_vector_index(
            EVIDENCE_INDEX, EVIDENCE_PREFIX, "evidence_text", dim, track="evidence"
        )
        if ok:
            self._evidence_index_available = True
        return ok

    async def ensure_index(self, dim: int) -> bool:
        """Create the payload HNSW vector index if it does not already exist."""
        return await self._ensure_vector_index(
            PAYLOAD_INDEX, PAYLOAD_PREFIX, "payload_text", dim
        )

    async def ensure_private_index(self, dim: int) -> bool:
        """Create the private-corpus HNSW vector index if it does not already exist."""
        return await self._ensure_vector_index(
            PRIVATE_INDEX,
            PRIVATE_PREFIX,
            "document_text",
            dim,
            include_audit_id_tag=True,
        )

    async def _ensure_vector_index(
        self,
        index_name: str,
        prefix: str,
        text_field: str,
        dim: int,
        track: str = "default",
        include_audit_id_tag: bool = False,
    ) -> bool:
        if self._client is None:
            return False
        try:
            info = await self._client.execute_command("FT.INFO", index_name)
            stored_dim = self._parse_index_dim(info)
            if stored_dim is not None and stored_dim != dim:
                logger.warning(
                    "Index %s has DIM=%d but current EMBEDDING_DIM=%d. "
                    "Vector search results may be incorrect.",
                    index_name, stored_dim, dim,
                )
            if track == "evidence":
                self._evidence_index_available = True
            else:
                self._vector_search_available = True
            return True
        except Exception:
            pass
        try:
            schema: list = [
                text_field, "TEXT",
            ]
            if include_audit_id_tag:
                schema.extend(["audit_id", "TAG"])
            schema.extend([
                "embedding", "VECTOR", "HNSW", "6",
                "TYPE", "FLOAT32", "DIM", str(dim), "DISTANCE_METRIC", "COSINE",
            ])
            await self._client.execute_command(
                "FT.CREATE", index_name,
                "ON", "HASH", "PREFIX", "1", prefix,
                "SCHEMA",
                *schema,
            )
            if track == "evidence":
                self._evidence_index_available = True
            else:
                self._vector_search_available = True
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

    async def index_evidence(
        self, key: str, evidence_text: str, embedding: list[float] | np.ndarray
    ) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.hset(
                f"{EVIDENCE_PREFIX}{key}",
                mapping={
                    "evidence_text": evidence_text.encode("utf-8"),
                    "embedding": _to_bytes(embedding),
                },
            )
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("index_evidence failed: %s", exc)
            return False

    async def index_private_document(
        self,
        key: str,
        document_text: str,
        embedding: list[float] | np.ndarray,
        audit_id: str | None = None,
    ) -> bool:
        if self._client is None:
            return False
        try:
            mapping: dict = {
                "document_text": document_text.encode("utf-8"),
                "embedding": _to_bytes(embedding),
            }
            if audit_id is not None:
                mapping["audit_id"] = audit_id.encode("utf-8")
            await self._client.hset(
                f"{PRIVATE_PREFIX}{key}",
                mapping=mapping,
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

    async def search_similar_evidence(
        self, query_embedding: list[float] | np.ndarray, k: int = 5
    ) -> list[str]:
        """Return up to ``k`` prior evidence summaries nearest the query vector."""
        if self._client is None or not self._evidence_index_available:
            return []
        return await self._vector_search_unconditional(
            EVIDENCE_INDEX, query_embedding, k, "evidence_text"
        )

    async def search_similar_private_docs(
        self,
        query_embedding: list[float] | np.ndarray,
        k: int = 5,
        audit_id: str | None = None,
    ) -> list[str]:
        """Return up to ``k`` private corpus documents nearest the query vector."""
        if audit_id:
            return await self._vector_search_private(
                query_embedding, k, audit_id
            )
        return await self._vector_search(
            PRIVATE_INDEX, query_embedding, k, "document_text"
        )

    async def _vector_search_private(
        self,
        query_embedding: list[float] | np.ndarray,
        k: int,
        audit_id: str,
    ) -> list[str]:
        if self._client is None or not self._vector_search_available:
            return []
        query_vector = _to_bytes(query_embedding)
        query = (
            f"@audit_id:{{{audit_id}}}=>[KNN {k} @embedding $vec AS vector_score]"
        )
        try:
            results = await self._client.execute_command(
                "FT.SEARCH", PRIVATE_INDEX, query,
                "RETURN", "1", "document_text",
                "SORTBY", "vector_score",
                "LIMIT", "0", str(k),
                "PARAMS", "2", "vec", query_vector,
                "DIALECT", "2",
            )
        except Exception as exc:
            logger.warning("FT.SEARCH %s failed: %s", PRIVATE_INDEX, exc)
            return []
        return self._parse_text_results(results, "document_text")

    async def _vector_search(
        self,
        index_name: str,
        query_embedding: list[float] | np.ndarray,
        k: int,
        text_field: str,
    ) -> list[str]:
        if self._client is None or not self._vector_search_available:
            return []
        return await self._vector_search_unconditional(
            index_name, query_embedding, k, text_field
        )

    async def _vector_search_unconditional(
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

    @staticmethod
    def _parse_index_dim(info: list | tuple) -> int | None:
        """Extract the ``DIM`` attribute from an ``FT.INFO`` response."""
        try:
            for i in range(0, len(info) - 1, 2):
                key = info[i].decode() if isinstance(info[i], bytes) else str(info[i])
                if key == "attributes":
                    attrs = info[i + 1]
                    if isinstance(attrs, (list, tuple)):
                        for attr in attrs:
                            if isinstance(attr, (list, tuple)):
                                for j in range(0, len(attr) - 1, 2):
                                    ak = attr[j].decode() if isinstance(attr[j], bytes) else str(attr[j])
                                    if ak == "embedding":
                                        embedding_def = attr[j + 1]
                                        if isinstance(embedding_def, (list, tuple)):
                                            for k in range(0, len(embedding_def) - 1, 2):
                                                ek = embedding_def[k].decode() if isinstance(embedding_def[k], bytes) else str(embedding_def[k])
                                                if ek == "DIM":
                                                    val = embedding_def[k + 1]
                                                    return int(val)
        except Exception:
            pass
        return None

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # pragma: no cover
                pass
