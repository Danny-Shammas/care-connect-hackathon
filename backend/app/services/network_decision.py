"""Decide whether to call over internet, PSTN, or skip the call entirely.

Rules (per spec):

* If the elder is roaming → ``skipped_roaming`` (we won't burn international
  data on them).
* If we've heard from the elder's device in the last 5 minutes → ``internet``.
* Otherwise → ``pstn`` (Twilio places a regular phone call).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Literal

from app.services.firestore_client import FirestoreClient
from app.utils.time import utcnow

log = logging.getLogger(__name__)

Channel = Literal["internet", "pstn", "skipped_roaming"]

PRESENCE_FRESH = timedelta(minutes=5)


def choose_channel(pair_id: str, fc: FirestoreClient | None = None) -> Channel:
    fc = fc or FirestoreClient.instance()
    pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
    elder_uid = pair.get("elderUid") or pair.get("elder_uid")
    if not elder_uid:
        return "pstn"
    elder = fc.doc_to_dict(fc.user_doc(elder_uid)) or {}

    if bool(elder.get("isRoaming") or elder.get("is_roaming")):
        log.info("network.skipped_roaming pair=%s", pair_id)
        return "skipped_roaming"

    last_seen = elder.get("lastSeen") or elder.get("last_seen")
    if last_seen:
        if isinstance(last_seen, str):
            try:
                last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
            except ValueError:
                last_seen = None
        if last_seen and last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        if last_seen and (utcnow() - last_seen) < PRESENCE_FRESH:
            log.info("network.internet pair=%s", pair_id)
            return "internet"

    log.info("network.pstn pair=%s", pair_id)
    return "pstn"
