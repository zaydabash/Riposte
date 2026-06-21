"""Embedding provider with layered backends.

Priority order:

1. **MiniMax ``embo-01``** — real semantic embeddings through TokenRouter or native MiniMax.
2. **spaCy GloVe vectors** (``en_core_web_md``) — real 300-d semantic embeddings,
   CPU-only, no network. This makes the ARiES anomaly + leakage math meaningful.
3. **Feature hashing** — deterministic last-resort fallback (the "hashing trick")
   so the pipeline still runs even with no model installed.

All embeddings are L2-normalized. ``dim`` reflects whichever local backend is
active so the Mahalanobis baseline is fit and queried in a consistent space.
"""

from __future__ import annotations

import hashlib
import re
from functools import lru_cache

import httpx
import numpy as np

from src.config import Settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


@lru_cache(maxsize=1)
def _spacy_model():
    """Load a vector-capable spaCy model once, or return None if unavailable."""
    try:
        import spacy  # type: ignore

        for name in ("en_core_web_md", "en_core_web_lg"):
            try:
                nlp = spacy.load(name)
                if nlp.vocab.vectors_length > 0:
                    return nlp
            except Exception:
                continue
    except Exception:
        pass
    return None


def _hash_index(token: str, dim: int) -> tuple[int, float]:
    digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
    h = int.from_bytes(digest, "big")
    return h % dim, (1.0 if (h >> 16) & 1 else -1.0)


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


class EmbeddingProvider:
    """Produces L2-normalized embeddings for arbitrary text."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._nlp = _spacy_model()
        if self._nlp is not None:
            self.dim = int(self._nlp.vocab.vectors_length)
            self._backend = "spacy"
        else:
            self.dim = settings.embedding_dim
            self._backend = "hashing"
        self._scoring_dim: int | None = None

    @property
    def backend(self) -> str:
        return self._backend

    @property
    def is_remote(self) -> bool:
        return (
            self._settings.embedding_backend.lower() == "remote"
            and bool(self._settings.minimax_api_key)
        )

    def embed(self, text: str) -> np.ndarray:
        """Synchronous local embedding used by the math core."""
        return self._local_embed(text)

    async def embed_remote(self, text: str) -> np.ndarray:
        """Embed via MiniMax ``embo-01`` when configured, else the local backend."""
        if not self.is_remote:
            return self._local_embed(text)
        try:
            return await self._minimax_embed(text)
        except Exception:
            # Never fail the pipeline on an embedding hiccup; telemetry captures it.
            return self._local_embed(text)

    async def embed_for_scoring(self, text: str) -> np.ndarray:
        """Embedding used by ARiES scoring and vector indexes.

        This single method is used for the benign baseline, private corpus,
        response text, sentence scoring, and evidence memory so those vectors all
        live in the same space.
        """
        if self.is_remote:
            return await self._minimax_embed(text)
        return self._local_embed(text)

    async def embed_many_for_scoring(self, texts: list[str]) -> list[np.ndarray]:
        """Batch version of :meth:`embed_for_scoring` with the same backend."""
        if not texts:
            return []
        if self.is_remote:
            return await self._minimax_embed_many(texts)
        return [self._local_embed(text) for text in texts]

    async def scoring_dim(self) -> int:
        """Return the active ARiES/vector-memory embedding dimension."""
        if self._scoring_dim is None:
            self._scoring_dim = int((await self.embed_for_scoring("riposte dimension probe")).shape[0])
        return self._scoring_dim

    def _local_embed(self, text: str) -> np.ndarray:
        if self._nlp is not None:
            return _normalize(self._nlp(text).vector.astype(np.float64))
        return self._hash_embed(text)

    def _hash_embed(self, text: str) -> np.ndarray:
        vec = np.zeros(self.dim, dtype=np.float64)
        tokens = _tokenize(text)
        if not tokens:
            return vec
        for token in tokens:
            index, sign = _hash_index(token, self.dim)
            vec[index] += sign
        return _normalize(vec)

    async def _minimax_embed(self, text: str) -> np.ndarray:
        return (await self._minimax_embed_many([text]))[0]

    async def _minimax_embed_many(self, texts: list[str]) -> list[np.ndarray]:
        url = self._settings.minimax_base_url.rstrip("/") + "/embeddings"
        params = (
            {"GroupId": self._settings.minimax_group_id}
            if self._settings.minimax_group_id
            else None
        )
        headers = {"Authorization": f"Bearer {self._settings.minimax_api_key}"}
        if self._settings.minimax_group_id:
            body = {
                "model": self._settings.minimax_embedding_model,
                "texts": texts,
                "type": "query",
            }
        else:
            body = {"model": self._settings.minimax_embedding_model, "input": texts}
        async with httpx.AsyncClient(timeout=self._settings.minimax_http_timeout) as client:
            resp = await client.post(url, params=params, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
        vectors = _extract_embedding_vectors(data)
        if len(vectors) != len(texts):
            raise ValueError("MiniMax embedding response did not contain a vector")
        return [_normalize(np.asarray(vector, dtype=np.float64)) for vector in vectors]


def _extract_embedding_vectors(data: dict) -> list[list[float]]:
    """Read either OpenAI-compatible or native MiniMax embedding responses."""
    openai_items = data.get("data")
    if isinstance(openai_items, list):
        ordered = sorted(
            openai_items,
            key=lambda item: item.get("index", 0) if isinstance(item, dict) else 0,
        )
        vectors = [
            item.get("embedding")
            for item in ordered
            if isinstance(item, dict) and isinstance(item.get("embedding"), list)
        ]
        if len(vectors) == len(openai_items):
            return vectors

    vectors = data.get("vectors")
    if isinstance(vectors, list) and all(isinstance(vector, list) for vector in vectors):
        return vectors

    return []


def split_sentences(text: str) -> list[str]:
    """Split a response into sentence-like spans for localized anomaly scoring."""
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]
