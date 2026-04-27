"""User document schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

UserRole = Literal["elder", "guardian"]


class User(BaseModel):
    """Document at ``/users/{uid}``."""

    model_config = ConfigDict(populate_by_name=True)

    uid: str = Field(..., alias="id")
    role: UserRole
    linked_to: str | None = Field(default=None, alias="linkedTo")
    phone_number: str = Field(..., alias="phoneNumber")
    name: str
    timezone: str = Field(default="UTC")
    last_seen: datetime | None = Field(default=None, alias="lastSeen")
    is_roaming: bool = Field(default=False, alias="isRoaming")
    fcm_token: str | None = Field(default=None, alias="fcmToken")


class UserCreate(BaseModel):
    role: UserRole
    phone_number: str = Field(..., alias="phoneNumber")
    name: str
    timezone: str = "UTC"

    model_config = ConfigDict(populate_by_name=True)


class PresenceUpdate(BaseModel):
    uid: str
    last_seen: datetime = Field(..., alias="lastSeen")
    is_roaming: bool = Field(default=False, alias="isRoaming")
    fcm_token: str | None = Field(default=None, alias="fcmToken")

    model_config = ConfigDict(populate_by_name=True)
