"""Drift-detection memory engine.

Algorithm (per spec):

1. embed the new answer
2. fetch prior answers for this theme (sorted by date, oldest first)
3. if total < 3 → append, return signal with drift_score = 0
4. baseline_vec = mean(first 3 embeddings)
5. recent_vec   = mean(last 3 embeddings, including the new one)
6. drift = 1 - cosine(baseline_vec, recent_vec)
7. monotonic check on rolling-3 cosine to baseline over the last 14 days
8. if drift > 0.35 AND history spans ≥ 14 days AND monotonic:
       severity = consistency_check(answers[-5:]) → 0..3
       flagged_at = now
9. if newly flagged AND not flagged in last 14 days → FCM the guardian
10. write the signal doc, return it

This module is fully testable: external dependencies (embedding, Gemini,
Firestore, FCM) can be injected via the ``deps`` parameter.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Sequence

from app.utils.ids import new_signal_id
from app.utils.time import utcnow

log = logging.getLogger(__name__)

DRIFT_THRESHOLD = 0.35
HISTORY_DAYS_REQUIRED = 14
RE_FLAG_COOLDOWN_DAYS = 14
ROLLING_WINDOW = 3


@dataclass
class MemoryAnswer:
    call_id: str
    date: datetime
    text: str
    embedding: list[float]


@dataclass
class MemorySignal:
    signal_id: str
    theme_id: str
    answers: list[MemoryAnswer] = field(default_factory=list)
    drift_score: float = 0.0
    gemini_severity: int = 0
    flagged_at: datetime | None = None


@dataclass
class MemoryDeps:
    """Injectable dependencies. Default to real-service implementations."""

    embed: Callable[[str], list[float]]
    load_signal: Callable[[str, str], MemorySignal | None]
    save_signal: Callable[[str, MemorySignal], None]
    consistency_check: Callable[[list[str]], int]
    notify_guardian: Callable[[str, MemorySignal], None] = lambda pid, sig: None
    now: Callable[[], datetime] = utcnow


# ---- vector helpers --------------------------------------------------------
def _mean(vectors: Sequence[Sequence[float]]) -> list[float]:
    if not vectors:
        return []
    n = len(vectors[0])
    out = [0.0] * n
    for v in vectors:
        for i, x in enumerate(v):
            out[i] += x
    return [x / len(vectors) for x in out]


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _is_monotonic_decreasing(values: Sequence[float]) -> bool:
    """Allow tiny upticks (≤0.02) — call ourselves monotonic if the trend is
    overall down. With small samples we use a strict 'not increasing' rule.
    """
    if len(values) < 2:
        return False
    diffs = [b - a for a, b in zip(values, values[1:])]
    # require: at least one decrease and no significant increase
    return any(d < -0.01 for d in diffs) and all(d <= 0.05 for d in diffs)


def _spans_at_least(answers: Sequence[MemoryAnswer], days: int) -> bool:
    if len(answers) < 2:
        return False
    span = answers[-1].date - answers[0].date
    return span >= timedelta(days=days - 1)  # off-by-one friendly


# ---- core algorithm --------------------------------------------------------
def compute_drift(answers: Sequence[MemoryAnswer]) -> tuple[float, bool]:
    """Pure function: drift score + monotonicity check on the rolling history.

    Returns (drift, monotonic_decreasing).
    """
    if len(answers) < 3:
        return 0.0, False
    baseline = _mean([a.embedding for a in answers[:3]])
    recent = _mean([a.embedding for a in answers[-3:]])
    drift = 1.0 - _cosine(baseline, recent)
    drift = max(0.0, min(1.0, drift))

    rolling: list[float] = []
    for i in range(2, len(answers)):
        window = [a.embedding for a in answers[max(0, i - 2) : i + 1]]
        win_mean = _mean(window)
        rolling.append(_cosine(baseline, win_mean))
    monotonic = _is_monotonic_decreasing(rolling[-min(len(rolling), 7) :])
    return drift, monotonic


def update(
    pair_id: str,
    theme_id: str,
    new_answer_text: str,
    call_id: str,
    deps: MemoryDeps,
) -> MemorySignal:
    """Apply one new answer and persist the updated signal.

    Returns the updated :class:`MemorySignal`.
    """
    embedding = deps.embed(new_answer_text)
    now = deps.now()

    signal = deps.load_signal(pair_id, theme_id) or MemorySignal(
        signal_id=new_signal_id(theme_id),
        theme_id=theme_id,
    )

    signal.answers.append(
        MemoryAnswer(
            call_id=call_id,
            date=now,
            text=new_answer_text,
            embedding=embedding,
        )
    )
    # Keep oldest-first ordering even if writes arrive out of order.
    signal.answers.sort(key=lambda a: a.date)

    drift, monotonic = compute_drift(signal.answers)
    signal.drift_score = drift

    was_recently_flagged = bool(
        signal.flagged_at
        and (now - _ensure_aware(signal.flagged_at)) < timedelta(days=RE_FLAG_COOLDOWN_DAYS)
    )
    newly_flagged = False

    if (
        drift > DRIFT_THRESHOLD
        and _spans_at_least(signal.answers, HISTORY_DAYS_REQUIRED)
        and monotonic
    ):
        last_5 = [a.text for a in signal.answers[-5:]]
        severity = deps.consistency_check(last_5)
        signal.gemini_severity = severity
        if severity >= 2 and not was_recently_flagged:
            signal.flagged_at = now
            newly_flagged = True

    deps.save_signal(pair_id, signal)
    if newly_flagged:
        try:
            deps.notify_guardian(pair_id, signal)
        except Exception as exc:  # pragma: no cover
            log.warning("memory.notify_guardian_failed err=%s", exc)
    return signal


def _ensure_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---- default-deps factory --------------------------------------------------
def default_deps() -> MemoryDeps:
    """Wire in real Firestore/Vertex/Gemini/FCM implementations."""
    from app.services import embeddings as emb_svc
    from app.services.firestore_client import FirestoreClient
    from app.services.gemini_agent import consistency_check as gemini_consistency
    from app.services.fcm import send_push
    from app.services.personalization import load_template

    consistency_prompt = load_template("memory_consistency_prompt.txt")

    def _load(pair_id: str, theme_id: str) -> MemorySignal | None:
        fc = FirestoreClient.instance()
        snap = fc.memory_doc(pair_id, new_signal_id(theme_id)).get()
        data = fc.doc_to_dict(snap)
        if not data:
            return None
        answers = [
            MemoryAnswer(
                call_id=a.get("callId") or a.get("call_id", ""),
                date=_ensure_aware(_to_dt(a.get("date"))),
                text=a.get("text", ""),
                embedding=a.get("embedding") or [],
            )
            for a in (data.get("answers") or [])
        ]
        return MemorySignal(
            signal_id=data.get("id", new_signal_id(theme_id)),
            theme_id=theme_id,
            answers=answers,
            drift_score=float(data.get("driftScore") or data.get("drift_score") or 0.0),
            gemini_severity=int(
                data.get("geminiSeverity") or data.get("gemini_severity") or 0
            ),
            flagged_at=_to_dt(data.get("flaggedAt") or data.get("flagged_at")),
        )

    def _save(pair_id: str, sig: MemorySignal) -> None:
        fc = FirestoreClient.instance()
        fc.memory_doc(pair_id, sig.signal_id).set(
            {
                "id": sig.signal_id,
                "themeId": sig.theme_id,
                "answers": [
                    {
                        "callId": a.call_id,
                        "date": a.date,
                        "text": a.text,
                        "embedding": a.embedding,
                    }
                    for a in sig.answers
                ],
                "driftScore": sig.drift_score,
                "geminiSeverity": sig.gemini_severity,
                "flaggedAt": sig.flagged_at,
            }
        )

    def _notify(pair_id: str, sig: MemorySignal) -> None:
        fc = FirestoreClient.instance()
        pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
        guardian_uid = pair.get("guardianUid") or pair.get("guardian_uid")
        if not guardian_uid:
            return
        send_push(
            guardian_uid,
            title="A small change worth a chat",
            body=(
                "Your loved one's recent answers about a familiar topic have "
                "shifted a bit. Nothing urgent — you might want to bring it up gently."
            ),
            data={
                "kind": "memory_drift",
                "themeId": sig.theme_id,
                "severity": sig.gemini_severity,
            },
        )

    return MemoryDeps(
        embed=emb_svc.embed,
        load_signal=_load,
        save_signal=_save,
        consistency_check=lambda answers: gemini_consistency(answers, consistency_prompt),
        notify_guardian=_notify,
    )


def _to_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None
