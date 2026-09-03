"""
Logging setup

Purpose : Structured logging configuration. Every request gets an id so a bug report can be traced through the logs.
Spec    : -
Look here when : You cannot tell what happened during a failed request.
"""

import logging
import sys
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request

from ..config import settings

# Set per request and read by the formatter, so every line from one request
# carries the same id without every log call having to pass it along.
request_id: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id.get()
        return True


def configure() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())
    # These log every request themselves; ours is more useful and less noisy.
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("httpx").setLevel(logging.WARNING)


def add_request_logging(app: FastAPI) -> None:
    log = logging.getLogger("inventix.request")

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        # Honours a client-supplied id so a bug report from the app can be traced
        # straight to the server side of the same request.
        rid = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:8]
        token = request_id.set(rid)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            elapsed = (time.perf_counter() - started) * 1000
            request_id.reset(token)
        log.info("%s %s -> %s in %.0fms",
                 request.method, request.url.path, response.status_code, elapsed)
        response.headers["X-Request-Id"] = rid
        return response
