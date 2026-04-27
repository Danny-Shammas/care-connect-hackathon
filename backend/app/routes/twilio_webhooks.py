"""Twilio Voice webhook + Media Streams WebSocket."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Request, WebSocket
from fastapi.responses import Response

from app.pipelines.call_orchestrator import run_websocket
from app.services.twilio_service import build_stream_twiml

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/voice")
async def voice_webhook(
    request: Request,
    pairId: str = Query(..., alias="pairId"),
    callId: str = Query(..., alias="callId"),
    channel: str = Query(default="pstn", alias="channel"),
) -> Response:
    """Twilio fetches this when the call connects. We return TwiML that opens
    a bidirectional Media Stream back to ``/twilio/stream``.
    """
    host = request.headers.get("host") or request.url.netloc
    twiml = build_stream_twiml(pair_id=pairId, call_id=callId, host=host)
    log.info(
        "twilio.voice_twiml channel=%s",
        channel,
        extra={"pair_id": pairId, "call_id": callId},
    )
    return Response(content=twiml, media_type="application/xml")


@router.websocket("/stream")
async def stream_websocket(ws: WebSocket) -> None:
    """Twilio Media Streams WebSocket.

    Twilio sends a JSON ``start`` event containing custom parameters; we use
    those to identify the pair/call. We do NOT trust query parameters here
    because some Twilio versions strip them on the WS upgrade.
    """
    await ws.accept()

    pair_id: str | None = ws.query_params.get("pairId")
    call_id: str | None = ws.query_params.get("callId")

    if not pair_id or not call_id:
        # Wait for Twilio's start event.
        try:
            first = await ws.receive_text()
        except Exception:
            await ws.close()
            return
        import json

        msg = json.loads(first)
        params = (msg.get("start") or {}).get("customParameters") or {}
        pair_id = pair_id or params.get("pairId")
        call_id = call_id or params.get("callId")

    if not pair_id or not call_id:
        log.warning("twilio.stream_missing_ids")
        await ws.close()
        return

    log.info(
        "twilio.stream_open",
        extra={"pair_id": pair_id, "call_id": call_id},
    )
    await run_websocket(ws, pair_id, call_id)
