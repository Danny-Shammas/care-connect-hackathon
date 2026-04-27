"""Daily and weekly report endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, require_pair_member, verify_firebase_token
from app.utils.time import utcnow

router = APIRouter()


def _ensure_aware(dt):
    if dt is None or not isinstance(dt, datetime):
        return dt
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _load_pair(fc: FirestoreClient, pair_id: str) -> dict:
    pair = fc.doc_to_dict(fc.pair_doc(pair_id))
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pair_not_found")
    return pair


@router.get("/daily/{pair_id}")
async def daily_report(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> dict:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)

    items = []
    for snap in fc.calls_collection(pair_id).stream():
        data = fc.doc_to_dict(snap)
        if data:
            items.append(data)
    if not items:
        return {"pairId": pair_id, "call": None}

    items.sort(key=lambda x: _ensure_aware(x.get("startedAt")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    latest = items[0]
    return {
        "pairId": pair_id,
        "call": {
            "callId": latest.get("id"),
            "startedAt": latest.get("startedAt"),
            "summary": latest.get("summary", ""),
            "moodScore": latest.get("moodScore", 0.0),
            "answered": latest.get("answered", False),
            "channel": latest.get("channel"),
            "medsConfirmed": latest.get("medsConfirmed", []),
            "flags": latest.get("flags", []),
        },
    }


@router.get("/weekly/{pair_id}")
async def weekly_report(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> dict:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)

    cutoff = utcnow() - timedelta(days=7)
    mood_series: list[dict] = []
    confirmed_count = 0
    missed_count = 0
    flag_buckets: dict[str, int] = {}

    items = []
    for snap in fc.calls_collection(pair_id).stream():
        data = fc.doc_to_dict(snap)
        if not data:
            continue
        started = _ensure_aware(data.get("startedAt"))
        if not started or started < cutoff:
            continue
        items.append(data)

    items.sort(key=lambda x: _ensure_aware(x.get("startedAt")))
    for c in items:
        mood_series.append(
            {"ts": c.get("startedAt"), "mood": c.get("moodScore", 0.0)}
        )
        if c.get("answered"):
            confirmed_count += len(c.get("medsConfirmed") or [])
        else:
            missed_count += 1
        for f in c.get("flags") or []:
            flag_buckets[f.get("type", "other")] = flag_buckets.get(f.get("type", "other"), 0) + 1

    active_meds = sum(
        1
        for snap in fc.medications_collection(pair_id).stream()
        if (fc.doc_to_dict(snap) or {}).get("active", True)
    )
    scheduled = active_meds * 7
    adherence = (confirmed_count / scheduled) if scheduled else 0.0

    return {
        "pairId": pair_id,
        "moodSeries": mood_series,
        "adherenceRate": adherence,
        "missedCalls": missed_count,
        "flagsByType": flag_buckets,
        "callCount": len(items),
    }
