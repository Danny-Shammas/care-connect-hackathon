"""Pair + pairing-code schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PairStatus = Literal["active", "pending", "revoked"]


class Pair(BaseModel):
    """Document at ``/pairs/{pairId}``."""

    model_config = ConfigDict(populate_by_name=True)

    pair_id: str = Field(..., alias="id")
    elder_uid: str = Field(..., alias="elderUid")
    guardian_uid: str = Field(..., alias="guardianUid")
    members: list[str]
    status: PairStatus = "active"
    created_at: datetime = Field(..., alias="createdAt")


class PairingCode(BaseModel):
    """Document at ``/pairing_codes/{code}``."""

    model_config = ConfigDict(populate_by_name=True)

    code: str = Field(..., alias="id")
    guardian_uid: str = Field(..., alias="guardianUid")
    expires_at: datetime = Field(..., alias="expiresAt")
    used: bool = False


class PairingCodeRequest(BaseModel):
    """Request body for ``POST /pairing/code``."""

    guardian_uid: str | None = Field(default=None, alias="guardianUid")

    model_config = ConfigDict(populate_by_name=True)


class PairingCodeResponse(BaseModel):
    code: str
    expires_at: datetime = Field(..., alias="expiresAt")

    model_config = ConfigDict(populate_by_name=True)


class PairingRedeemRequest(BaseModel):
    code: str
    elder_uid: str = Field(..., alias="elderUid")

    model_config = ConfigDict(populate_by_name=True)


class PairingRedeemResponse(BaseModel):
    pair_id: str = Field(..., alias="pairId")
    elder_uid: str = Field(..., alias="elderUid")
    guardian_uid: str = Field(..., alias="guardianUid")

    model_config = ConfigDict(populate_by_name=True)
