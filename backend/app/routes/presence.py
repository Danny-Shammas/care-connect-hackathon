"""Mobile presence heartbeat."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.schemas.users import PresenceUpdate
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, verify_firebase_token

router = APIRouter()


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def update_presence(
    body: PresenceUpdate,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> None:
    if auth.uid != body.uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="uid_mismatch")
    payload = {
        "lastSeen": body.last_seen,
        "isRoaming": body.is_roaming,
    }
    if body.fcm_token:
        payload["fcmToken"] = body.fcm_token
    fc.user_doc(body.uid).set(payload, merge=True)
