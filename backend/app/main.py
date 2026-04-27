"""FastAPI application entry point."""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_logging
from app.routes import (
    calls,
    health,
    medications,
    memory,
    pairing,
    presence,
    questions,
    reports,
    schedule,
    scheduler,
    twilio_webhooks,
)

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    settings = get_settings()
    log.info(
        "careconnect.startup",
        extra={
            "request_id": "boot",
            "pair_id": None,
            "call_id": None,
        },
    )
    log.info(
        "careconnect.config: env=%s vertex_loc=%s stt_endpoint=%s tts_endpoint=%s",
        settings.app_env,
        settings.vertex_ai_location,
        settings.stt_api_endpoint,
        settings.tts_api_endpoint,
    )
    yield
    log.info("careconnect.shutdown")


app = FastAPI(
    title="CareConnect API",
    version="0.1.0",
    description="AI guardian backend that places scheduled phone calls to elderly users.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception(
        "unhandled_exception path=%s err=%s",
        request.url.path,
        exc,
        extra={"request_id": getattr(request.state, "request_id", None)},
    )
    return JSONResponse(status_code=500, content={"detail": "internal_server_error"})


# ---- Route registration ---------------------------------------------------
app.include_router(health.router)
app.include_router(pairing.router, prefix="/pairing", tags=["pairing"])
app.include_router(schedule.router, prefix="/schedules", tags=["schedules"])
app.include_router(questions.router, prefix="/questions", tags=["questions"])
app.include_router(medications.router, prefix="/medications", tags=["medications"])
app.include_router(calls.router, prefix="/calls", tags=["calls"])
app.include_router(twilio_webhooks.router, prefix="/twilio", tags=["twilio"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(memory.router, prefix="/memory", tags=["memory"])
app.include_router(presence.router, prefix="/presence", tags=["presence"])
app.include_router(scheduler.router, prefix="/scheduler", tags=["scheduler"])
