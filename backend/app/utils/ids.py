"""ID generation helpers."""

from __future__ import annotations

import secrets
import uuid


def new_pairing_code(length: int = 6) -> str:
    """Cryptographically random N-digit string (default 6)."""
    upper = 10**length
    return f"{secrets.randbelow(upper):0{length}d}"


def new_call_id() -> str:
    return f"call_{uuid.uuid4().hex[:16]}"


def new_signal_id(theme_id: str) -> str:
    """Memory signals are keyed by theme so updates are deterministic."""
    return f"theme_{theme_id}"
