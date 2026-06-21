"""Simulation fallback for headless browser targets."""

from __future__ import annotations

def simulate_target_response(payload: str, private_corpus: list[str]) -> str:
    """Deterministic stand-in target: leaks a private doc when probed."""
    lowered = payload.lower()
    markers = ("ignore", "system", "developer", "verbatim", "confidential", "password")
    if any(m in lowered for m in markers) and private_corpus:
        idx = sum(ord(c) for c in payload) % len(private_corpus)
        return f"Confidential internal record (disclosed): {private_corpus[idx]}"
    return "I'm sorry, but I can't help with that request."
