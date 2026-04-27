"""Drift-detection unit tests with deterministic mock embeddings.

Strategy: each "phrase family" maps to a fixed pseudo-vector. Stable answers
all hash to vectors near a baseline; drift answers hash near a different
direction, producing a high cosine distance and triggering the drift flag.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from app.services.memory_engine import (
    MemoryDeps,
    MemorySignal,
    update,
)


def _vec_from_seed(seed: str, dim: int = 32) -> list[float]:
    """Deterministic vector from a string seed."""
    digest = hashlib.sha256(seed.encode()).digest()
    base = [(b - 128) / 128.0 for b in digest]
    while len(base) < dim:
        base.append(0.0)
    return base[:dim]


STABLE_SEED = "max_stable_baseline"
DRIFT_SEED = "what_cat_drifted_far"


def _embed(text: str) -> list[float]:
    """Stable answers cluster near STABLE_SEED. Drift answers near DRIFT_SEED.
    A sprinkle of per-text noise keeps adjacent answers from being identical.
    """
    if any(k in text.lower() for k in ("which cat", "no cat", "neighbor", "don't know", "not sure", "confused")):
        base = _vec_from_seed(DRIFT_SEED)
    else:
        base = _vec_from_seed(STABLE_SEED)
    noise = _vec_from_seed(text)
    # 95% baseline direction + 5% per-text wobble
    return [0.95 * b + 0.05 * n for b, n in zip(base, noise)]


def _make_deps(consistency_value: int = 3, store: dict | None = None,
               notified: list | None = None, now_value: datetime | None = None) -> MemoryDeps:
    store = store if store is not None else {}
    notified = notified if notified is not None else []

    def _load(pair_id, theme_id):
        return store.get((pair_id, theme_id))

    def _save(pair_id, sig):
        store[(pair_id, theme_id_of(sig))] = sig

    def _notify(pair_id, sig):
        notified.append((pair_id, sig.theme_id, sig.gemini_severity))

    return MemoryDeps(
        embed=_embed,
        load_signal=_load,
        save_signal=_save,
        consistency_check=lambda answers: consistency_value,
        notify_guardian=_notify,
        now=lambda: now_value or datetime.now(timezone.utc),
    )


def theme_id_of(sig: MemorySignal) -> str:
    return sig.theme_id


# ---- TESTS ---------------------------------------------------------------
def test_consistent_answers_no_flag():
    """14 days of stable cat answers → drift score stays low, no flag."""
    pid = "pair_a"
    theme = "pet"
    store: dict = {}
    answers = [f"Max is doing well today (day {i})." for i in range(14)]
    base_now = datetime(2026, 4, 25, tzinfo=timezone.utc)

    final = None
    for i, text in enumerate(answers):
        deps = _make_deps(store=store, now_value=base_now - timedelta(days=13 - i))
        final = update(pid, theme, text, f"call_{i}", deps)

    assert final is not None
    assert final.drift_score < 0.1, f"expected low drift, got {final.drift_score}"
    assert final.flagged_at is None


def test_gradual_drift_triggers_flag_with_severity_ge_2():
    """10 stable answers, then 4 'which cat?' style answers spanning 14 days."""
    pid = "pair_b"
    theme = "pet"
    store: dict = {}
    notified: list = []

    stable = [f"Max is doing well, day {i}." for i in range(10)]
    drift = [
        "Which cat? I'm not sure.",
        "I don't know, the neighbor maybe.",
        "There's no cat here, I think you're confused.",
        "I really don't know, no cat that I remember.",
    ]
    answers = stable + drift
    base_now = datetime(2026, 4, 25, tzinfo=timezone.utc)

    final = None
    for i, text in enumerate(answers):
        # Walk forward one day per answer so total span >= 13 days.
        deps = _make_deps(
            consistency_value=3,
            store=store,
            notified=notified,
            now_value=base_now - timedelta(days=len(answers) - 1 - i),
        )
        final = update(pid, theme, text, f"call_{i}", deps)

    assert final is not None
    assert final.drift_score > 0.35, f"expected drift > 0.35, got {final.drift_score}"
    assert final.gemini_severity >= 2
    assert final.flagged_at is not None
    assert any(n[2] >= 2 for n in notified), "guardian should have been notified"


def test_few_answers_never_flag():
    """5 answers — even with sharp drift — must not flag (insufficient history)."""
    pid = "pair_c"
    theme = "pet"
    store: dict = {}
    notified: list = []
    answers = [
        "Max is doing well.",
        "Max is great.",
        "Which cat?",
        "I don't know.",
        "No cat.",
    ]
    base_now = datetime(2026, 4, 25, tzinfo=timezone.utc)
    final = None
    for i, text in enumerate(answers):
        deps = _make_deps(
            store=store,
            notified=notified,
            now_value=base_now - timedelta(days=4 - i),
        )
        final = update(pid, theme, text, f"call_{i}", deps)
    assert final is not None
    assert final.flagged_at is None
    assert notified == []


def test_re_flag_cooldown():
    """Once flagged, we don't re-notify the guardian within the cooldown window."""
    pid = "pair_d"
    theme = "pet"
    store: dict = {}
    notified: list = []
    base_now = datetime(2026, 4, 25, tzinfo=timezone.utc)

    full = (
        [f"Max is doing well, day {i}." for i in range(10)]
        + [
            "Which cat? I'm not sure.",
            "I don't know, the neighbor maybe.",
            "No cat here.",
            "I really don't know.",
        ]
    )
    for i, text in enumerate(full):
        deps = _make_deps(
            consistency_value=3,
            store=store,
            notified=notified,
            now_value=base_now - timedelta(days=len(full) - 1 - i),
        )
        update(pid, theme, text, f"call_{i}", deps)

    notifications_after_first = len(notified)
    # One more drift answer the next day — should not trigger another notify.
    deps = _make_deps(
        consistency_value=3,
        store=store,
        notified=notified,
        now_value=base_now,
    )
    update(pid, theme, "Still no cat.", f"call_extra", deps)
    assert len(notified) == notifications_after_first
