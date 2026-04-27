"""Cloud Scheduler tick endpoint.

Cloud Scheduler hits this once per minute. We iterate every enabled schedule
and trigger any whose ``callTime`` matches the current minute *in the elder's
timezone*, within a 1-minute window.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends

from app.deps import firestore_dep, require_scheduler_secret
from app.pipelines.call_orchestrator import start_call
from app.services.firestore_client import FirestoreClient
from app.utils.time import hhmm_within_window, local_hhmm_now

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/tick", dependencies=[Depends(require_scheduler_secret)])
async def tick(
    background: BackgroundTasks,
    fc: FirestoreClient = Depends(firestore_dep),
) -> dict:
    triggered = []
    skipped_disabled = 0
    skipped_window = 0

    for snap in fc.schedules_collection().stream():
        s = fc.doc_to_dict(snap)
        if not s:
            continue
        if not s.get("enabled", True):
            skipped_disabled += 1
            continue

        pair_id = s.get("id") or snap.id
        pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
        elder_uid = pair.get("elderUid") or pair.get("elder_uid")
        elder = fc.doc_to_dict(fc.user_doc(elder_uid)) if elder_uid else {}
        tz_name = (elder or {}).get("timezone") or "UTC"

        try:
            current = local_hhmm_now(tz_name)
        except Exception:
            current = local_hhmm_now("UTC")

        target = s.get("callTime") or s.get("call_time")
        if not target:
            continue
        if not hhmm_within_window(target, current, window_min=1):
            skipped_window += 1
            continue

        log.info(
            "scheduler.trigger pair=%s tz=%s target=%s current=%s",
            pair_id,
            tz_name,
            target,
            current,
        )
        triggered.append(pair_id)
        background.add_task(start_call, pair_id)

    return {
        "triggered": triggered,
        "skippedDisabled": skipped_disabled,
        "skippedOutsideWindow": skipped_window,
    }
