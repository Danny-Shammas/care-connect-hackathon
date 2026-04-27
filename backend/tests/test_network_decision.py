from datetime import timedelta

from freezegun import freeze_time

from app.services.firestore_client import FirestoreClient
from app.services.network_decision import choose_channel
from app.utils.time import utcnow


def _make_pair(fc: FirestoreClient, *, roaming: bool = False, last_seen_minutes_ago: int | None = 1) -> str:
    pair_id = "pair_n1"
    last_seen = (
        utcnow() - timedelta(minutes=last_seen_minutes_ago)
        if last_seen_minutes_ago is not None
        else None
    )
    fc.user_doc("e1").set({
        "id": "e1", "role": "elder", "name": "M", "phoneNumber": "+1",
        "timezone": "UTC",
        "lastSeen": last_seen,
        "isRoaming": roaming,
    })
    fc.pair_doc(pair_id).set({
        "id": pair_id, "elderUid": "e1", "guardianUid": "g1",
        "members": ["e1", "g1"], "status": "active",
    })
    return pair_id


@freeze_time("2026-04-25 09:00:00")
def test_roaming_returns_skipped():
    fc = FirestoreClient.instance()
    pid = _make_pair(fc, roaming=True)
    assert choose_channel(pid, fc) == "skipped_roaming"


@freeze_time("2026-04-25 09:00:00")
def test_recent_presence_returns_internet():
    fc = FirestoreClient.instance()
    pid = _make_pair(fc, last_seen_minutes_ago=2)
    assert choose_channel(pid, fc) == "internet"


@freeze_time("2026-04-25 09:00:00")
def test_stale_presence_returns_pstn():
    fc = FirestoreClient.instance()
    pid = _make_pair(fc, last_seen_minutes_ago=30)
    assert choose_channel(pid, fc) == "pstn"


@freeze_time("2026-04-25 09:00:00")
def test_no_presence_returns_pstn():
    fc = FirestoreClient.instance()
    pid = _make_pair(fc, last_seen_minutes_ago=None)
    assert choose_channel(pid, fc) == "pstn"
