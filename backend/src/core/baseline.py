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
    x = np.asarray(x, dtype=np.float64)
    mean = x.mean(axis=0)
    centered = x - mean
    dim = x.shape[1]
    k = max(1, min(k, dim, max(1, x.shape[0] - 1)))

    def _identity_fallback() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        components = np.eye(dim, dtype=np.float64)[:k]
        return mean, components, np.eye(k, dtype=np.float64)

    if x.shape[0] < 2 or np.allclose(centered, 0.0):
        return _identity_fallback()

    try:
        _, singular, vt = np.linalg.svd(centered, full_matrices=False)
    except np.linalg.LinAlgError:
        return _identity_fallback()

    rank = int(np.sum(singular > 1e-9))
    if rank == 0:
        return _identity_fallback()

    k = min(k, rank)
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
    score_mu: float  # mean of the benign anomaly distances
    score_sigma: float  # std of benign anomaly distances (floored, never 0)

    @classmethod
    def fit(
        cls,
        embeddings: np.ndarray,
        n_components: int = 10,
        *,
        sigma_floor_ratio: float,
    ) -> "BaselineModel":
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

        # Leave-one-out needs at least three benign samples; with fewer, score each
        # sample against the global fit so small corpora still start audits.
        empirical: list[float] = []
        if n_samples < 3:
            for row in x:
                t2, spe = _t2_spe(row, mean, components, cov_inv)
                empirical.append(t2 + beta * spe)
        else:
            for i in range(n_samples):
                others = np.delete(x, i, axis=0)
                m_i, c_i, ci_i = _fit_params(others, k)
                t2, spe = _t2_spe(x[i], m_i, c_i, ci_i)
                empirical.append(t2 + beta * spe)

        empirical_arr = np.asarray(empirical, dtype=np.float64)
        score_mu = float(np.mean(empirical_arr))
        # Floor sigma so a near-degenerate benign cloud (tiny corpus, identical
        # samples) still yields a CONTINUOUS score instead of saturating. The
        # floor is relative to the benign scale, with an absolute backstop.
        raw_sigma = float(np.std(empirical_arr))
        score_sigma = max(raw_sigma, abs(score_mu) * sigma_floor_ratio, 1e-6)

        return cls(
            pca_mean=mean,
            components=components,
            cov_inv_pca=cov_inv,
            beta=beta,
            empirical_scores=empirical_arr,
            score_mu=score_mu,
            score_sigma=score_sigma,
        )

    def distance(self, embedding: np.ndarray) -> float:
        """Combined T² + β·SPE anomaly distance for one embedding."""
        x = np.asarray(embedding, dtype=np.float64)
        t2, spe = _t2_spe(x, self.pca_mean, self.components, self.cov_inv_pca)
        return t2 + self.beta * spe

    def percentile(self, embedding: np.ndarray) -> float:
        """Calibrated anomaly score (0-100) of an embedding's distance.

        Uses a smooth Gaussian CDF of the standardized distance
        ``z = (d - mu) / sigma`` against the benign distance distribution, so the
        score is CONTINUOUS — a benign-looking response scores ~50, and risk
        rises smoothly toward 100. A discrete empirical percentile saturates to a
        single bucket on the small baselines audits typically provide (2–10
        samples), which collapses the ARiES ``M`` component to a constant.
        """
        d = self.distance(embedding)
        z = (d - self.score_mu) / self.score_sigma
        return float(100.0 * stats.norm.cdf(z))
