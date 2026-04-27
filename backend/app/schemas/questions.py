"""Personalized-question schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

QuestionCategory = Literal["pet", "health", "hobby", "family", "routine"]


class Question(BaseModel):
    """Document at ``/questions/{pairId}/items/{qid}``."""

    model_config = ConfigDict(populate_by_name=True)

    qid: str = Field(..., alias="id")
    text: str
    theme_id: str = Field(..., alias="themeId")
    category: QuestionCategory
    ask_every: int = Field(default=1, alias="askEvery", ge=1)
    last_asked_at: datetime | None = Field(default=None, alias="lastAskedAt")


class QuestionUpsert(BaseModel):
    text: str
    theme_id: str = Field(..., alias="themeId")
    category: QuestionCategory
    ask_every: int = Field(default=1, alias="askEvery", ge=1)

    model_config = ConfigDict(populate_by_name=True)
