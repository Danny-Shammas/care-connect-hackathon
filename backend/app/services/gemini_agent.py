"""Vertex AI Gemini 2.5 Flash conversation agent.

Three public surfaces:

* :func:`respond_streaming` — async generator. Given a system prompt + chat
  history, streams text chunks back. Tool calls are yielded as ``ToolCall``
  events instead of text.
* :func:`summarize` — non-streaming. Returns a 2-3 sentence warm summary.
* :func:`consistency_check` — non-streaming. Given the last few answers about
  one theme, returns severity 0..3 (3 = strong evidence of memory drift).

Tools exposed to the model:

* ``confirm_medication(med_id: str)`` — elder confirmed taking it.
* ``flag_concern(type: str, severity: int)`` — model flagged something
  worth attention (mood, possible emergency, etc).
* ``end_call()`` — graceful sign-off.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncIterator, Literal

from app.config import get_settings

log = logging.getLogger(__name__)


@dataclass
class ToolCall:
    name: Literal["confirm_medication", "flag_concern", "end_call"]
    args: dict[str, Any]


@dataclass
class TextChunk:
    text: str


AgentEvent = TextChunk | ToolCall


# Tool declarations in OpenAPI-ish dict form (Vertex SDK accepts both dict and class).
TOOL_DECLARATIONS = [
    {
        "name": "confirm_medication",
        "description": "Mark a medication as confirmed-taken when the elder says so.",
        "parameters": {
            "type": "object",
            "properties": {
                "med_id": {"type": "string", "description": "The medication ID being confirmed."}
            },
            "required": ["med_id"],
        },
    },
    {
        "name": "flag_concern",
        "description": "Raise a concern visible to the guardian.",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["emergency", "mood", "memory", "other"],
                },
                "severity": {"type": "integer", "minimum": 0, "maximum": 3},
                "detail": {"type": "string"},
            },
            "required": ["type", "severity"],
        },
    },
    {
        "name": "end_call",
        "description": "Politely end the call.",
        "parameters": {"type": "object", "properties": {}},
    },
]


def _client():
    """Return a google-genai client wired to Vertex AI in our region."""
    from google import genai

    settings = get_settings()
    return genai.Client(
        vertexai=True,
        project=settings.google_cloud_project or None,
        location=settings.vertex_ai_location,
    )


def _to_genai_history(history: list[dict]) -> list[dict]:
    """Convert our internal turn list to google-genai Content format."""
    out = []
    for turn in history:
        role = "user" if turn.get("role") == "user" else "model"
        out.append({"role": role, "parts": [{"text": turn.get("text", "")}]})
    return out


async def respond_streaming(
    system_prompt: str,
    history: list[dict],
    user_message: str | None = None,
) -> AsyncIterator[AgentEvent]:
    """Yield text chunks and tool calls as they stream from Gemini."""
    settings = get_settings()
    client = _client()

    contents = _to_genai_history(history)
    if user_message:
        contents.append({"role": "user", "parts": [{"text": user_message}]})

    config = {
        "system_instruction": system_prompt,
        "tools": [{"function_declarations": TOOL_DECLARATIONS}],
        "temperature": 0.6,
        "max_output_tokens": 512,
    }

    try:
        # google-genai exposes generate_content_stream returning a sync iterator;
        # we wrap it so the caller can ``async for``.
        stream = client.models.generate_content_stream(
            model=settings.gemini_model,
            contents=contents,
            config=config,
        )
        for event in stream:
            for cand in event.candidates or []:
                content = getattr(cand, "content", None)
                for part in getattr(content, "parts", []) or []:
                    fc = getattr(part, "function_call", None)
                    if fc and getattr(fc, "name", None):
                        args = dict(getattr(fc, "args", {}) or {})
                        yield ToolCall(name=fc.name, args=args)  # type: ignore[arg-type]
                        continue
                    text = getattr(part, "text", None)
                    if text:
                        yield TextChunk(text=text)
    except Exception as exc:  # pragma: no cover - network path
        log.warning("gemini.stream_error err=%s", exc)
        yield TextChunk(text="I'm sorry, could you repeat that?")


def summarize(transcript: list[dict], summary_prompt: str) -> str:
    """One-shot warm summary."""
    settings = get_settings()
    client = _client()
    convo = "\n".join(f"{t['role'].upper()}: {t['text']}" for t in transcript if t.get("text"))
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                {"role": "user", "parts": [{"text": f"{summary_prompt}\n\nTranscript:\n{convo}"}]}
            ],
            config={"temperature": 0.4, "max_output_tokens": 200},
        )
        return (resp.text or "").strip()
    except Exception as exc:  # pragma: no cover
        log.warning("gemini.summarize_error err=%s", exc)
        return ""


def consistency_check(answers: list[str], consistency_prompt: str) -> int:
    """Score how inconsistent the recent answers are. Returns 0..3."""
    settings = get_settings()
    client = _client()
    bullet = "\n".join(f"- {a}" for a in answers if a)
    full_prompt = (
        f"{consistency_prompt}\n\nAnswers (oldest first):\n{bullet}\n\n"
        'Reply ONLY with JSON: {"severity": <int 0-3>, "reason": "<short>"}'
    )
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=[{"role": "user", "parts": [{"text": full_prompt}]}],
            config={"temperature": 0.0, "max_output_tokens": 80, "response_mime_type": "application/json"},
        )
        text = (resp.text or "").strip()
        data = json.loads(text)
        sev = int(data.get("severity", 0))
        return max(0, min(3, sev))
    except Exception as exc:
        log.warning("gemini.consistency_error err=%s", exc)
        return 0
