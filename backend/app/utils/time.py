"""Timezone-aware datetime helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    """``datetime.utcnow()`` is naive — always use this instead."""
    return datetime.now(timezone.utc)


def to_local(dt: datetime, tz_name: str) -> datetime:
    """Convert a UTC-aware datetime to the user's IANA timezone."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ZoneInfo(tz_name))


def local_hhmm_now(tz_name: str) -> str:
    """Current ``HH:MM`` in the elder's timezone."""
    return to_local(utcnow(), tz_name).strftime("%H:%M")


def hhmm_within_window(target: str, current: str, window_min: int = 1) -> bool:
    """Return True if ``current`` is within ``window_min`` minutes of ``target`` (HH:MM)."""

    def minutes(s: str) -> int:
        h, m = s.split(":")
        return int(h) * 60 + int(m)

    diff = abs(minutes(current) - minutes(target))
    diff = min(diff, 24 * 60 - diff)  # wrap around midnight
    return diff <= window_min
