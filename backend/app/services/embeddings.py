"""Vertex AI ``text-embedding-004`` wrapper."""

from __future__ import annotations

import logging
from typing import Sequence

from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.config import get_settings

log = logging.getLogger(__name__)


_initialized = False


def _init_vertex() -> None:
    global _initialized
    if _initialized:
        return
    import vertexai

    settings = get_settings()
    vertexai.init(
        project=settings.google_cloud_project or None,
        location=settings.vertex_ai_location,
    )
    _initialized = True


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.5, max=4.0),
    reraise=True,
)
def embed(text: str) -> list[float]:
    """Embed a single string. Returns a 768-dim vector for text-embedding-004."""
    return embed_batch([text])[0]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.5, max=4.0),
    reraise=True,
)
def embed_batch(texts: Sequence[str]) -> list[list[float]]:
    """Embed a batch. Capped at 250 inputs per Vertex limits."""
    if not texts:
        return []
    _init_vertex()
    from vertexai.language_models import TextEmbeddingModel

    settings = get_settings()
    model = TextEmbeddingModel.from_pretrained(settings.embedding_model)
    embeddings = model.get_embeddings(list(texts))
    return [e.values for e in embeddings]
