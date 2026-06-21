"""Bounded text helpers driven by Settings."""


def truncate_text(text: str | None, limit: int) -> str | None:
    if text is None:
        return None
    if limit <= 0:
        return ""
    return text if len(text) <= limit else text[:limit]
