"""Google Cloud Speech-to-Text v2 streaming with the ``chirp_2`` model.

The Twilio Media Stream gives us μ-law 8 kHz mono. We upsample to LINEAR16
16 kHz before sending it to the recognizer (chirp_2 supports 8/16 kHz; 16 kHz
gets us better word error rate).

This module exposes a single async generator-style class :class:`StreamingSTT`
that the call orchestrator pumps audio into and reads transcript events out of.
The Speech v2 API caps a single streaming session to a few minutes, so the
orchestrator rotates the session as needed; this class also gracefully closes
on ``aclose``.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from dataclasses import dataclass
from typing import AsyncIterator, Optional

from app.config import get_settings

log = logging.getLogger(__name__)


@dataclass
class STTEvent:
    text: str
    is_final: bool
    confidence: float = 0.0


class StreamingSTT:
    """Bridge async audio chunks → sync streaming_recognize() → async events.

    The google-cloud-speech client is synchronous (it expects a generator of
    requests). We run that in a worker thread and shuttle results back to the
    asyncio side via a queue.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._audio_queue: "asyncio.Queue[bytes | None]" = asyncio.Queue()
        self._event_queue: "asyncio.Queue[STTEvent | None]" = asyncio.Queue()
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._closed = False

    # ---- public API --------------------------------------------------------
    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._thread = threading.Thread(
            target=self._run_recognizer, name="stt-recognize", daemon=True
        )
        self._thread.start()

    async def push(self, pcm16_16k: bytes) -> None:
        """Push raw LINEAR16 16 kHz audio."""
        if self._closed:
            return
        await self._audio_queue.put(pcm16_16k)

    async def events(self) -> AsyncIterator[STTEvent]:
        while True:
            ev = await self._event_queue.get()
            if ev is None:
                return
            yield ev

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._audio_queue.put(None)
        # Give the thread a moment to drain; it's a daemon so we don't block.
        await asyncio.sleep(0)

    # ---- worker thread -----------------------------------------------------
    def _run_recognizer(self) -> None:
        try:
            from google.api_core.client_options import ClientOptions
            from google.cloud.speech_v2 import SpeechClient
            from google.cloud.speech_v2.types import cloud_speech

            client = SpeechClient(
                client_options=ClientOptions(api_endpoint=self._settings.stt_api_endpoint)
            )

            recognition_config = cloud_speech.RecognitionConfig(
                explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
                    encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
                    sample_rate_hertz=16000,
                    audio_channel_count=1,
                ),
                language_codes=[self._settings.stt_language],
                model=self._settings.stt_model,
                features=cloud_speech.RecognitionFeatures(
                    enable_automatic_punctuation=True,
                ),
            )
            streaming_config = cloud_speech.StreamingRecognitionConfig(
                config=recognition_config,
                streaming_features=cloud_speech.StreamingRecognitionFeatures(
                    interim_results=True,
                ),
            )

            project = self._settings.google_cloud_project
            recognizer = (
                f"projects/{project}/locations/{self._settings.stt_endpoint_region}/recognizers/_"
            )
            config_request = cloud_speech.StreamingRecognizeRequest(
                recognizer=recognizer,
                streaming_config=streaming_config,
            )

            def request_iter():
                yield config_request
                while True:
                    chunk = self._await_audio()
                    if chunk is None:
                        return
                    yield cloud_speech.StreamingRecognizeRequest(audio=chunk)

            for response in client.streaming_recognize(requests=request_iter()):
                for result in response.results:
                    if not result.alternatives:
                        continue
                    alt = result.alternatives[0]
                    self._emit(
                        STTEvent(
                            text=alt.transcript,
                            is_final=bool(result.is_final),
                            confidence=getattr(alt, "confidence", 0.0) or 0.0,
                        )
                    )
        except Exception as exc:  # pragma: no cover - network path
            log.warning("stt.thread_error err=%s", exc)
        finally:
            self._emit(None)

    # ---- thread <-> loop bridge -------------------------------------------
    def _await_audio(self) -> Optional[bytes]:
        loop = self._loop
        if loop is None:
            return None
        fut = asyncio.run_coroutine_threadsafe(self._audio_queue.get(), loop)
        return fut.result()

    def _emit(self, ev: STTEvent | None) -> None:
        loop = self._loop
        if loop is None:
            return
        asyncio.run_coroutine_threadsafe(self._event_queue.put(ev), loop)
