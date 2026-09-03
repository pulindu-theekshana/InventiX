"""
Application entry point

Purpose : Creates the FastAPI instance, adds CORS, registers exception handlers, includes api.py, and starts the job scheduler on startup. Contains NO business logic and NO endpoints.
Spec    : Section 3
Look here when : The server will not start, CORS blocks the app, or an error returns the wrong shape.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import api_router
from .config import settings
from .core.exceptions import register_exception_handlers
from .core.logging import add_request_logging
from .core.logging import configure as configure_logging
from .jobs import scheduler

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    log.info("InventiX backend starting in %s", settings.environment)
    if not settings.database_configured:
        # Deliberately not fatal: the API and /docs are worth reviewing before
        # Supabase exists. Every endpoint that needs the database says so clearly.
        log.warning("Supabase is not configured. Endpoints that read data will return 503.")
    scheduler.start()
    yield
    scheduler.shutdown()
    log.info("InventiX backend stopped")


app = FastAPI(
    title="InventiX API",
    description=(
        "Backend for the InventiX inventory application. Every business rule lives "
        "here; the mobile app may read Supabase directly but writes go through these "
        "endpoints. See docs/08-api-contract.md."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# The app calls from a LAN address that changes between machines and sessions, so
# development allows everything. Production must be given real origins -- an open
# CORS policy there would let any website call this API with a user's token.
origins = ["*"] if not settings.is_production else [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)

add_request_logging(app)
register_exception_handlers(app)
app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    """Liveness, and whether the database is wired up. No authentication."""
    return {
        "status": "ok",
        "environment": settings.environment,
        "database_configured": settings.database_configured,
    }
