"""Medication schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Medication(BaseModel):
    """Document at ``/medications/{pairId}/items/{mid}``."""

    model_config = ConfigDict(populate_by_name=True)

    mid: str = Field(..., alias="id")
    name: str
    dose: str
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    active: bool = True


class MedicationUpsert(BaseModel):
    name: str
    dose: str
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    active: bool = True

    model_config = ConfigDict(populate_by_name=True)
