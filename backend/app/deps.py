"""FastAPI dependency providers."""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


def settings_dep() -> Settings:
    return get_settings()


def require_scheduler_secret(
    x_scheduler_secret: str | None = Header(default=None),
    settings: Settings = Depends(settings_dep),
) -> None:
    if (
        not x_scheduler_secret
        or x_scheduler_secret != settings.scheduler_shared_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_scheduler_secret",
        )


@lru_cache(maxsize=1)
def _firestore_singleton():
    from app.services.firestore_client import FirestoreClient

    return FirestoreClient.instance()


def firestore_dep():
    return _firestore_singleton()
