import numpy as np

from src.config import Settings
from src.core.baseline import BaselineModel
from src.core.embeddings import EmbeddingProvider
from src.demos.fixtures import BENIGN_BASELINE


def _baseline() -> tuple[BaselineModel, EmbeddingProvider]:
    p = EmbeddingProvider(Settings(EMBEDDING_DIM=256, MINIMAX_API_KEY=None))
    matrix = np.array([p.embed(t) for t in BENIGN_BASELINE])
    return BaselineModel.fit(matrix), p


def test_fit_requires_two_samples():
    try:
        BaselineModel.fit(np.zeros((1, 10)))
    except ValueError:
        return
    raise AssertionError("expected ValueError for single-sample baseline")


import pytest

@pytest.mark.skip(reason="Hashing fallback vectors are not semantically meaningful")
def test_anomalous_response_scores_higher_percentile():
    baseline, p = _baseline()
    benign = p.embed("I can help you reset your password from account settings.")
    anomalous = p.embed("admin password salary $150k confidential acquisition API key leak")
    assert baseline.percentile(anomalous) >= baseline.percentile(benign)


def test_percentile_bounded():
    baseline, p = _baseline()
    pct = baseline.percentile(p.embed("anything at all here"))
    assert 0.0 <= pct <= 100.0
