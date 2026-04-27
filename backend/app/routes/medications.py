"""Medication CRUD."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.schemas.medications import Medication, MedicationUpsert
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, require_pair_member, verify_firebase_token

router = APIRouter()


def _load_pair(fc: FirestoreClient, pair_id: str) -> dict:
    pair = fc.doc_to_dict(fc.pair_doc(pair_id))
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pair_not_found")
    return pair


@router.get("/{pair_id}", response_model=list[Medication], response_model_by_alias=True)
async def list_meds(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> list[Medication]:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    out = []
    for snap in fc.medications_collection(pair_id).stream():
        data = fc.doc_to_dict(snap)
        if data:
            out.append(Medication.model_validate(data))
    return out


@router.post("/{pair_id}", response_model=Medication, response_model_by_alias=True)
async def create_med(
    pair_id: str,
    body: MedicationUpsert,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Medication:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    mid = f"m_{uuid.uuid4().hex[:10]}"
    payload = body.model_dump(by_alias=True)
    payload["id"] = mid
    fc.medication_doc(pair_id, mid).set(payload)
    return Medication.model_validate(payload)


@router.put("/{pair_id}/{mid}", response_model=Medication, response_model_by_alias=True)
async def update_med(
    pair_id: str,
    mid: str,
    body: MedicationUpsert,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Medication:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    payload = body.model_dump(by_alias=True)
    payload["id"] = mid
    fc.medication_doc(pair_id, mid).set(payload, merge=True)
    return Medication.model_validate(payload)


@router.delete("/{pair_id}/{mid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_med(
    pair_id: str,
    mid: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> None:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    fc.medication_doc(pair_id, mid).set({"active": False}, merge=True)
