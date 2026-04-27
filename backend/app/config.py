"""Application configuration loaded from environment variables.

In ``APP_ENV=production`` we hard-fail at startup if any production-required
secret is missing. In ``development`` we only log a warning so partial local
testing works without a fully populated `.env`.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger(__name__)


class Settings(BaseSettings):
    """All runtime configuration. Every secret comes from env vars."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Google Cloud (EU multi-region) ------------------------------------
    google_cloud_project: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT")
    google_application_credentials: str = Field(
        default="", alias="GOOGLE_APPLICATION_CREDENTIALS"
    )
    vertex_ai_location: str = Field(default="eu", alias="VERTEX_AI_LOCATION")
    tts_endpoint_region: str = Field(default="eu", alias="TTS_ENDPOINT_REGION")
    stt_endpoint_region: str = Field(default="eu", alias="STT_ENDPOINT_REGION")
    cloud_run_region: str = Field(default="europe-west3", alias="CLOUD_RUN_REGION")
    firestore_location: str = Field(default="eur3", alias="FIRESTORE_LOCATION")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    embedding_model: str = Field(default="text-embedding-004", alias="EMBEDDING_MODEL")

    # ---- Firebase ----------------------------------------------------------
    firebase_project_id: str = Field(default="", alias="FIREBASE_PROJECT_ID")

    # ---- GCS ---------------------------------------------------------------
    gcs_bucket_recordings: str = Field(default="", alias="GCS_BUCKET_RECORDINGS")
    gcs_bucket_location: str = Field(default="EU", alias="GCS_BUCKET_LOCATION")

    # ---- Speech ------------------------------------------------------------
    stt_model: str = Field(default="chirp_2", alias="STT_MODEL")
    stt_language: str = Field(default="en-US", alias="STT_LANGUAGE")
    tts_voice: str = Field(default="en-US-Chirp3-HD-Aoede", alias="TTS_VOICE")
    tts_language: str = Field(default="en-US", alias="TTS_LANGUAGE")

    # ---- Twilio ------------------------------------------------------------
    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_from_number: str = Field(default="+10000000000", alias="TWILIO_FROM_NUMBER")
    twilio_webhook_base_url: str = Field(
        default="http://localhost:8080", alias="TWILIO_WEBHOOK_BASE_URL"
    )

    # ---- Auth --------------------------------------------------------------
    jwt_required: bool = Field(default=True, alias="JWT_REQUIRED")
    scheduler_shared_secret: str = Field(
        default="dev-scheduler-secret", alias="SCHEDULER_SHARED_SECRET"
    )

    # ---- App ---------------------------------------------------------------
    app_env: Literal["development", "production", "test"] = Field(
        default="development", alias="APP_ENV"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    port: int = Field(default=8080, alias="PORT")

    # ---- Local dev ---------------------------------------------------------
    firestore_emulator_host: str = Field(default="", alias="FIRESTORE_EMULATOR_HOST")

    # ---- Derived helpers ---------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_emulator(self) -> bool:
        return bool(self.firestore_emulator_host)

    @property
    def stt_api_endpoint(self) -> str:
        return f"{self.stt_endpoint_region}-speech.googleapis.com"

    @property
    def tts_api_endpoint(self) -> str:
        return f"{self.tts_endpoint_region}-texttospeech.googleapis.com"


_REQUIRED_PROD_FIELDS: tuple[str, ...] = (
    "google_cloud_project",
    "firebase_project_id",
    "gcs_bucket_recordings",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_from_number",
    "twilio_webhook_base_url",
    "scheduler_shared_secret",
)


def _validate_production(settings: Settings) -> None:
    missing = [f for f in _REQUIRED_PROD_FIELDS if not getattr(settings, f)]
    if not missing:
        return
    msg = (
        "Missing required production settings: "
        + ", ".join(missing)
        + ". Set them in env or .env."
    )
    if settings.is_production:
        raise RuntimeError(msg)
    log.warning("[config] %s (continuing because APP_ENV=%s)", msg, settings.app_env)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide :class:`Settings` instance."""
    settings = Settings()
    _validate_production(settings)
    return settings
