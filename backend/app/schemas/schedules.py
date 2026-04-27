"""Schedule schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Frequency = Literal["daily", "weekdays", "custom"]
MoodPreset = Literal["warm", "playful", "brief"]


class Schedule(BaseModel):
    """Document at ``/schedules/{pairId}``."""

    model_config = ConfigDict(populate_by_name=True)

    pair_id: str = Field(..., alias="id")
    call_time: str = Field(..., alias="callTime", pattern=r"^\d{2}:\d{2}$")
    frequency: Frequency = "daily"
    voice_preset: str = Field(default="en-US-Chirp3-HD-Aoede", alias="voicePreset")
    mood: MoodPreset = "warm"
    enabled: bool = True


class ScheduleUpsert(BaseModel):
    call_time: str = Field(..., alias="callTime", pattern=r"^\d{2}:\d{2}$")
    frequency: Frequency = "daily"
    voice_preset: str = Field(default="en-US-Chirp3-HD-Aoede", alias="voicePreset")
    mood: MoodPreset = "warm"
    enabled: bool = True

    model_config = ConfigDict(populate_by_name=True)
