"""Twilio Programmable Voice + Media Streams helpers.

We use Twilio purely as the audio wire. All AI/ML happens on Google Cloud.
"""

from __future__ import annotations

import logging
from typing import Literal

from app.config import get_settings

log = logging.getLogger(__name__)


CallChannel = Literal["internet", "pstn"]


def _twilio_client():
    from twilio.rest import Client

    settings = get_settings()
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def place_call(to_number: str, pair_id: str, call_id: str, channel: CallChannel) -> str:
    """Place an outbound Twilio call.

    Twilio fetches answer-time TwiML from
    ``{TWILIO_WEBHOOK_BASE_URL}/twilio/voice?pairId=...&callId=...&channel=...``.
    Returns the Twilio call SID.
    """
    settings = get_settings()
    answer_url = (
        f"{settings.twilio_webhook_base_url}/twilio/voice"
        f"?pairId={pair_id}&callId={call_id}&channel={channel}"
    )
    log.info(
        "twilio.place_call",
        extra={"pair_id": pair_id, "call_id": call_id},
    )
    client = _twilio_client()
    call = client.calls.create(
        to=to_number,
        from_=settings.twilio_from_number,
        url=answer_url,
        method="POST",
        record=False,
    )
    return call.sid


def build_stream_twiml(
    pair_id: str,
    call_id: str,
    host: str,
    greet_text: str = "Hi, this is CareConnect calling. One moment please.",
) -> str:
    """Return TwiML that opens a bidirectional Media Stream over WSS to our app."""
    # ``host`` should NOT include scheme. Twilio always wants ``wss://``.
    ws_url = f"wss://{host}/twilio/stream"
    # `<Say>` first so the user hears something immediately while the WS opens.
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Say voice=\"Polly.Joanna\">{greet_text}</Say>"
        "<Connect>"
        f'<Stream url="{ws_url}">'
        f'<Parameter name="pairId" value="{pair_id}"/>'
        f'<Parameter name="callId" value="{call_id}"/>'
        "</Stream>"
        "</Connect>"
        "</Response>"
    )
