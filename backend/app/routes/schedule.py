"""Schedule CRUD."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.schemas.schedules import Schedule, ScheduleUpsert
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, require_pair_member, verify_firebase_token

router = APIRouter()


def _load_pair(fc: FirestoreClient, pair_id: str) -> dict:
    pair = fc.doc_to_dict(fc.pair_doc(pair_id))
    if not pair:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="pair_not_found"
        )
    return pair


@router.get("/{pair_id}", response_model=Schedule, response_model_by_alias=True)
async def get_schedule(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Schedule:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    snap = fc.schedule_doc(pair_id).get()
    data = fc.doc_to_dict(snap)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="schedule_not_found"
        )
    return Schedule.model_validate(data)


@router.put("/{pair_id}", response_model=Schedule, response_model_by_alias=True)
async def upsert_schedule(
    pair_id: str,
    body: ScheduleUpsert,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Schedule:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    payload = body.model_dump(by_alias=True)
    payload["id"] = pair_id
    fc.schedule_doc(pair_id).set(payload, merge=True)
    return Schedule.model_validate(payload)


@router.delete("/{pair_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_schedule(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> None:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    fc.schedule_doc(pair_id).set({"enabled": False}, merge=True)
