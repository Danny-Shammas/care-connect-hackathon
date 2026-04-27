"""Structured JSON logging.

Every log record can carry a ``request_id``, ``pair_id``, and ``call_id`` via
``logging.LoggerAdapter`` or the ``extra=`` kwarg. The orchestrator and routes
attach these so a single call's lifecycle is greppable.
"""

from __future__ import annotations

import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config import get_settings


class _ContextFilter(logging.Filter):
    """Ensure structured fields exist even when not provided so JSON formatter is stable."""

    DEFAULTS = ("request_id", "pair_id", "call_id")

    def filter(self, record: logging.LogRecord) -> bool:
        for attr in self.DEFAULTS:
            if not hasattr(record, attr):
                setattr(record, attr, None)
        return True


def configure_logging() -> None:
    """Install a JSON handler on the root logger. Idempotent."""
    settings = get_settings()
    root = logging.getLogger()
    if getattr(root, "_careconnect_configured", False):
        return

    root.setLevel(settings.log_level.upper())
    handler = logging.StreamHandler(sys.stdout)
    fmt = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s "
        "%(request_id)s %(pair_id)s %(call_id)s",
        rename_fields={"asctime": "ts", "levelname": "severity"},
    )
    handler.setFormatter(fmt)
    handler.addFilter(_ContextFilter())

    root.handlers.clear()
    root.addHandler(handler)
    # quiet some chatty libs
    for noisy in ("uvicorn.access", "google.api_core.bidi"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    root._careconnect_configured = True  # type: ignore[attr-defined]
