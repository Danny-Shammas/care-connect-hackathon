"""Personalization-question CRUD."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import firestore_dep
from app.schemas.questions import Question, QuestionUpsert
from app.services.firestore_client import FirestoreClient
from app.utils.auth import AuthContext, require_pair_member, verify_firebase_token

router = APIRouter()


def _load_pair(fc: FirestoreClient, pair_id: str) -> dict:
    pair = fc.doc_to_dict(fc.pair_doc(pair_id))
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pair_not_found")
    return pair


@router.get("/{pair_id}", response_model=list[Question], response_model_by_alias=True)
async def list_questions(
    pair_id: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> list[Question]:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    out = []
    for snap in fc.questions_collection(pair_id).stream():
        data = fc.doc_to_dict(snap)
        if data:
            out.append(Question.model_validate(data))
    return out


@router.post("/{pair_id}", response_model=Question, response_model_by_alias=True)
async def create_question(
    pair_id: str,
    body: QuestionUpsert,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Question:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    qid = f"q_{uuid.uuid4().hex[:10]}"
    payload = body.model_dump(by_alias=True)
    payload["id"] = qid
    payload["lastAskedAt"] = None
    fc.question_doc(pair_id, qid).set(payload)
    return Question.model_validate(payload)


@router.put("/{pair_id}/{qid}", response_model=Question, response_model_by_alias=True)
async def update_question(
    pair_id: str,
    qid: str,
    body: QuestionUpsert,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> Question:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    payload = body.model_dump(by_alias=True)
    payload["id"] = qid
    fc.question_doc(pair_id, qid).set(payload, merge=True)
    snap = fc.question_doc(pair_id, qid).get()
    return Question.model_validate(fc.doc_to_dict(snap) or payload)


@router.delete("/{pair_id}/{qid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    pair_id: str,
    qid: str,
    auth: AuthContext = Depends(verify_firebase_token),
    fc: FirestoreClient = Depends(firestore_dep),
) -> None:
    pair = _load_pair(fc, pair_id)
    require_pair_member(auth, pair)
    fc.question_doc(pair_id, qid).delete()
