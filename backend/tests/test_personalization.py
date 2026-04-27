from datetime import timedelta

from app.services.firestore_client import FirestoreClient
from app.services.personalization import build_system_prompt
from app.utils.time import utcnow


def _setup_pair(fc: FirestoreClient) -> str:
    pair_id = "pair_p1"
    fc.user_doc("g1").set({"id": "g1", "role": "guardian", "name": "Marko",
                            "phoneNumber": "+1", "timezone": "Europe/Belgrade"})
    fc.user_doc("e1").set({"id": "e1", "role": "elder", "name": "Milica",
                            "phoneNumber": "+2", "timezone": "Europe/Belgrade"})
    fc.pair_doc(pair_id).set({
        "id": pair_id, "elderUid": "e1", "guardianUid": "g1",
        "members": ["e1", "g1"], "status": "active", "createdAt": utcnow(),
    })
    fc.schedule_doc(pair_id).set({"id": pair_id, "callTime": "09:00",
                                   "frequency": "daily", "mood": "warm",
                                   "voicePreset": "v", "enabled": True})
    fc.medication_doc(pair_id, "med1").set({"id": "med1", "name": "Lisinopril",
                                             "dose": "10mg", "time": "08:30",
                                             "active": True})
    fc.question_doc(pair_id, "q1").set({"id": "q1", "text": "How is Max the cat?",
                                         "themeId": "pet", "category": "pet",
                                         "askEvery": 1, "lastAskedAt": utcnow() - timedelta(days=2)})
    return pair_id


def test_build_system_prompt_renders_all_fields():
    fc = FirestoreClient.instance()
    pair_id = _setup_pair(fc)

    out = build_system_prompt(pair_id, fc)
    prompt = out["system_prompt"]
    assert "Milica" in prompt
    assert "Marko" in prompt
    assert "warm" in prompt
    assert "Lisinopril" in prompt
    assert "How is Max the cat?" in prompt


def test_build_system_prompt_no_meds():
    fc = FirestoreClient.instance()
    pair_id = _setup_pair(fc)
    fc.medication_doc(pair_id, "med1").set({"active": False}, merge=True)

    out = build_system_prompt(pair_id, fc)
    assert "no medications scheduled" in out["system_prompt"]
