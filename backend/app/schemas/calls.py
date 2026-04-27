"""Call document schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CallChannel = Literal["internet", "pstn", "skipped_roaming", "service_failed"]
TurnRole = Literal["user", "assistant", "system"]
FlagType = Literal["emergency", "memory", "mood", "missed_med", "consent", "other"]


class TranscriptTurn(BaseModel):
    role: TurnRole
    text: str
    ts: datetime


class CallFlag(BaseModel):
    type: FlagType
    severity: int = Field(ge=0, le=3)
    detail: str = ""
    ts: datetime


class CallTriggerRequest(BaseModel):
    pair_id: str = Field(..., alias="pairId")

    model_config = ConfigDict(populate_by_name=True)


class CallTriggerResponse(BaseModel):
    call_id: str = Field(..., alias="callId")
    pair_id: str = Field(..., alias="pairId")
    channel: CallChannel

    model_config = ConfigDict(populate_by_name=True)


class Call(BaseModel):
    """Document at ``/calls/{pairId}/items/{callId}``."""

    model_config = ConfigDict(populate_by_name=True)

    call_id: str = Field(..., alias="id")
    started_at: datetime = Field(..., alias="startedAt")
    ended_at: datetime | None = Field(default=None, alias="endedAt")
    duration_sec: int = Field(default=0, alias="durationSec")
    answered: bool = False
    channel: CallChannel
    transcript: list[TranscriptTurn] = Field(default_factory=list)
    summary: str = ""
    mood_score: float = Field(default=0.0, alias="moodScore")
    meds_confirmed: list[str] = Field(default_factory=list, alias="medsConfirmed")
    flags: list[CallFlag] = Field(default_factory=list)
    recording_url: str | None = Field(default=None, alias="recordingUrl")


class CallSummaryView(BaseModel):
    """Trimmed view used by reports."""

    call_id: str = Field(..., alias="callId")
    started_at: datetime = Field(..., alias="startedAt")
    duration_sec: int = Field(..., alias="durationSec")
    answered: bool
    channel: CallChannel
    summary: str
    mood_score: float = Field(..., alias="moodScore")
    meds_confirmed: list[str] = Field(default_factory=list, alias="medsConfirmed")
    flags: list[CallFlag] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)
