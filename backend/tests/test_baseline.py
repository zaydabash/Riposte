import numpy as np

from src.core.baseline import BaselineModel
from src.core.embeddings import EmbeddingProvider
from src.config import Settings
from tests.sample_corpora import SAMPLE_BENIGN_BASELINE


def test_baseline_percentile_is_bounded():
    p = EmbeddingProvider(Settings(EMBEDDING_DIM=256, MINIMAX_API_KEY=None))
    matrix = np.array([p.embed(t) for t in SAMPLE_BENIGN_BASELINE])
    model = BaselineModel.fit(matrix)
    score = model.percentile(matrix[0])
    assert 0.0 <= score <= 100.0
