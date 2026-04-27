"""Call CRUD + the trigger endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.config import Settings, get_settings
from app.deps import firestore_dep
from app.pipelines.call_orchestrator import start_call
from app.schemas.calls import (
    Call,
    CallSummaryView,
    CallTriggerRequest,
    CallTriggerResponse,
)
from app.services.firestore_client import FirestoreClient
from app.services.gcs_client import get_gcs
from app.utils.auth import AuthContext, require_pair_member, verify_firebase_token

log = logging.getLogger(__name__)
router = APIRouter()


def _load_pair(fc: FirestoreClient, pair_id: str) -> dict:
    pair = fc.doc_to_dict(fc.pair_doc(pair_id))
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pair_not_found")
    return pair


async def _auth_or_scheduler(
    authorization: str | None = Header(default=None),
    x_scheduler_secret: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuthContext | None:
    """Allow either a Firebase token (guardian) OR the scheduler shared-secret."""
    if x_scheduler_secret and x_scheduler_secret == settings.scheduler_shared_secret:
        return None
    return await verify_firebase_token(authorization=authorization, settings=settings)


@router.post(
    "/trigger", response_model=CallTriggerResponse, response_model_by_alias=True
)
async def trigger_call(
    body: CallTriggerRequest,
    auth: AuthContext | None = Depends(_auth_or_scheduler),
    fc: FirestoreClient = Depends(firestore_dep),
) -> CallTriggerResponse:
    pair = _load_pair(fc, body.pair_id)
    if auth is not None:
        require_pair_member(auth, pair)
    result = await start_call(body.pair_id)
    return CallTriggerResponse(
        callId=result["call_id"], pairId=body.pair_id, channel=result["channel"]
    )


@router.get(
    "/{pair_id}",
    response_model=list[CallSummaryView],
    response_model_by_alias=True,
)
async def list_calls(
    pair_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> list[CallSummaryView]:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)

    # Order by startedAt desc; emulator doesn't always honor index hints, fall back to client-sort.
    docs = list(fc.calls_collection(pair_id).stream())
    items = []
    for d in docs:
        data = fc.doc_to_dict(d)
        if data:
            items.append(data)
    items.sort(key=lambda x: x.get("startedAt") or x.get("started_at") or 0, reverse=True)
    return [CallSummaryView.model_validate(i) for i in items[:limit]]


@router.get("/{pair_id}/{call_id}", response_model=Call, response_model_by_alias=True)
async def get_call(
    pair_id: str,
    call_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Call:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    snap = fc.call_doc(pair_id, call_id).get()
    data = fc.doc_to_dict(snap)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="call_not_found")

    # Sign the recording URL on the way out if it's a gs:// path.
    rec = data.get("recordingUrl") or data.get("recording_url")
    if rec and isinstance(rec, str) and rec.startswith("gs://"):
        try:
            blob_path = rec.split("/", 3)[3]
            data["recordingUrl"] = get_gcs().signed_url(blob_path)
        except Exception as exc:  # pragma: no cover
            log.warning("calls.signed_url_failed err=%s", exc)
    return Call.model_validate(data)
