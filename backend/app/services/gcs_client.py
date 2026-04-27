"""Google Cloud Storage helper used for call recordings + cached fallback audio."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING

from app.config import get_settings

if TYPE_CHECKING:  # pragma: no cover
    from google.cloud.storage import Bucket

log = logging.getLogger(__name__)


class GCSClient:
    def __init__(self) -> None:
        from google.cloud import storage

        settings = get_settings()
        self._client = storage.Client(project=settings.google_cloud_project or None)
        self._bucket_name = settings.gcs_bucket_recordings

    def bucket(self) -> "Bucket":
        return self._client.bucket(self._bucket_name)

    def upload_bytes(self, blob_path: str, data: bytes, content_type: str) -> str:
        blob = self.bucket().blob(blob_path)
        blob.upload_from_string(data, content_type=content_type)
        log.info("gcs.upload bucket=%s path=%s bytes=%d", self._bucket_name, blob_path, len(data))
        return f"gs://{self._bucket_name}/{blob_path}"

    def download_bytes(self, blob_path: str) -> bytes | None:
        blob = self.bucket().blob(blob_path)
        if not blob.exists():
            return None
        return blob.download_as_bytes()

    def signed_url(self, blob_path: str, ttl_minutes: int = 60) -> str:
        blob = self.bucket().blob(blob_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=ttl_minutes),
            method="GET",
        )


_singleton: GCSClient | None = None


def get_gcs() -> GCSClient:
    global _singleton
    if _singleton is None:
        _singleton = GCSClient()
    return _singleton
