import numpy as np

from src.config import Settings
from src.core.embeddings import EmbeddingProvider, split_sentences


def _provider() -> EmbeddingProvider:
    return EmbeddingProvider(Settings(EMBEDDING_DIM=256, MINIMAX_API_KEY=None))


def test_embedding_is_normalized_and_deterministic():
    p = _provider()
    a = p.embed("the quick brown fox jumps")
    b = p.embed("the quick brown fox jumps")
    assert a.shape == (p.dim,)
    assert np.allclose(a, b)
    assert abs(np.linalg.norm(a) - 1.0) < 1e-6


def test_shared_vocabulary_increases_cosine():
    p = _provider()
    base = p.embed("salary engineering department employee record")
    similar = p.embed("employee salary record from the engineering department")
    different = p.embed("weather forecast sunny tomorrow afternoon")
    assert float(base @ similar) > float(base @ different)


def test_hashing_fallback_when_no_spacy(monkeypatch):
    import src.core.embeddings as mod

    monkeypatch.setattr(mod, "_spacy_model", lambda: None)
    p = EmbeddingProvider(Settings(EMBEDDING_DIM=128, MINIMAX_API_KEY=None))
    assert p.backend == "hashing"
    v = p.embed("hello world")
    assert v.shape == (128,)
    assert abs(np.linalg.norm(v) - 1.0) < 1e-6
    assert np.linalg.norm(p.embed("   ")) == 0.0


def test_split_sentences():
    parts = split_sentences("First sentence. Second one! Third?\nFourth line")
    assert parts == ["First sentence.", "Second one!", "Third?", "Fourth line"]
