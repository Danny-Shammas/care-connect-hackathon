"""Memory-engine schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MemoryAnswer(BaseModel):
    """A single answer the elder gave for a themed question."""

    call_id: str = Field(..., alias="callId")
    date: datetime
    text: str
    embedding: list[float] | None = None
    embedding_ref: str | None = Field(default=None, alias="embeddingRef")

    model_config = ConfigDict(populate_by_name=True)


class MemorySignal(BaseModel):
    """Document at ``/memory_signals/{pairId}/items/{signalId}``.

    One signal per ``themeId``. Updated each call where the theme was asked.
    """

    model_config = ConfigDict(populate_by_name=True)

    signal_id: str = Field(..., alias="id")
    theme_id: str = Field(..., alias="themeId")
    answers: list[MemoryAnswer] = Field(default_factory=list)
    drift_score: float = Field(default=0.0, alias="driftScore", ge=0.0, le=1.0)
    gemini_severity: int = Field(default=0, alias="geminiSeverity", ge=0, le=3)
    flagged_at: datetime | None = Field(default=None, alias="flaggedAt")


class MemoryThemeView(BaseModel):
    """Public view returned by ``GET /memory/{pairId}``."""

    theme_id: str = Field(..., alias="themeId")
    drift_score: float = Field(..., alias="driftScore")
    gemini_severity: int = Field(..., alias="geminiSeverity")
    flagged_at: datetime | None = Field(default=None, alias="flaggedAt")
    recent_answers: list[MemoryAnswer] = Field(
        default_factory=list, alias="recentAnswers"
    )

    model_config = ConfigDict(populate_by_name=True)
