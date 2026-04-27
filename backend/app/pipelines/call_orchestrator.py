"""End-to-end call lifecycle.

Two entry points:

* :func:`start_call` — invoked by the trigger route or scheduler; chooses the
  channel, pre-creates the call doc, and either places a Twilio call or writes
  a ``skipped_roaming`` doc.
* :func:`run_websocket` — invoked by the Twilio Media Streams WebSocket route;
  pumps μ-law frames through STT → Gemini → TTS in a fully async loop, with
  emergency detection on every interim transcript.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.pipelines.post_call import finalize, write_skipped_or_failed
from app.services import emergency, twilio_service, tts
from app.services.firestore_client import FirestoreClient
from app.services.gemini_agent import TextChunk, ToolCall, respond_streaming
from app.services.network_decision import choose_channel
from app.services.personalization import build_system_prompt
from app.services.fcm import send_push
from app.services.stt import StreamingSTT
from app.utils.audio import (
    mulaw_b64_to_pcm16,
    pcm16_8k_to_16k,
    pcm16_to_mulaw_b64,
)
from app.utils.ids import new_call_id
from app.utils.time import utcnow

log = logging.getLogger(__name__)

CALL_HARD_CAP_SEC = 240  # 4 minutes
SILENCE_FLUSH_MS = 700
STT_FRAMES_PER_PUSH = 5  # batch ~100ms of audio per STT push
TWILIO_FRAME_BYTES_8K = 160  # 20ms of 8kHz μ-law


# ---------------------------------------------------------------------------
# Trigger
# ---------------------------------------------------------------------------
async def start_call(pair_id: str) -> dict:
    """Create the call doc, choose channel, and place the Twilio call."""
    fc = FirestoreClient.instance()
    call_id = new_call_id()
    channel = choose_channel(pair_id, fc)
    log.info(
        "call.start channel=%s",
        channel,
        extra={"pair_id": pair_id, "call_id": call_id},
    )

    if channel == "skipped_roaming":
        write_skipped_or_failed(
            pair_id, call_id, "skipped_roaming",
            reason="elder is roaming; skipped to avoid international charges",
            fc=fc,
        )
        pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
        guardian_uid = pair.get("guardianUid") or pair.get("guardian_uid")
        if guardian_uid:
            send_push(
                guardian_uid,
                title="CareConnect call skipped",
                body="We didn't call today because your loved one's phone is roaming.",
                data={"kind": "call_skipped", "callId": call_id, "pairId": pair_id},
            )
        return {"call_id": call_id, "channel": channel}

    # Pre-create the call doc so the WS handler can write to it.
    fc.call_doc(pair_id, call_id).set(
        {
            "id": call_id,
            "startedAt": utcnow(),
            "channel": channel,
            "answered": False,
            "transcript": [],
            "flags": [],
            "medsConfirmed": [],
        },
        merge=True,
    )

    # Look up elder's phone number.
    pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
    elder_uid = pair.get("elderUid") or pair.get("elder_uid")
    elder = fc.doc_to_dict(fc.user_doc(elder_uid)) if elder_uid else {}
    to_number = (elder or {}).get("phoneNumber") or (elder or {}).get("phone_number")

    if not to_number:
        log.warning(
            "call.no_phone_number",
            extra={"pair_id": pair_id, "call_id": call_id},
        )
        write_skipped_or_failed(
            pair_id, call_id, "service_failed", "no phone number on file", fc=fc
        )
        return {"call_id": call_id, "channel": "service_failed"}

    settings = get_settings()
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        # Dev mode: don't actually place a call.
        log.warning(
            "call.twilio_creds_missing dev_only",
            extra={"pair_id": pair_id, "call_id": call_id},
        )
        return {"call_id": call_id, "channel": channel, "twilio_sid": None}

    try:
        sid = await asyncio.to_thread(
            twilio_service.place_call, to_number, pair_id, call_id, channel
        )
    except Exception as exc:
        log.exception(
            "call.place_failed err=%s",
            exc,
            extra={"pair_id": pair_id, "call_id": call_id},
        )
        write_skipped_or_failed(
            pair_id, call_id, "service_failed", f"twilio_error: {exc}", fc=fc
        )
        pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
        guardian_uid = pair.get("guardianUid") or pair.get("guardian_uid")
        if guardian_uid:
            send_push(
                guardian_uid,
                title="CareConnect call failed",
                body="We couldn't reach your loved one. We'll try again at the next scheduled time.",
                data={"kind": "call_failed", "callId": call_id, "pairId": pair_id},
            )
        return {"call_id": call_id, "channel": "service_failed"}

    return {"call_id": call_id, "channel": channel, "twilio_sid": sid}


# ---------------------------------------------------------------------------
# WebSocket loop
# ---------------------------------------------------------------------------
@dataclass
class CallState:
    pair_id: str
    call_id: str
    transcript: list[dict] = field(default_factory=list)
    meds_confirmed: list[str] = field(default_factory=list)
    flags: list[dict] = field(default_factory=list)
    started_at: datetime = field(default_factory=utcnow)
    end_requested: bool = False
    stream_sid: str | None = None
    upsample_state: Any = None
    pending_user_text: str = ""
    last_interim_at: float = 0.0


async def run_websocket(ws: WebSocket, pair_id: str, call_id: str) -> None:
    """Drive a single Twilio Media Stream call from open to finalize."""
    fc = FirestoreClient.instance()
    state = CallState(pair_id=pair_id, call_id=call_id)
    log_extra = {"pair_id": pair_id, "call_id": call_id}

    try:
        prompt_ctx = build_system_prompt(pair_id, fc)
    except Exception as exc:
        log.exception("orchestrator.prompt_build_failed err=%s", exc, extra=log_extra)
        await ws.close()
        write_skipped_or_failed(pair_id, call_id, "service_failed", f"prompt_error: {exc}", fc=fc)
        return

    system_prompt = prompt_ctx["system_prompt"]
    med_lookup = {
        m.get("id"): m for m in prompt_ctx.get("medications", []) if m.get("id")
    }

    stt_session = await _open_stt()
    gemini_lock = asyncio.Lock()
    classifier_gate = emergency.GeminiClassifierGate()
    pending_med_confirm: asyncio.Queue[str] = asyncio.Queue()

    async def handle_inbound() -> None:
        """Read JSON frames from Twilio, decode media, push to STT."""
        nonlocal state
        try:
            async for raw in ws.iter_text():
                msg = json.loads(raw)
                event = msg.get("event")
                if event == "start":
                    state.stream_sid = msg.get("start", {}).get("streamSid")
                    fc.call_doc(pair_id, call_id).set(
                        {"answered": True, "startedAt": utcnow()}, merge=True
                    )
                elif event == "media":
                    payload = msg.get("media", {}).get("payload")
                    if not payload:
                        continue
                    pcm_8k = mulaw_b64_to_pcm16(payload)
                    pcm_16k, state.upsample_state = pcm16_8k_to_16k(
                        pcm_8k, state.upsample_state
                    )
                    await stt_session.push(pcm_16k)
                elif event == "stop":
                    log.info("twilio.stop", extra=log_extra)
                    break
                elif event == "mark":
                    # Twilio echoes our outbound marks; ignore.
                    pass
                # ignore other events (connected, dtmf, etc.)
        except WebSocketDisconnect:
            log.info("twilio.disconnect", extra=log_extra)
        except Exception as exc:
            log.exception("orchestrator.inbound_error err=%s", exc, extra=log_extra)
        finally:
            await stt_session.aclose()

    async def handle_stt() -> None:
        """Convert STT events into Gemini turn triggers + emergency hooks."""
        async for ev in stt_session.events():
            if state.end_requested:
                break
            if ev.text:
                state.pending_user_text = ev.text
                state.last_interim_at = time.monotonic()
                hit = emergency.scan(ev.text)
                if hit:
                    await _handle_emergency(ev.text, hit, classifier_gate, state, fc, pair_id, call_id)
            if ev.is_final and ev.text.strip():
                user_text = state.pending_user_text.strip()
                state.pending_user_text = ""
                state.transcript.append(
                    {"role": "user", "text": user_text, "ts": utcnow()}
                )
                await _gemini_turn(
                    ws,
                    system_prompt,
                    state,
                    user_text,
                    gemini_lock,
                    med_lookup,
                    pending_med_confirm,
                )

    async def silence_flusher() -> None:
        """If we have interim text and the user goes quiet, treat it as final."""
        while not state.end_requested:
            await asyncio.sleep(0.2)
            if state.pending_user_text and state.last_interim_at:
                quiet_for = time.monotonic() - state.last_interim_at
                if quiet_for * 1000 >= SILENCE_FLUSH_MS:
                    user_text = state.pending_user_text.strip()
                    state.pending_user_text = ""
                    if user_text:
                        state.transcript.append(
                            {"role": "user", "text": user_text, "ts": utcnow()}
                        )
                        await _gemini_turn(
                            ws,
                            system_prompt,
                            state,
                            user_text,
                            gemini_lock,
                            med_lookup,
                            pending_med_confirm,
                        )

    async def watchdog() -> None:
        """Hard-cap the call at CALL_HARD_CAP_SEC."""
        await asyncio.sleep(CALL_HARD_CAP_SEC)
        if not state.end_requested:
            log.info("orchestrator.hard_cap_reached", extra=log_extra)
            state.end_requested = True
            await _send_text(ws, state, "I'll let you go now. Take good care, and we'll talk soon.")

    # Kick off the assistant's opening line so the elder hears something
    # before they speak.
    await _gemini_turn(
        ws,
        system_prompt,
        state,
        user_text="(call connected)",
        gemini_lock=gemini_lock,
        med_lookup=med_lookup,
        pending_med_confirm=pending_med_confirm,
        opening=True,
    )

    inbound_task = asyncio.create_task(handle_inbound())
    stt_task = asyncio.create_task(handle_stt())
    flush_task = asyncio.create_task(silence_flusher())
    watch_task = asyncio.create_task(watchdog())

    done, pending = await asyncio.wait(
        {inbound_task, stt_task, flush_task, watch_task},
        return_when=asyncio.FIRST_COMPLETED,
    )
    state.end_requested = True
    for t in pending:
        t.cancel()
        with suppress(asyncio.CancelledError, Exception):
            await t

    with suppress(Exception):
        await ws.close()

    # Drain any pending med confirmations
    while not pending_med_confirm.empty():
        state.meds_confirmed.append(pending_med_confirm.get_nowait())

    try:
        finalize(
            pair_id,
            call_id,
            state.transcript,
            state.meds_confirmed,
            state.flags,
            recording_url=None,
            fc=fc,
        )
    except Exception as exc:
        log.exception("orchestrator.finalize_failed err=%s", exc, extra=log_extra)
        write_skipped_or_failed(
            pair_id, call_id, "service_failed", f"post_call_error: {exc}", fc=fc
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _open_stt() -> StreamingSTT:
    sess = StreamingSTT()
    await sess.start()
    return sess


async def _gemini_turn(
    ws: WebSocket,
    system_prompt: str,
    state: CallState,
    user_text: str,
    gemini_lock: asyncio.Lock,
    med_lookup: dict[str, dict],
    pending_med_confirm: asyncio.Queue,
    opening: bool = False,
) -> None:
    """Run one Gemini exchange and stream its TTS back to Twilio."""
    if state.end_requested:
        return

    async with gemini_lock:
        try:
            text_buffer = ""
            sentence_endings = (".", "!", "?")
            history = [t for t in state.transcript if t.get("role") in ("user", "assistant")]
            user_msg = None if opening else user_text

            async for event in _aiter(respond_streaming(system_prompt, history, user_msg)):
                if isinstance(event, ToolCall):
                    await _handle_tool(event, state, med_lookup, pending_med_confirm, ws)
                    if state.end_requested:
                        break
                elif isinstance(event, TextChunk):
                    text_buffer += event.text
                    while True:
                        idx = _next_sentence_end(text_buffer, sentence_endings)
                        if idx == -1:
                            break
                        sentence, text_buffer = text_buffer[: idx + 1], text_buffer[idx + 1 :]
                        await _send_text(ws, state, sentence.strip())
            if text_buffer.strip():
                await _send_text(ws, state, text_buffer.strip())
        except Exception as exc:
            log.exception(
                "orchestrator.gemini_turn_error err=%s",
                exc,
                extra={"pair_id": state.pair_id, "call_id": state.call_id},
            )
            await _send_fallback(ws, state)


def _next_sentence_end(text: str, endings: tuple[str, ...]) -> int:
    last = -1
    for end in endings:
        idx = text.rfind(end)
        if idx > last:
            last = idx
    return last


async def _aiter(generator):
    """Wrap an async generator (already async) for unified iteration."""
    async for item in generator:
        yield item


async def _send_text(ws: WebSocket, state: CallState, text: str) -> None:
    if not text:
        return
    state.transcript.append({"role": "assistant", "text": text, "ts": utcnow()})
    try:
        pcm_8k = await asyncio.to_thread(tts.synthesize_chunk, text)
    except Exception as exc:
        log.warning(
            "orchestrator.tts_error err=%s",
            exc,
            extra={"pair_id": state.pair_id, "call_id": state.call_id},
        )
        await _send_fallback(ws, state)
        return
    await _send_pcm(ws, state, pcm_8k)


async def _send_pcm(ws: WebSocket, state: CallState, pcm_8k: bytes) -> None:
    if not pcm_8k or not state.stream_sid:
        return
    # Chop into 20ms (160-byte PCM = 160-byte μ-law) frames so Twilio paces
    # playback like a real phone call.
    frame = TWILIO_FRAME_BYTES_8K * 2  # PCM16 = 2 bytes/sample
    for i in range(0, len(pcm_8k), frame):
        chunk = pcm_8k[i : i + frame]
        if not chunk:
            continue
        try:
            await ws.send_text(
                json.dumps(
                    {
                        "event": "media",
                        "streamSid": state.stream_sid,
                        "media": {"payload": pcm16_to_mulaw_b64(chunk)},
                    }
                )
            )
        except Exception as exc:
            log.info(
                "orchestrator.send_media_error err=%s",
                exc,
                extra={"pair_id": state.pair_id, "call_id": state.call_id},
            )
            return


async def _send_fallback(ws: WebSocket, state: CallState) -> None:
    pcm = await tts.fallback_audio()
    await _send_pcm(ws, state, pcm)


async def _handle_tool(
    event: ToolCall,
    state: CallState,
    med_lookup: dict[str, dict],
    pending_med_confirm: asyncio.Queue,
    ws: WebSocket,
) -> None:
    name = event.name
    args = event.args or {}
    log_extra = {"pair_id": state.pair_id, "call_id": state.call_id}
    if name == "confirm_medication":
        med_id = args.get("med_id") or ""
        if med_id and med_id in med_lookup:
            await pending_med_confirm.put(med_id)
            state.meds_confirmed.append(med_id)
            log.info("call.med_confirmed med=%s", med_id, extra=log_extra)
    elif name == "flag_concern":
        flag = {
            "type": str(args.get("type", "other")),
            "severity": int(args.get("severity", 1)),
            "detail": str(args.get("detail", "")),
            "ts": utcnow(),
        }
        state.flags.append(flag)
        log.info("call.flag type=%s sev=%s", flag["type"], flag["severity"], extra=log_extra)
        if flag["severity"] >= 2:
            FirestoreClient.instance().call_doc(state.pair_id, state.call_id).set(
                {"flags": state.flags}, merge=True
            )
    elif name == "end_call":
        log.info("call.end_call_tool", extra=log_extra)
        state.end_requested = True


async def _handle_emergency(
    text: str,
    hit: emergency.EmergencyHit,
    gate: emergency.GeminiClassifierGate,
    state: CallState,
    fc: FirestoreClient,
    pair_id: str,
    call_id: str,
) -> None:
    severity = hit.severity
    if gate.allow():
        try:
            severity = max(severity, await asyncio.to_thread(emergency.classify, text))
        except Exception:
            pass
    if severity < 2:
        return
    flag = {
        "type": "emergency",
        "severity": severity,
        "detail": f"matched: {hit.matched}",
        "ts": utcnow(),
    }
    if not any(f.get("detail") == flag["detail"] for f in state.flags):
        state.flags.append(flag)
        fc.call_doc(pair_id, call_id).set({"flags": state.flags}, merge=True)
        pair = fc.doc_to_dict(fc.pair_doc(pair_id)) or {}
        guardian_uid = pair.get("guardianUid") or pair.get("guardian_uid")
        if guardian_uid:
            send_push(
                guardian_uid,
                title="Possible emergency on CareConnect call",
                body=f"Your loved one said: \"{text[:120]}\"",
                data={
                    "kind": "emergency",
                    "callId": call_id,
                    "pairId": pair_id,
                    "severity": severity,
                },
            )
        log.warning("call.emergency severity=%s", severity, extra={"pair_id": pair_id, "call_id": call_id})
