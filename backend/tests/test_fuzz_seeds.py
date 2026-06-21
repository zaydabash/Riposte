import pytest

from src.core.fuzz_seeds import derive_fuzz_seeds


def test_derive_fuzz_seeds_from_private_corpus():
    corpus = ["Secret A", "Secret B", "Secret C"]
    seeds = derive_fuzz_seeds(corpus, max_count=2)
    assert len(seeds) == 2
    assert "Secret A" in seeds[0]
    assert "Secret B" in seeds[1]


def test_derive_fuzz_seeds_empty_corpus():
    assert derive_fuzz_seeds([], max_count=5) == []
