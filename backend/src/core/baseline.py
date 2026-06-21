"""PCA-based anomaly baseline for the ARiES ``M`` component.

A corpus of *benign* response embeddings is reduced with PCA (computed via SVD, so
no scikit-learn dependency). The anomaly score for a candidate response combines
two classic PCA-anomaly signals:

* **T²** — Mahalanobis distance *within* the principal subspace (Hotelling's T²),
  which flags responses that are unusually positioned among normal directions.
* **SPE** — the squared prediction error / reconstruction residual *orthogonal* to
  the principal subspace (the Q-statistic), which flags out-of-distribution
  content (e.g. a response dumping private data that uses vocabulary the benign
  cloud never spans).

Using T² alone misses OOD leaks entirely because they live in the residual
subspace. The combined score is calibrated against a leave-one-out empirical
distribution of benign scores, and a candidate's distance is reported as its
empirical percentile (0-100): higher means more anomalous vs. benign behavior.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import stats


def _fit_params(x: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (mean, components[k,dim], cov_inv[k,k]) for a centered PCA fit."""
    mean = x.mean(axis=0)
    centered = x - mean
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    components = vt[:k]
    projected = centered @ components.T
    cov = np.atleast_2d(np.cov(projected, rowvar=False)) + np.eye(k) * 1e-6
    cov_inv = np.linalg.pinv(cov)
    return mean, components, cov_inv


def _t2_spe(
    row: np.ndarray, mean: np.ndarray, components: np.ndarray, cov_inv: np.ndarray
) -> tuple[float, float]:
    """Compute (T², residual-norm) of one embedding under a fitted subspace."""
    centered = row - mean
    proj = centered @ components.T  # in-subspace coordinates
    t2 = float(np.sqrt(proj @ cov_inv @ proj))
    reconstructed = proj @ components
    spe = float(np.linalg.norm(centered - reconstructed))
    return t2, spe


@dataclass(frozen=True)
class BaselineModel:
    """Immutable fitted baseline. Construct via :meth:`fit`."""

    pca_mean: np.ndarray
    components: np.ndarray  # (k, dim)
    cov_inv_pca: np.ndarray  # (k, k)
    beta: float  # scale that puts SPE on the same footing as T² for benign data
    empirical_scores: np.ndarray  # (n,) leave-one-out benign anomaly scores

    @classmethod
    def fit(cls, embeddings: np.ndarray, n_components: int = 10) -> "BaselineModel":
        x = np.asarray(embeddings, dtype=np.float64)
        if x.ndim != 2 or x.shape[0] < 2:
            raise ValueError("baseline requires at least 2 sample embeddings")

        n_samples, dim = x.shape
        k = max(1, min(n_components, n_samples - 2, dim))

        mean, components, cov_inv = _fit_params(x, k)

        # Calibrate beta so T² and SPE contribute comparably on the benign cloud.
        t2s, spes = zip(*(_t2_spe(row, mean, components, cov_inv) for row in x))
        mean_t2 = float(np.mean(t2s)) or 1.0
        mean_spe = float(np.mean(spes))
        beta = (mean_t2 / mean_spe) if mean_spe > 1e-9 else 1.0

        # Leave-one-out empirical distribution: each benign sample is scored against
        # a subspace fit on the *others*, giving realistic nonzero residuals.
        empirical: list[float] = []
        for i in range(n_samples):
            others = np.delete(x, i, axis=0)
            m_i, c_i, ci_i = _fit_params(others, k)
            t2, spe = _t2_spe(x[i], m_i, c_i, ci_i)
            empirical.append(t2 + beta * spe)

        return cls(
            pca_mean=mean,
            components=components,
            cov_inv_pca=cov_inv,
            beta=beta,
            empirical_scores=np.asarray(empirical, dtype=np.float64),
        )

    def distance(self, embedding: np.ndarray) -> float:
        """Combined T² + β·SPE anomaly distance for one embedding."""
        x = np.asarray(embedding, dtype=np.float64)
        t2, spe = _t2_spe(x, self.pca_mean, self.components, self.cov_inv_pca)
        return t2 + self.beta * spe

    def percentile(self, embedding: np.ndarray) -> float:
        """Empirical percentile (0-100) of an embedding's anomaly distance."""
        d = self.distance(embedding)
        return float(stats.percentileofscore(self.empirical_scores, d, kind="mean"))
