"""
Error types and handlers

Purpose : AppError subclasses (NotFound, Forbidden, InvalidTransition, ValidationFailed) and the FastAPI handlers that turn them into consistent JSON.
Spec    : Section 15.2
Look here when : An error reaches the phone as a 500 with no useful message.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from ..config import settings

log = logging.getLogger(__name__)


class AppError(Exception):
    """
    Every deliberate failure in this backend is one of these. The message is
    written for a shop owner, not a developer, because ErrorBanner.tsx shows it
    to them unchanged.
    """

    status_code = 400
    code = "error"

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class NotFound(AppError):
    """
    Also used when a row exists but belongs to someone else. Returning 403 there
    would confirm the row is real, which tells a supplier that an order id exists.
    """

    status_code = 404
    code = "not_found"


class Forbidden(AppError):
    status_code = 403
    code = "forbidden"


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"


class InvalidTransition(AppError):
    """Spec 11.2. Raised by domain/order_state_machine.py and nowhere else."""

    status_code = 409
    code = "invalid_transition"


class ValidationFailed(AppError):
    """
    Spec 6.5: a refusal must name the product and the limit. A disabled button
    with no explanation is not acceptable, and neither is a bare 400.
    """

    status_code = 409
    code = "validation_failed"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


def register_exception_handlers(app: FastAPI) -> None:
    """One error shape for the whole API, so lib/errors.ts only parses one thing."""

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Log the real cause, return a message that is safe to display. Leaking a
        # stack trace to the phone tells an attacker about the schema.
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Something went wrong on our side. Please try again.",
                "code": "internal_error",
            },
            headers=_cors_headers(request),
        )


def _cors_headers(request: Request) -> dict[str, str]:
    """
    The headers CORSMiddleware would have added, had it been reached.

    A handler registered for `Exception` runs in Starlette's outermost middleware, outside the CORS
    one -- so an unhandled 500 arrives at the browser with no CORS headers at all, and the browser
    reports a CORS failure. That cost a day: three real sales sat unsent behind a 500 the till
    could only read as "Failed to fetch", and the search went looking at CORS configuration
    instead of at the backend.

    Echoed only for an origin that is actually allowed, so a 500 is not the one response that
    hands any website a reply it should not have.
    """
    origin = request.headers.get("origin")
    if not origin:
        return {}
    allowed = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if settings.is_production and origin not in allowed:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }
