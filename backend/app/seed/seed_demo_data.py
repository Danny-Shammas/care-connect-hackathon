"""Seed demo data for the hackathon walkthrough.

Creates one paired guardian + elder, a 09:00 schedule, three personalized
questions, two medications, and **14 days of synthetic call history** with the
"Max the cat" theme drifting in the last 4 days. After running this, the
memory engine flags the cat-drift theme on the demo dashboard.

Run against the Firestore emulator:

    export FIRESTORE_EMULATOR_HOST=localhost:8080
    python -m app.seed.seed_demo_data

Or against live Firestore: just leave the emulator var unset and make sure
your service account has access.

Embeddings are MOCKED here (deterministic hash-based vectors per phrase) so
seeding works without burning Vertex AI credits. The memory_engine code path
is otherwise identical to production.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.services.firestore_client import FirestoreClient
from app.services.memory_engine import (
    MemoryDeps,
    update as memory_update,
)
from app.utils.ids import new_call_id, new_signal_id
from app.utils.time import utcnow

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("seed")


GUARDIAN_UID = "demo_guardian_uid"
ELDER_UID = "demo_elder_uid"
PAIR_ID = "demo_pair_001"
THEME_PET = "pet_max_the_cat"
THEME_WALK = "morning_walk_routine"
THEME_GRANDKIDS = "grandkids_news"
MED_BP = "med_bp_lisinopril"
MED_VITD = "med_vitamin_d"


# Consistent answers (days 1..10) and drifting answers (days 11..14)
STABLE_PET_ANSWERS = [
    "Max is doing well, ate his breakfast and is sleeping in the sun.",
    "Oh Max is fine, he was on the windowsill all morning watching birds.",
    "Max is good, he had his fish kibble and a little tuna.",
    "He's a good cat. Sleeping right now under the kitchen table.",
    "Max is wonderful, he's been extra cuddly today.",
    "Max chased a fly around the living room earlier, made me laugh.",
    "Max ate everything in his bowl. He's getting a bit chubby.",
    "He's curled up next to me on the couch right now.",
    "Max has been quiet today, just napping mostly.",
    "Oh Max is great, came running when I shook his treat bag.",
]

DRIFT_PET_ANSWERS = [
    "Cat? I don't think we have a cat. The neighbor has one I think.",
    "Which one are you asking about? I'm not sure.",
    "I don't know, I haven't seen any animals today.",
    "There's no cat here. I think you might be confused.",
]

STABLE_WALK_ANSWERS = [
    "Yes I went out for a short walk to the post office.",
    "I walked around the block this morning, the air was nice.",
    "Just to the corner shop, my knees were a bit stiff.",
    "I sat on the bench by the park for a while.",
    "Walked to the bakery, got my bread.",
    "Just down the road and back. Nice and quiet.",
    "Yes a short one, before it got too hot.",
    "I didn't go far today, my hip was bothering me.",
    "Walked to the church and back, slow and steady.",
    "Quick walk around the garden after breakfast.",
    "I stayed in today. It was raining.",
    "Just to the mailbox.",
    "A little walk, yes.",
    "Yes, around the block.",
]

STABLE_GRANDKIDS_ANSWERS = [
    "My granddaughter Sofia called yesterday, she's doing well at university.",
    "Marko sent me a photo of his new puppy, very cute.",
    "Sofia is studying for her exams. She works hard.",
    "Marko is busy with football. He scored a goal apparently.",
    "I haven't heard from them this week, but I know they're busy.",
    "Sofia visited last weekend, we baked cookies together.",
    "Marko called, he's going on a school trip soon.",
    "Both of them are doing well, thank you for asking.",
    "Sofia sent a postcard from her trip.",
    "They're growing up so fast. I miss them.",
    "Marko got a new haircut, looks very grown up.",
    "Sofia called this morning, just to chat.",
    "They came for Sunday lunch, it was lovely.",
    "Both wonderful, both busy.",
]


def _embed_mock(text: str) -> list[float]:
    """Deterministic 32-dim 'embedding' from a hash. Used only for seed."""
    digest = hashlib.sha256(text.lower().encode("utf-8")).digest()
    # Spread the 32-byte digest into 32 floats in [-1, 1].
    return [(b - 128) / 128.0 for b in digest]


def _consistency_mock(answers: list[str]) -> int:
    """Crude mock: if the last answer mentions 'no cat' or 'don't know' / 'confused',
    we give it a high severity. Otherwise 0.
    """
    if not answers:
        return 0
    last = answers[-1].lower()
    if any(x in last for x in ("no cat", "don't know", "confused", "neighbor", "not sure")):
        return 3
    return 0


def _ts_for_day(day_offset_back: int, hour_local: int = 9, minute: int = 5) -> datetime:
    """A timestamp ``day_offset_back`` days ago at the given local hour, in UTC."""
    base = utcnow().replace(hour=hour_local, minute=minute, second=0, microsecond=0)
    return base - timedelta(days=day_offset_back)


def _seed_users(fc: FirestoreClient) -> None:
    fc.user_doc(GUARDIAN_UID).set(
        {
            "id": GUARDIAN_UID,
            "role": "guardian",
            "linkedTo": ELDER_UID,
            "phoneNumber": "+10000000001",
            "name": "Marko Petrović",
            "timezone": "Europe/Belgrade",
            "lastSeen": utcnow(),
            "isRoaming": False,
            "fcmToken": None,
        }
    )
    fc.user_doc(ELDER_UID).set(
        {
            "id": ELDER_UID,
            "role": "elder",
            "linkedTo": GUARDIAN_UID,
            "phoneNumber": "+10000000002",
            "name": "Milica Petrović",
            "timezone": "Europe/Belgrade",
            "lastSeen": utcnow() - timedelta(minutes=2),  # presence fresh
            "isRoaming": False,
            "fcmToken": None,
        }
    )
    log.info("seed.users_done")


def _seed_pair_and_schedule(fc: FirestoreClient) -> None:
    fc.pair_doc(PAIR_ID).set(
        {
            "id": PAIR_ID,
            "elderUid": ELDER_UID,
            "guardianUid": GUARDIAN_UID,
            "members": [ELDER_UID, GUARDIAN_UID],
            "status": "active",
            "createdAt": utcnow() - timedelta(days=20),
        }
    )
    fc.schedule_doc(PAIR_ID).set(
        {
            "id": PAIR_ID,
            "callTime": "09:00",
            "frequency": "daily",
            "voicePreset": "en-US-Chirp3-HD-Aoede",
            "mood": "warm",
            "enabled": True,
        }
    )
    log.info("seed.pair_done")


def _seed_questions(fc: FirestoreClient) -> None:
    questions = [
        {
            "id": "q_pet",
            "text": "How is Max the cat doing today?",
            "themeId": THEME_PET,
            "category": "pet",
            "askEvery": 1,
            "lastAskedAt": utcnow() - timedelta(days=1),
        },
        {
            "id": "q_walk",
            "text": "Did you go for your morning walk?",
            "themeId": THEME_WALK,
            "category": "routine",
            "askEvery": 1,
            "lastAskedAt": utcnow() - timedelta(days=1),
        },
        {
            "id": "q_grandkids",
            "text": "Have you heard from Sofia or Marko this week?",
            "themeId": THEME_GRANDKIDS,
            "category": "family",
            "askEvery": 2,
            "lastAskedAt": utcnow() - timedelta(days=2),
        },
    ]
    for q in questions:
        fc.question_doc(PAIR_ID, q["id"]).set(q)
    log.info("seed.questions_done count=%d", len(questions))


def _seed_meds(fc: FirestoreClient) -> None:
    meds = [
        {"id": MED_BP, "name": "Lisinopril", "dose": "10mg", "time": "08:30", "active": True},
        {"id": MED_VITD, "name": "Vitamin D3", "dose": "1000 IU", "time": "08:30", "active": True},
    ]
    for m in meds:
        fc.medication_doc(PAIR_ID, m["id"]).set(m)
    log.info("seed.meds_done count=%d", len(meds))


def _seed_calls_and_memory(fc: FirestoreClient) -> None:
    """Write 14 days of calls. Memory signals are computed via the real engine
    using mocked embeddings so the drift flag fires deterministically.
    """
    deps = MemoryDeps(
        embed=_embed_mock,
        load_signal=lambda pid, tid: _load_signal_emulator_safe(fc, pid, tid),
        save_signal=lambda pid, sig: _save_signal_emulator_safe(fc, pid, sig),
        consistency_check=_consistency_mock,
        notify_guardian=lambda pid, sig: log.info(
            "seed.would_notify_guardian theme=%s sev=%d", sig.theme_id, sig.gemini_severity
        ),
        now=utcnow,
    )

    # Build the day-by-day sequence with deterministic mood drift.
    base_mood = 0.4
    for day_back in range(14, 0, -1):
        ts = _ts_for_day(day_back)
        call_id = f"seed_call_{14 - day_back + 1:02d}"
        # Pick the answer for each theme based on day position.
        idx = 14 - day_back  # 0..13, oldest → newest
        if idx < 10:
            pet_answer = STABLE_PET_ANSWERS[idx % len(STABLE_PET_ANSWERS)]
        else:
            pet_answer = DRIFT_PET_ANSWERS[(idx - 10) % len(DRIFT_PET_ANSWERS)]
        walk_answer = STABLE_WALK_ANSWERS[idx % len(STABLE_WALK_ANSWERS)]
        grand_answer = STABLE_GRANDKIDS_ANSWERS[idx % len(STABLE_GRANDKIDS_ANSWERS)]

        # Mood trends mildly downward in the last 3 days.
        mood = base_mood
        if day_back <= 3:
            mood = -0.1 - 0.1 * (3 - day_back)

        meds_today = [MED_BP, MED_VITD] if day_back not in (4, 11) else []  # two missed days

        transcript = [
            {"role": "assistant", "text": "Good morning! How are you feeling today?", "ts": ts},
            {"role": "user", "text": "Good morning, I'm alright thank you.", "ts": ts + timedelta(seconds=4)},
            {"role": "assistant", "text": "And how is Max the cat?", "ts": ts + timedelta(seconds=8)},
            {"role": "user", "text": pet_answer, "ts": ts + timedelta(seconds=12)},
            {"role": "assistant", "text": "Did you go for your morning walk today?", "ts": ts + timedelta(seconds=18)},
            {"role": "user", "text": walk_answer, "ts": ts + timedelta(seconds=22)},
            {"role": "assistant", "text": "Have you heard from Sofia or Marko this week?", "ts": ts + timedelta(seconds=28)},
            {"role": "user", "text": grand_answer, "ts": ts + timedelta(seconds=32)},
        ]
        if meds_today:
            transcript += [
                {"role": "assistant", "text": "Did you take your Lisinopril and Vitamin D this morning?", "ts": ts + timedelta(seconds=38)},
                {"role": "user", "text": "Yes, with breakfast.", "ts": ts + timedelta(seconds=42)},
            ]

        summary = (
            "Milica sounded warm and chatty. Confirmed both medications. "
            f"Mentioned Max ({pet_answer[:32]}…) and a short walk."
            if meds_today
            else "Milica sounded a bit tired. Did not confirm her morning medications today."
        )

        fc.call_doc(PAIR_ID, call_id).set(
            {
                "id": call_id,
                "startedAt": ts,
                "endedAt": ts + timedelta(seconds=180),
                "durationSec": 180,
                "answered": True,
                "channel": "internet",
                "transcript": transcript,
                "summary": summary,
                "moodScore": mood,
                "medsConfirmed": meds_today,
                "flags": [],
                "recordingUrl": None,
            }
        )

        memory_update(PAIR_ID, THEME_PET, pet_answer, call_id, deps)
        memory_update(PAIR_ID, THEME_WALK, walk_answer, call_id, deps)
        if day_back % 2 == 0:
            memory_update(PAIR_ID, THEME_GRANDKIDS, grand_answer, call_id, deps)

    log.info("seed.calls_done count=14")


def _load_signal_emulator_safe(fc: FirestoreClient, pair_id: str, theme_id: str):
    """Like default_deps().load_signal but tolerates missing fields in the emulator."""
    from app.services.memory_engine import MemoryAnswer, MemorySignal

    snap = fc.memory_doc(pair_id, new_signal_id(theme_id)).get()
    data = fc.doc_to_dict(snap)
    if not data:
        return None
    answers = []
    for a in data.get("answers") or []:
        d = a.get("date")
        if isinstance(d, str):
            d = datetime.fromisoformat(d.replace("Z", "+00:00"))
        if d and d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        answers.append(
            MemoryAnswer(
                call_id=a.get("callId", ""),
                date=d,
                text=a.get("text", ""),
                embedding=a.get("embedding") or [],
            )
        )
    flagged_at = data.get("flaggedAt")
    if isinstance(flagged_at, str):
        flagged_at = datetime.fromisoformat(flagged_at.replace("Z", "+00:00"))
    return MemorySignal(
        signal_id=data.get("id", new_signal_id(theme_id)),
        theme_id=theme_id,
        answers=answers,
        drift_score=float(data.get("driftScore", 0.0)),
        gemini_severity=int(data.get("geminiSeverity", 0)),
        flagged_at=flagged_at,
    )


def _save_signal_emulator_safe(fc: FirestoreClient, pair_id: str, sig) -> None:
    fc.memory_doc(pair_id, sig.signal_id).set(
        {
            "id": sig.signal_id,
            "themeId": sig.theme_id,
            "answers": [
                {
                    "callId": a.call_id,
                    "date": a.date,
                    "text": a.text,
                    "embedding": a.embedding,
                }
                for a in sig.answers
            ],
            "driftScore": sig.drift_score,
            "geminiSeverity": sig.gemini_severity,
            "flaggedAt": sig.flagged_at,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed CareConnect demo data")
    parser.add_argument(
        "--reset", action="store_true", help="(no-op placeholder; emulator wipes on restart)"
    )
    parser.parse_args()

    settings = get_settings()
    log.info(
        "seed.start project=%s emulator=%s",
        settings.google_cloud_project,
        bool(settings.firestore_emulator_host),
    )
    fc = FirestoreClient.instance()

    _seed_users(fc)
    _seed_pair_and_schedule(fc)
    _seed_questions(fc)
    _seed_meds(fc)
    _seed_calls_and_memory(fc)

    sig_doc = fc.memory_doc(PAIR_ID, new_signal_id(THEME_PET)).get()
    sig = fc.doc_to_dict(sig_doc) or {}
    log.info(
        "seed.done pair=%s pet_drift=%.3f severity=%s flagged_at=%s",
        PAIR_ID,
        float(sig.get("driftScore", 0.0)),
        sig.get("geminiSeverity"),
        sig.get("flaggedAt"),
    )


if __name__ == "__main__":
    main()
