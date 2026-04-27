"""Google Cloud Natural Language sentiment scoring for transcripts."""

from __future__ import annotations

import logging
from typing import Iterable

from tenacity import retry, stop_after_attempt, wait_exponential_jitter

log = logging.getLogger(__name__)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.5, max=4.0),
    reraise=True,
)
def score_text(text: str) -> float:
    """Return Cloud Natural Language sentiment score in [-1.0, 1.0]."""
    if not text or not text.strip():
        return 0.0
    from google.cloud import language_v2

    client = language_v2.LanguageServiceClient()
    document = language_v2.Document(
        content=text, type_=language_v2.Document.Type.PLAIN_TEXT
    )
    resp = client.analyze_sentiment(request={"document": document})
    return float(resp.document_sentiment.score)


def score_transcript(turns: Iterable[dict]) -> float:
    """Sentiment of the elder's utterances only (not the assistant's)."""
    user_text = " ".join(
        t["text"] for t in turns if t.get("role") == "user" and t.get("text")
    )
    return score_text(user_text)
