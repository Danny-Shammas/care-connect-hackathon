"""Firebase Cloud Messaging push helper."""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def _ensure_app() -> None:
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:  # type: ignore[attr-defined]
        return
    try:
        firebase_admin.initialize_app(credentials.ApplicationDefault())
    except Exception:
        firebase_admin.initialize_app()


def send_push(uid: str, title: str, body: str, data: dict | None = None) -> bool:
    """Send an FCM push to a user identified by ``uid``.

    Looks up the user's ``fcmToken`` in Firestore. Returns True if the message
    was dispatched, False if the user has no token registered or if FCM rejected
    the send. Failures are logged but never raised — the call pipeline must not
    crash because a notification failed.
    """
    from app.services.firestore_client import FirestoreClient

    fc = FirestoreClient.instance()
    snap = fc.user_doc(uid).get()
    user = fc.doc_to_dict(snap) or {}
    token = user.get("fcmToken") or user.get("fcm_token")
    if not token:
        log.info("fcm.skip no_token uid=%s title=%s", uid, title)
        return False

    try:
        _ensure_app()
        from firebase_admin import messaging

        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
        )
        message_id = messaging.send(msg)
        log.info("fcm.sent uid=%s msg_id=%s", uid, message_id)
        return True
    except Exception as exc:  # pragma: no cover - network path
        log.warning("fcm.failed uid=%s err=%s", uid, exc)
        return False
