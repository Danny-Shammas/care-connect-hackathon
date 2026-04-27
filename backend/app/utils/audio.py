"""μ-law / PCM16 encoding and 8 kHz ↔ 16 kHz resampling.

Twilio Media Streams send and expect μ-law (G.711) at 8 kHz, base64-encoded
inside JSON frames. Google Speech-to-Text v2 with ``chirp_2`` accepts LINEAR16
at 16 kHz, and Cloud TTS Chirp 3 HD synthesizes LINEAR16 (typically 24 kHz, but
we ask for 8 kHz to skip a downsample).

We use the stdlib ``audioop`` module for codec + resampling. It is deprecated
in Python 3.13 and removed in 3.14; on those versions install ``audioop-lts``
which provides the same surface. ``audioop`` is imported lazily so the rest
of the app can import this module on any Python without immediately failing.
"""

from __future__ import annotations

import base64


def _audioop():
    try:
        import audioop  # type: ignore[import-not-found]

        return audioop
    except ModuleNotFoundError:  # Python 3.13+
        try:
            import audioop_lts as audioop  # type: ignore[import-not-found]

            return audioop
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise RuntimeError(
                "audio codec needs the stdlib 'audioop' (Python ≤3.12) or the "
                "'audioop-lts' package (Python 3.13+). Install one to enable the "
                "Twilio media-stream audio path."
            ) from exc

# Twilio fixes its rate at 8 kHz μ-law mono.
TWILIO_RATE = 8000
STT_RATE = 16000
SAMPLE_WIDTH = 2  # 16-bit PCM


def mulaw_b64_to_pcm16(payload_b64: str) -> bytes:
    """Decode a base64 μ-law frame into PCM16 mono at 8 kHz."""
    mulaw = base64.b64decode(payload_b64)
    return _audioop().ulaw2lin(mulaw, SAMPLE_WIDTH)


def pcm16_8k_to_16k(pcm16_8k: bytes, state=None) -> tuple[bytes, object]:
    """Upsample 8 kHz PCM16 to 16 kHz for STT. Returns (pcm, ratecv state)."""
    return _audioop().ratecv(pcm16_8k, SAMPLE_WIDTH, 1, TWILIO_RATE, STT_RATE, state)


def pcm16_to_8k(pcm16: bytes, src_rate: int, state=None) -> tuple[bytes, object]:
    """Downsample arbitrary-rate PCM16 to 8 kHz for Twilio playback."""
    if src_rate == TWILIO_RATE:
        return pcm16, state
    return _audioop().ratecv(pcm16, SAMPLE_WIDTH, 1, src_rate, TWILIO_RATE, state)


def pcm16_to_mulaw_b64(pcm16_8k: bytes) -> str:
    """Encode 8 kHz PCM16 to μ-law and base64 for Twilio outbound media."""
    mulaw = _audioop().lin2ulaw(pcm16_8k, SAMPLE_WIDTH)
    return base64.b64encode(mulaw).decode("ascii")
