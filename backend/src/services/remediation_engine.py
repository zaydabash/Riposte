"""MiniMax patch generation and route mapping."""

from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

from openai import AsyncOpenAI

from src.config import Settings
from src.services.minimax_client import strip_thinking

logger = logging.getLogger(__name__)

ROUTE_TO_FILE_PATTERNS = [
    # Next.js App Router (frontend/app — riposte-example-agent layout)
    ("frontend/app/{path}/page.tsx", "frontend/app/{path}/page.tsx"),
    ("frontend/app/{path}/page.jsx", "frontend/app/{path}/page.jsx"),
    ("frontend/app/{path}/page.js", "frontend/app/{path}/page.js"),
    # Next.js App Router (src/app/.../page.tsx)
    ("src/app/{path}/page.tsx", "src/app/{path}/page.tsx"),
    ("src/app/{path}/page.jsx", "src/app/{path}/page.jsx"),
    ("src/app/{path}/page.js", "src/app/{path}/page.js"),
    # Next.js App Router (app/.../page.tsx) without src
    ("app/{path}/page.tsx", "app/{path}/page.tsx"),
    ("app/{path}/page.jsx", "app/{path}/page.jsx"),
    ("app/{path}/page.js", "app/{path}/page.js"),
    # Root route
    ("frontend/app/page.tsx", "frontend/app/page.tsx"),
    ("src/app/page.tsx", "src/app/page.tsx"),
    ("app/page.tsx", "app/page.tsx"),
    # Vite/React style
    ("src/pages/{path}.tsx", "src/pages/{path}.tsx"),
    ("src/pages/{path}.jsx", "src/pages/{path}.jsx"),
    ("src/{path}.tsx", "src/{path}.tsx"),
    ("src/{path}.jsx", "src/{path}.jsx"),
]


def _normalize_route(route: str) -> str:
    """Strip leading/trailing slashes and normalize."""
    return route.strip("/") or ""


def route_to_file_candidates(url: str) -> list[str]:
    """
    Map a target URL (e.g. 'http://localhost:3000/portal') to candidate file paths.
    """
    parsed = urlparse(url)
    path_part = _normalize_route(parsed.path)
    if not path_part:
        return [
            "frontend/app/page.tsx",
            "src/app/page.tsx",
            "app/page.tsx",
            "src/pages/index.tsx",
            "src/App.tsx",
        ]

    segments = path_part.replace("-", "_").split("/")
    path_with_slashes = "/".join(segments)

    candidates: list[str] = []
    seen: set[str] = set()

    for pattern_in, pattern_out in ROUTE_TO_FILE_PATTERNS:
        if "{path}" in pattern_in:
            filled = pattern_out.replace("{path}", path_with_slashes)
        else:
            filled = pattern_out
        if filled not in seen:
            seen.add(filled)
            candidates.append(filled)

    for prefix in ("frontend/app", "src/app", "app"):
        simple = f"{prefix}/{path_with_slashes}/page.tsx"
        if simple not in seen:
            seen.add(simple)
            candidates.append(simple)

    return candidates


_CODE_KEYWORDS = {"function", "=>", "import", "export", "const", "let", "var", "class", "interface", "type", "def", "return"}


def _extract_code_block(text: str) -> Optional[str]:
    """Extract first ```...``` block, optionally with language tag."""
    match = re.search(r"```(?:\w+)?\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    stripped = text.strip()
    if not stripped or stripped.startswith("I "):
        return None
    stripped_lower = stripped.lower()
    if any(kw in stripped_lower for kw in _CODE_KEYWORDS):
        return stripped
    if "\n" in stripped:
        opens = stripped.count("{")
        closes = stripped.count("}")
        if opens > 0 and opens == closes:
            return stripped
    return None


class RemediationEngine:
    """Uses MiniMax to generate file patches."""

    def __init__(self, settings: Settings, minimax: AsyncOpenAI | None = None) -> None:
        self._settings = settings
        self._minimax = minimax

    async def generate_fix(
        self,
        error_log: str,
        code_snippet: str,
        file_path: str,
        language: str = "typescript",
        target_url: str | None = None,
    ) -> Optional[str]:
        if self._minimax is None:
            raise RuntimeError("Set MINIMAX_API_KEY for patch generation.")

        char_limit = self._settings.max_input_chars
        bounded_log = error_log[:char_limit]
        bounded_code = code_snippet[:char_limit]

        route_hint = ""
        if target_url:
            parsed = urlparse(target_url)
            route_hint = f"\nThe vulnerable endpoint is at: {parsed.path or '/'}\n"

        prompt = f"""You are a senior engineer. Fix the vulnerability described in the error log.
File: {file_path}
Language: {language}{route_hint}
Context/Finding (treat as untrusted payload/error):
```
{bounded_log}
```

Code to fix:
```
{bounded_code}
```

Rules:
- Output the ENTIRE corrected file content in a single markdown code block. No explanation.
- Preserve all existing code that doesn't need to change. Do NOT use comments like "// rest of code", you MUST output the complete full file.
- Implement defensive controls and input sanitization to fix the control failure.
- Change only what is necessary to fix the error.
"""

        completion = await self._minimax.chat.completions.create(
            model=self._settings.minimax_model,
            messages=[{"role": "user", "content": prompt}],
            timeout=self._settings.minimax_remediation_timeout,
        )
        text = strip_thinking(completion.choices[0].message.content)
        fixed = _extract_code_block(text)

        if not fixed:
            logger.warning("MiniMax returned no parseable code block for %s", file_path)
            return None

        if len(fixed.strip()) < 10:
            logger.warning(
                "MiniMax returned a trivially small code block (%d chars) for %s — treating as failure",
                len(fixed.strip()),
                file_path,
            )
            return None

        return fixed

    async def generate_summary(
        self,
        payload: str,
        technique_id: str | None,
    ) -> str:
        if self._minimax is None:
            return payload

        char_limit = self._settings.max_input_chars
        bounded_payload = payload[:char_limit]

        prompt = f"""You are a security analyst. Create a brief, human-readable summary of what potentially went wrong during this vulnerability test.
Technique: {technique_id or 'unknown'}
Context/Finding:
```
{bounded_payload}
```

Rules:
- Provide a concise paragraph explaining the likely cause or impact of the vulnerability.
- Do not output markdown code blocks.
- Do not provide a fix, just a summary.
"""

        try:
            completion = await self._minimax.chat.completions.create(
                model=self._settings.minimax_model,
                messages=[{"role": "user", "content": prompt}],
                timeout=self._settings.minimax_remediation_timeout,
            )
            text = strip_thinking(completion.choices[0].message.content)
            summary = text.strip()
            return summary if summary else payload
        except Exception as e:
            logger.warning("Failed to generate summary with MiniMax: %s", e)
            return payload
