"""Emergency keyword detection + optional Gemini classifier for ambiguous cases.

Designed for the call orchestrator: ``scan`` is hot-path safe (a single
compiled regex), ``classify`` is rate-limited to one Gemini call per 3 seconds
per call to avoid blowing budget on chatty conversations.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass

log = logging.getLogger(__name__)


_EMERGENCY_REGEX = re.compile(
    r"\b("
    r"i('?ve)?\s+fallen|fall(en|ing)?\s+down|"
    r"can(?:\s|')?(?:no|n)?t\s+breathe|cannot\s+breathe|"
    r"chest\s+pain|"
    r"help\s+me|"
    r"call\s+(an\s+)?ambulance|"
    r"i\s+(am|m)\s+bleeding"
    r")\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class EmergencyHit:
    text: str
    matched: str
    severity: int  # 0..3


def scan(text: str) -> EmergencyHit | None:
    """Fast regex hit. Returns None when no keyword matched."""
    if not text:
        return None
    m = _EMERGENCY_REGEX.search(text)
    if not m:
        return None
    return EmergencyHit(text=text, matched=m.group(0), severity=3)


class GeminiClassifierGate:
    """Once-per-N-seconds gate for the LLM classifier within a single call."""

    def __init__(self, min_interval_sec: float = 3.0) -> None:
        self.min_interval = min_interval_sec
        self._last = 0.0

    def allow(self) -> bool:
        now = time.monotonic()
        if (now - self._last) < self.min_interval:
            return False
        self._last = now
        return True


def classify(text: str) -> int:
    """LLM classifier for ambiguous phrases ("I fell asleep" vs "I fell down").

    Returns severity 0..3. Falls back to 0 on any error so the call continues.
    """
    try:
        from app.services.gemini_agent import _client
        from app.config import get_settings

        settings = get_settings()
        client = _client()
        prompt = (
            "Is the speaker reporting a real medical or safety emergency right "
            f"now? Reply with JSON: {{\"severity\": 0..3}}.\n\nUtterance: {text}"
        )
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={
                "temperature": 0.0,
                "max_output_tokens": 30,
                "response_mime_type": "application/json",
            },
        )
        import json as _json

        data = _json.loads((resp.text or "").strip() or "{}")
        return max(0, min(3, int(data.get("severity", 0))))
    except Exception as exc:
        log.warning("emergency.classify_error err=%s", exc)
        return 0
