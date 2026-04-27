"""Firebase ID token verification dependency.

When ``JWT_REQUIRED=false`` (development), we accept any bearer token and
extract a uid from it for testing. The dev path is ONLY active outside of
``APP_ENV=production`` — we hard-fail in production if JWT_REQUIRED is false.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthContext:
    uid: str
    claims: dict


def _settings_dep() -> Settings:
    return get_settings()


def _verify_with_firebase(token: str) -> dict:
    """Lazy-import firebase_admin so importing this module never requires a service-account file."""
    import firebase_admin
    from firebase_admin import auth, credentials

    if not firebase_admin._apps:  # type: ignore[attr-defined]
        try:
            firebase_admin.initialize_app(credentials.ApplicationDefault())
        except Exception:
            firebase_admin.initialize_app()
    return auth.verify_id_token(token)


async def verify_firebase_token(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(_settings_dep),
) -> AuthContext:
    """FastAPI dependency: returns the caller's uid + raw claims."""
    if settings.is_production and not settings.jwt_required:
        raise RuntimeError(
            "Refusing to boot: JWT_REQUIRED=false in production environment."
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        if not settings.jwt_required:
            return AuthContext(uid="dev-anonymous", claims={"dev": True})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_bearer_token"
        )

    token = authorization.split(" ", 1)[1].strip()

    if not settings.jwt_required:
        # Accept the dev-mode "uid:<value>" stub format; otherwise just use the token as the uid.
        uid = token.split("uid:", 1)[1] if token.startswith("uid:") else token
        return AuthContext(uid=uid, claims={"dev": True})

    try:
        claims = _verify_with_firebase(token)
    except Exception as exc:
        log.warning("firebase_token_invalid err=%s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        ) from exc

    uid = claims.get("uid") or claims.get("user_id") or claims.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token_missing_uid"
        )
    return AuthContext(uid=uid, claims=claims)


def require_pair_member(auth: AuthContext, pair: dict) -> None:
    """Authorize a write to a pair-scoped resource."""
    members = pair.get("members") or []
    if auth.uid not in members:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="not_a_pair_member"
        )
