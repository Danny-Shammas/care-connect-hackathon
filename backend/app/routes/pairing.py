"""Guardian ↔ elder pairing flow."""

from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.schemas.pairs import (
    PairingCodeRequest,
    PairingCodeResponse,
    PairingRedeemRequest,
    PairingRedeemResponse,
)
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, verify_firebase_token
from app.utils.ids import new_pairing_code
from app.utils.time import utcnow

log = logging.getLogger(__name__)
router = APIRouter()

CODE_TTL = timedelta(minutes=10)


@router.post("/code", response_model=PairingCodeResponse, response_model_by_alias=True)
async def create_pairing_code(
    body: PairingCodeRequest | None = None,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> PairingCodeResponse:
    guardian_uid = (body.guardian_uid if body else None) or auth.uid
    expires_at = utcnow() + CODE_TTL

    # Generate a code that doesn't already exist (cheap; 6 digits = 1M space).
    for _ in range(6):
        code = new_pairing_code()
        snap = fc.pairing_code_doc(code).get()
        if not snap.exists:
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="code_space_exhausted"
        )

    fc.pairing_code_doc(code).set(
        {
            "id": code,
            "guardianUid": guardian_uid,
            "expiresAt": expires_at,
            "used": False,
        }
    )
    log.info("pairing.code_created guardian=%s", guardian_uid)
    return PairingCodeResponse(code=code, expiresAt=expires_at)


@router.post(
    "/redeem", response_model=PairingRedeemResponse, response_model_by_alias=True
)
async def redeem_pairing_code(
    body: PairingRedeemRequest,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> PairingRedeemResponse:
    code_ref = fc.pairing_code_doc(body.code)
    code_doc = fc.doc_to_dict(code_ref.get())
    if not code_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="code_not_found"
        )

    expires_at = code_doc.get("expiresAt") or code_doc.get("expires_at")
    if expires_at and hasattr(expires_at, "tzinfo"):
        if expires_at.tzinfo is None:
            from datetime import timezone

            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < utcnow():
            raise HTTPException(
                status_code=status.HTTP_410_GONE, detail="code_expired"
            )

    if code_doc.get("used") and code_doc.get("usedBy") and code_doc.get("usedBy") != auth.uid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="code_already_used")

    guardian_uid = code_doc.get("guardianUid") or code_doc.get("guardian_uid")
    if not guardian_uid:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="malformed_code_doc"
        )

    elder_uid = body.elder_uid

    # Idempotent: if we already have an active pair for this (guardian, elder), reuse it.
    existing = (
        fc.pairs_collection()
        .where("elderUid", "==", elder_uid)
        .where("guardianUid", "==", guardian_uid)
        .limit(1)
        .get()
    )
    if existing:
        pair_doc = existing[0]
        log.info("pairing.idempotent pair=%s", pair_doc.id)
        return PairingRedeemResponse(
            pairId=pair_doc.id, elderUid=elder_uid, guardianUid=guardian_uid
        )

    pair_id = f"pair_{guardian_uid[:6]}_{elder_uid[:6]}_{int(utcnow().timestamp())}"
    fc.pair_doc(pair_id).set(
        {
            "id": pair_id,
            "elderUid": elder_uid,
            "guardianUid": guardian_uid,
            "members": [elder_uid, guardian_uid],
            "status": "active",
            "createdAt": utcnow(),
        }
    )
    fc.user_doc(elder_uid).set({"linkedTo": guardian_uid}, merge=True)
    fc.user_doc(guardian_uid).set({"linkedTo": elder_uid}, merge=True)
    code_ref.set({"used": True, "usedBy": auth.uid}, merge=True)

    log.info(
        "pairing.created", extra={"pair_id": pair_id, "request_id": None, "call_id": None}
    )
    return PairingRedeemResponse(
        pairId=pair_id, elderUid=elder_uid, guardianUid=guardian_uid
    )
