"""The single source of truth for Firestore collection paths.

Every other module reaches Firestore through helper getters defined here. This
keeps document layout changes contained and makes it impossible to accidentally
sprinkle raw collection strings throughout the codebase.
"""

from __future__ import annotations

import logging
import os
from threading import Lock
from typing import TYPE_CHECKING, Any

from app.config import get_settings

if TYPE_CHECKING:  # pragma: no cover - for typing only
    from google.cloud.firestore_v1.client import Client
    from google.cloud.firestore_v1.collection import CollectionReference
    from google.cloud.firestore_v1.document import DocumentReference


log = logging.getLogger(__name__)

# Collection-name constants live here and ONLY here.
USERS = "users"
PAIRS = "pairs"
PAIRING_CODES = "pairing_codes"
SCHEDULES = "schedules"
QUESTIONS = "questions"
MEDICATIONS = "medications"
CALLS = "calls"
MEMORY_SIGNALS = "memory_signals"
ITEMS = "items"  # subcollection under per-pair containers


class FirestoreClient:
    """Process-wide singleton wrapping the google-cloud-firestore Client."""

    _instance: "FirestoreClient | None" = None
    _lock = Lock()

    def __init__(self) -> None:
        from google.cloud import firestore  # imported here so tests can monkeypatch

        settings = get_settings()
        # Honor FIRESTORE_EMULATOR_HOST automatically via google-cloud-firestore.
        if settings.firestore_emulator_host:
            os.environ.setdefault(
                "FIRESTORE_EMULATOR_HOST", settings.firestore_emulator_host
            )

        project = settings.google_cloud_project or settings.firebase_project_id or None
        self._client: Client = firestore.Client(project=project)
        log.info(
            "firestore.init project=%s emulator=%s",
            project,
            bool(settings.firestore_emulator_host or os.getenv("FIRESTORE_EMULATOR_HOST")),
        )

    # ---- singleton accessor -------------------------------------------------
    @classmethod
    def instance(cls) -> "FirestoreClient":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @classmethod
    def reset(cls) -> None:  # pragma: no cover - used by tests
        with cls._lock:
            cls._instance = None

    @property
    def client(self) -> "Client":
        return self._client

    # ---- USERS --------------------------------------------------------------
    def users_collection(self) -> "CollectionReference":
        return self._client.collection(USERS)

    def user_doc(self, uid: str) -> "DocumentReference":
        return self._client.collection(USERS).document(uid)

    # ---- PAIRS --------------------------------------------------------------
    def pairs_collection(self) -> "CollectionReference":
        return self._client.collection(PAIRS)

    def pair_doc(self, pair_id: str) -> "DocumentReference":
        return self._client.collection(PAIRS).document(pair_id)

    # ---- PAIRING CODES ------------------------------------------------------
    def pairing_codes_collection(self) -> "CollectionReference":
        return self._client.collection(PAIRING_CODES)

    def pairing_code_doc(self, code: str) -> "DocumentReference":
        return self._client.collection(PAIRING_CODES).document(code)

    # ---- SCHEDULES ----------------------------------------------------------
    def schedules_collection(self) -> "CollectionReference":
        return self._client.collection(SCHEDULES)

    def schedule_doc(self, pair_id: str) -> "DocumentReference":
        return self._client.collection(SCHEDULES).document(pair_id)

    # ---- QUESTIONS ----------------------------------------------------------
    def questions_collection(self, pair_id: str) -> "CollectionReference":
        return (
            self._client.collection(QUESTIONS).document(pair_id).collection(ITEMS)
        )

    def question_doc(self, pair_id: str, qid: str) -> "DocumentReference":
        return self.questions_collection(pair_id).document(qid)

    # ---- MEDICATIONS --------------------------------------------------------
    def medications_collection(self, pair_id: str) -> "CollectionReference":
        return (
            self._client.collection(MEDICATIONS).document(pair_id).collection(ITEMS)
        )

    def medication_doc(self, pair_id: str, mid: str) -> "DocumentReference":
        return self.medications_collection(pair_id).document(mid)

    # ---- CALLS --------------------------------------------------------------
    def calls_collection(self, pair_id: str) -> "CollectionReference":
        return self._client.collection(CALLS).document(pair_id).collection(ITEMS)

    def call_doc(self, pair_id: str, call_id: str) -> "DocumentReference":
        return self.calls_collection(pair_id).document(call_id)

    # ---- MEMORY SIGNALS -----------------------------------------------------
    def memory_collection(self, pair_id: str) -> "CollectionReference":
        return (
            self._client.collection(MEMORY_SIGNALS).document(pair_id).collection(ITEMS)
        )

    def memory_doc(self, pair_id: str, signal_id: str) -> "DocumentReference":
        return self.memory_collection(pair_id).document(signal_id)

    # ---- helpers ------------------------------------------------------------
    @staticmethod
    def doc_to_dict(snapshot_or_ref) -> dict[str, Any] | None:
        """Accept a DocumentSnapshot OR a DocumentReference (will fetch).

        Returns ``None`` when the document does not exist.
        """
        snap = snapshot_or_ref
        # If it looks like a reference (has .get() but no .exists yet), fetch it.
        if not hasattr(snap, "exists") or callable(getattr(snap, "exists", None)):
            try:
                snap = snap.get()
            except Exception:
                pass
        if not getattr(snap, "exists", False):
            return None
        data = snap.to_dict() or {}
        data.setdefault("id", snap.id)
        return data
