"""After the call ends: summarize, score mood, update memory signals, persist."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.services import gemini_agent, sentiment
from app.services.firestore_client import FirestoreClient
from app.services.memory_engine import default_deps as default_memory_deps
from app.services.memory_engine import update as memory_update
from app.services.personalization import load_template
from app.utils.time import utcnow

log = logging.getLogger(__name__)


def _ensure_aware(dt: datetime | None) -> datetime | None:
    if not dt:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _adherence_rate(pair_id: str, fc: FirestoreClient) -> float:
    """Confirmed-meds / scheduled-meds over the last 7 days."""
    cutoff = utcnow() - timedelta(days=7)
    confirmed = 0
    scheduled = 0
    for snap in fc.calls_collection(pair_id).stream():
        c = fc.doc_to_dict(snap) or {}
        started_at = _ensure_aware(_to_dt(c.get("startedAt") or c.get("started_at")))
        if not started_at or started_at < cutoff:
            continue
        confirmed += len(c.get("medsConfirmed") or c.get("meds_confirmed") or [])
    # Total meds active in the pair × 7 days as the denominator.
    active_meds = sum(
        1 for snap in fc.medications_collection(pair_id).stream()
        if (fc.doc_to_dict(snap) or {}).get("active", True)
    )
    scheduled = active_meds * 7
    return (confirmed / scheduled) if scheduled else 0.0


def _to_dt(value):
    if value is None or isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def finalize(
    pair_id: str,
    call_id: str,
    transcript: list[dict],
    meds_confirmed: list[str],
    flags: list[dict],
    recording_url: str | None = None,
    fc: FirestoreClient | None = None,
) -> dict:
    """Run the post-call pipeline and persist the call doc.

    Returns a dict with the keys written to Firestore (useful for tests).
    """
    fc = fc or FirestoreClient.instance()
    log.info(
        "post_call.start", extra={"pair_id": pair_id, "call_id": call_id}
    )

    summary_prompt = load_template("summary_prompt.txt")
    summary = gemini_agent.summarize(transcript, summary_prompt)
    mood = sentiment.score_transcript(transcript)

    # ---- Memory signals: any user turn that answered a themed question ----
    deps = default_memory_deps()
    questions = {
        (fc.doc_to_dict(snap) or {}).get("themeId", ""):
            (fc.doc_to_dict(snap) or {}).get("text", "")
        for snap in fc.questions_collection(pair_id).stream()
    }
    user_answers = [t for t in transcript if t.get("role") == "user"]
    for theme_id, q_text in questions.items():
        if not theme_id:
            continue
        # Heuristic: take the first user turn whose text mentions any token
        # from the question's keywords (length ≥ 4) — keeps this simple
        # without an extra Gemini call. The orchestrator can override by
        # passing a structured (themeId → answer) map upstream in the future.
        keywords = [w.lower() for w in q_text.split() if len(w) >= 4]
        match = next(
            (
                t["text"]
                for t in user_answers
                if any(k in t["text"].lower() for k in keywords)
            ),
            None,
        )
        if not match:
            continue
        try:
            memory_update(pair_id, theme_id, match, call_id, deps)
        except Exception as exc:  # pragma: no cover
            log.warning("memory.update_failed theme=%s err=%s", theme_id, exc)

    started_at = transcript[0]["ts"] if transcript else utcnow()
    started_at = _ensure_aware(started_at) or utcnow()
    ended_at = utcnow()
    duration = int((ended_at - started_at).total_seconds())

    payload = {
        "id": call_id,
        "startedAt": started_at,
        "endedAt": ended_at,
        "durationSec": duration,
        "answered": True,
        "channel": "internet",  # may be overridden by caller via .update()
        "transcript": transcript,
        "summary": summary,
        "moodScore": mood,
        "medsConfirmed": meds_confirmed,
        "flags": flags,
        "recordingUrl": recording_url,
    }
    fc.call_doc(pair_id, call_id).set(payload, merge=True)
    log.info(
        "post_call.persisted", extra={"pair_id": pair_id, "call_id": call_id}
    )

    # Adherence is computed but not persisted on the call doc — it's a derived
    # metric the reports endpoint computes on demand.
    return payload


def write_skipped_or_failed(
    pair_id: str,
    call_id: str,
    channel: str,
    reason: str = "",
    fc: FirestoreClient | None = None,
) -> dict:
    """Used when no audio call was attempted (skipped roaming) or service failed."""
    fc = fc or FirestoreClient.instance()
    now = utcnow()
    payload = {
        "id": call_id,
        "startedAt": now,
        "endedAt": now,
        "durationSec": 0,
        "answered": False,
        "channel": channel,
        "transcript": [],
        "summary": reason,
        "moodScore": 0.0,
        "medsConfirmed": [],
        "flags": [],
        "recordingUrl": None,
    }
    fc.call_doc(pair_id, call_id).set(payload, merge=True)
    log.info(
        "post_call.skipped channel=%s reason=%s",
        channel,
        reason,
        extra={"pair_id": pair_id, "call_id": call_id},
    )
    return payload
