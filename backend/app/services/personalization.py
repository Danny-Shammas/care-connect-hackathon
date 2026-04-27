"""Render the per-call system prompt from the pair's configuration."""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.services.firestore_client import FirestoreClient
from app.utils.time import utcnow

log = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    autoescape=select_autoescape(disabled_extensions=("txt",)),
    keep_trailing_newline=True,
    variable_start_string="{{",
    variable_end_string="}}",
)


def load_template(name: str) -> str:
    """Read a prompt file as raw text (used by summary + consistency)."""
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _select_questions(pair_id: str, fc: FirestoreClient) -> list[dict]:
    """Pick today's questions: any whose ``askEvery`` cadence is due."""
    now = utcnow()
    chosen: list[dict] = []
    for snap in fc.questions_collection(pair_id).stream():
        q = fc.doc_to_dict(snap)
        if not q:
            continue
        last_asked = q.get("lastAskedAt") or q.get("last_asked_at")
        ask_every = int(q.get("askEvery", q.get("ask_every", 1)))
        if not last_asked:
            chosen.append(q)
            continue
        if isinstance(last_asked, str):
            last_asked = datetime.fromisoformat(last_asked.replace("Z", "+00:00"))
        if last_asked.tzinfo is None:
            last_asked = last_asked.replace(tzinfo=timezone.utc)
        if now - last_asked >= timedelta(days=ask_every):
            chosen.append(q)
    return chosen


def _active_meds(pair_id: str, fc: FirestoreClient) -> list[dict]:
    out = []
    for snap in fc.medications_collection(pair_id).stream():
        med = fc.doc_to_dict(snap)
        if med and med.get("active", True):
            out.append(med)
    return out


def build_system_prompt(pair_id: str, fc: FirestoreClient | None = None) -> dict:
    """Render the system prompt and return both the rendered text + the
    structured context that drove it (for use by the orchestrator).
    """
    fc = fc or FirestoreClient.instance()

    pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
    elder_uid = pair.get("elderUid") or pair.get("elder_uid")
    guardian_uid = pair.get("guardianUid") or pair.get("guardian_uid")
    elder = fc.doc_to_dict(fc.user_doc(elder_uid)) if elder_uid else {}
    guardian = fc.doc_to_dict(fc.user_doc(guardian_uid)) if guardian_uid else {}
    schedule = fc.doc_to_dict(fc.schedule_doc(pair_id)) or {}
    questions = _select_questions(pair_id, fc)
    meds = _active_meds(pair_id, fc)

    med_list = (
        ", ".join(f"{m.get('name')} ({m.get('dose','')})".strip() for m in meds)
        if meds
        else "no medications scheduled"
    )
    questions_block = (
        "\n".join(f"   - {q.get('text', '').strip()}" for q in questions)
        if questions
        else "   - (no personalized questions today)"
    )

    template = _env.get_template("system_prompt.txt")
    rendered = template.render(
        elder_name=(elder or {}).get("name", "there"),
        guardian_name=(guardian or {}).get("name", "your family member"),
        relationship="adult child",
        mood_preset=schedule.get("mood", "warm"),
        med_list=med_list,
        questions=questions_block,
    )
    return {
        "system_prompt": rendered,
        "elder": elder,
        "guardian": guardian,
        "schedule": schedule,
        "questions": questions,
        "medications": meds,
    }
