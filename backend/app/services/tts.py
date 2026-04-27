"""Google Cloud Text-to-Speech with Chirp 3 HD voices.

We synthesize at LINEAR16 8 kHz so the call orchestrator can μ-law-encode the
bytes directly without an intermediate resample. Chirp 3 HD voices are only
available via the regional endpoint (we use ``{TTS_ENDPOINT_REGION}-texttospeech.googleapis.com``,
default ``eu`` per the deployment notes in the README).

Two functions:

* :func:`synthesize_chunk` — one-shot synthesis of a complete sentence/clause,
  returning raw 8 kHz LINEAR16 bytes ready for μ-law encoding.
* :func:`synthesize_streaming` — async generator that yields PCM chunks. We
  currently buffer per chunk (the orchestrator splits text on punctuation), so
  this is functionally a chunked one-shot. The Cloud TTS streaming surface for
  Chirp 3 HD is rolling out; once it's GA we swap in BidiSynthesizeSpeech here.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncIterator

from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.config import get_settings

log = logging.getLogger(__name__)


def _client():
    from google.api_core.client_options import ClientOptions
    from google.cloud import texttospeech

    settings = get_settings()
    return texttospeech.TextToSpeechClient(
        client_options=ClientOptions(api_endpoint=settings.tts_api_endpoint)
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.3, max=2.0),
    reraise=True,
)
def synthesize_chunk(text: str) -> bytes:
    """Synthesize ``text`` as 8 kHz LINEAR16 mono PCM. Returns the raw bytes."""
    if not text or not text.strip():
        return b""
    from google.cloud import texttospeech

    settings = get_settings()
    client = _client()
    voice = texttospeech.VoiceSelectionParams(
        language_code=settings.tts_language,
        name=settings.tts_voice,
    )
    audio_cfg = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=8000,
    )
    resp = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=voice,
        audio_config=audio_cfg,
    )
    # synthesize_speech returns a WAV with header for LINEAR16; strip the 44-byte header.
    data = resp.audio_content
    if len(data) > 44 and data[:4] == b"RIFF":
        data = data[44:]
    return data


_SENTENCE_SPLIT = re.compile(r"(?<=[\.\?\!])\s+")


async def synthesize_streaming(text_chunks: AsyncIterator[str]) -> AsyncIterator[bytes]:
    """Buffer incoming text chunks into sentence-ish units and synthesize each."""
    buffer = ""
    async for chunk in text_chunks:
        buffer += chunk
        # Flush on sentence boundary.
        parts = _SENTENCE_SPLIT.split(buffer)
        if len(parts) > 1:
            *complete, buffer = parts
            for sentence in complete:
                pcm = await asyncio.to_thread(synthesize_chunk, sentence.strip())
                if pcm:
                    yield pcm
    if buffer.strip():
        pcm = await asyncio.to_thread(synthesize_chunk, buffer.strip())
        if pcm:
            yield pcm


_FALLBACK_TEXT = "I'm having a little trouble hearing you. Let's try again in just a moment."


async def fallback_audio() -> bytes:
    """Pre-rendered fallback clip used when TTS streaming fails mid-call."""
    try:
        return await asyncio.to_thread(synthesize_chunk, _FALLBACK_TEXT)
    except Exception as exc:  # pragma: no cover
        log.warning("tts.fallback_failed err=%s", exc)
        return b""
