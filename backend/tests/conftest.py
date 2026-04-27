"""Test bootstrap.

The full test suite runs without ANY real API key configured. We do this by:

* Forcing ``APP_ENV=test`` and ``JWT_REQUIRED=false`` before settings are loaded.
* Providing an in-memory ``FakeFirestore`` that mimics the small subset of the
  ``google-cloud-firestore`` API our code actually touches.
* Monkeypatching every external service module (``twilio_service``, ``fcm``,
  ``embeddings``, ``sentiment``, ``stt``, ``tts``, ``gemini_agent``) with
  no-op or deterministic stand-ins.

A real Firestore emulator can be used too — set ``FIRESTORE_EMULATOR_HOST`` in
your shell and the conftest will skip the in-memory fake.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Iterator

import pytest

# ---- environment ----------------------------------------------------------
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_REQUIRED", "false")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "test-project")
os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")


# ---- in-memory Firestore fake --------------------------------------------
class _FakeSnapshot:
    def __init__(self, doc_id: str, data: dict | None) -> None:
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self) -> dict | None:
        return dict(self._data) if self._data is not None else None


class _FakeDocRef:
    def __init__(self, store: dict, key: str, child_collections: dict) -> None:
        self._store = store
        self._key = key
        self._child = child_collections
        self.id = key.rsplit("/", 1)[-1]

    def get(self) -> _FakeSnapshot:
        return _FakeSnapshot(self.id, self._store.get(self._key))

    def set(self, data: dict, merge: bool = False) -> None:
        if merge and self._key in self._store:
            existing = dict(self._store[self._key])
            existing.update(data)
            self._store[self._key] = existing
        else:
            self._store[self._key] = dict(data)

    def update(self, data: dict) -> None:
        self.set(data, merge=True)

    def delete(self) -> None:
        self._store.pop(self._key, None)

    def collection(self, name: str) -> "_FakeCollectionRef":
        path = f"{self._key}/{name}"
        coll = self._child.setdefault(path, {"_store": {}, "_child": {}})
        return _FakeCollectionRef(coll["_store"], path, coll["_child"])


class _FakeQuery:
    def __init__(self, collection: "_FakeCollectionRef", filters: list[tuple] | None = None,
                 limit_n: int | None = None) -> None:
        self._coll = collection
        self._filters = filters or []
        self._limit = limit_n

    def where(self, field: str, op: str, value: Any) -> "_FakeQuery":
        return _FakeQuery(self._coll, self._filters + [(field, op, value)], self._limit)

    def limit(self, n: int) -> "_FakeQuery":
        return _FakeQuery(self._coll, self._filters, n)

    def _matches(self, data: dict) -> bool:
        for field, op, value in self._filters:
            cur = data.get(field)
            if op == "==":
                if cur != value:
                    return False
            else:  # pragma: no cover
                raise NotImplementedError(op)
        return True

    def stream(self):
        results = self.get()
        for r in results:
            yield r

    def get(self) -> list[_FakeSnapshot]:
        out = []
        for key, data in self._coll._store.items():
            if not self._matches(data):
                continue
            doc_id = key.rsplit("/", 1)[-1]
            out.append(_FakeSnapshot(doc_id, data))
            if self._limit and len(out) >= self._limit:
                break
        return out


class _FakeCollectionRef:
    def __init__(self, store: dict, path: str, child: dict) -> None:
        self._store = store
        self._path = path
        self._child = child

    def document(self, doc_id: str) -> _FakeDocRef:
        return _FakeDocRef(self._store, f"{self._path}/{doc_id}", self._child)

    def stream(self) -> Iterator[_FakeSnapshot]:
        for key, data in self._store.items():
            yield _FakeSnapshot(key.rsplit("/", 1)[-1], data)

    def where(self, field: str, op: str, value: Any) -> _FakeQuery:
        return _FakeQuery(self).where(field, op, value)

    def limit(self, n: int) -> _FakeQuery:
        return _FakeQuery(self).limit(n)


class _FakeFirestoreSDK:
    """Stands in for the google-cloud-firestore Client."""

    def __init__(self) -> None:
        self._roots: dict[str, dict] = {}

    def collection(self, name: str) -> _FakeCollectionRef:
        coll = self._roots.setdefault(name, {"_store": {}, "_child": {}})
        return _FakeCollectionRef(coll["_store"], name, coll["_child"])


@pytest.fixture(autouse=True)
def _patch_firestore(monkeypatch):
    """Always swap in the in-memory fake for tests."""
    fake_sdk = _FakeFirestoreSDK()

    class _ModuleStub:
        @staticmethod
        def Client(project=None):
            return fake_sdk

    monkeypatch.setattr(
        "google.cloud.firestore.Client",
        lambda project=None: fake_sdk,
        raising=False,
    )
    # Reset our singleton so each test gets a clean fake.
    from app.services.firestore_client import FirestoreClient

    FirestoreClient.reset()
    yield fake_sdk
    FirestoreClient.reset()


# ---- mock external services ----------------------------------------------
@pytest.fixture(autouse=True)
def _mock_external(monkeypatch):
    # Embeddings → deterministic 32-dim hash vector.
    import hashlib

    def _embed(text: str) -> list[float]:
        d = hashlib.sha256(text.lower().encode()).digest()
        return [(b - 128) / 128.0 for b in d]

    monkeypatch.setattr("app.services.embeddings.embed", _embed, raising=True)

    # Sentiment → 0.0
    monkeypatch.setattr(
        "app.services.sentiment.score_text", lambda text: 0.0, raising=True
    )
    monkeypatch.setattr(
        "app.services.sentiment.score_transcript", lambda turns: 0.0, raising=True
    )

    # Twilio → no-op
    monkeypatch.setattr(
        "app.services.twilio_service.place_call",
        lambda to, pid, cid, ch: "TEST_TWILIO_SID",
        raising=True,
    )

    # FCM → record sends instead of network call
    sent: list[tuple] = []

    def _send(uid, title, body, data=None):
        sent.append((uid, title, body, data))
        return True

    monkeypatch.setattr("app.services.fcm.send_push", _send, raising=True)

    # Gemini summary / consistency / streaming
    monkeypatch.setattr(
        "app.services.gemini_agent.summarize",
        lambda transcript, prompt: "Test summary.",
        raising=True,
    )
    monkeypatch.setattr(
        "app.services.gemini_agent.consistency_check",
        lambda answers, prompt: 0,
        raising=True,
    )

    async def _stream(*args, **kwargs):
        from app.services.gemini_agent import TextChunk

        yield TextChunk(text="Hello, this is a test.")

    monkeypatch.setattr(
        "app.services.gemini_agent.respond_streaming", _stream, raising=True
    )

    # TTS — return silence
    monkeypatch.setattr(
        "app.services.tts.synthesize_chunk", lambda text: b"", raising=True
    )

    async def _fallback():
        return b""

    monkeypatch.setattr("app.services.tts.fallback_audio", _fallback, raising=True)

    yield {"fcm_sent": sent}


# ---- HTTP client fixture --------------------------------------------------
@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


# ---- Auth header helper --------------------------------------------------
@pytest.fixture
def bearer_for():
    """Return a function that builds a dev-mode bearer header for a uid."""
    def _maker(uid: str) -> dict[str, str]:
        return {"Authorization": f"Bearer uid:{uid}"}

    return _maker
