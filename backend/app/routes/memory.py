"""Memory-engine read endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.schemas.memory import MemoryAnswer, MemoryThemeView
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, require_pair_member, verify_firebase_token

router = APIRouter()


@router.get(
    "/{pair_id}",
    response_model=list[MemoryThemeView],
    response_model_by_alias=True,
)
async def memory_view(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> list[MemoryThemeView]:
    pair = fc.doc_to_dict(fc.pair_doc(pair_id))
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pair_not_found")
    require_pair_member(auth, pair)

    out: list[MemoryThemeView] = []
    for snap in fc.memory_collection(pair_id).stream():
        data = fc.doc_to_dict(snap)
        if not data:
            continue
        recent = []
        for a in (data.get("answers") or [])[-5:]:
            recent.append(
                MemoryAnswer(
                    callId=a.get("callId") or a.get("call_id", ""),
                    date=a.get("date"),
                    text=a.get("text", ""),
                )
            )
        out.append(
            MemoryThemeView(
                themeId=data.get("themeId") or data.get("theme_id", ""),
                driftScore=float(data.get("driftScore") or data.get("drift_score") or 0.0),
                geminiSeverity=int(data.get("geminiSeverity") or data.get("gemini_severity") or 0),
                flaggedAt=data.get("flaggedAt") or data.get("flagged_at"),
                recentAnswers=recent,
            )
        )
    return out
