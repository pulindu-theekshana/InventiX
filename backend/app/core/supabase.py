"""
Supabase client

Purpose : Builds and caches the Supabase client used by every service. Two clients: anon for user-scoped reads, service-role for backend writes.
Spec    : Section 3
Look here when : Every database call fails, or RLS blocks a call it should not.
"""

from functools import lru_cache

from supabase import Client, create_client

from ..config import settings
from .exceptions import AppError


class DatabaseNotConfigured(AppError):
    status_code = 503
    code = "database_not_configured"

    def __init__(self) -> None:
        super().__init__(
            "The database is not connected yet. Set SUPABASE_URL and the keys in backend/.env."
        )


@lru_cache
def service_client() -> Client:
    """
    Bypasses row level security. Use only where the client is *forbidden* to act
    on its own behalf: writing the profiles row that carries role, running the
    ranking job, sending notifications.

    Anything reachable by a user should prefer user_client() below, so RLS stays
    in play as a second check behind the service layer's own filtering.
    """
    if not settings.database_configured:
        raise DatabaseNotConfigured()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def user_client(access_token: str) -> Client:
    """
    Acts as the signed-in user. Row level security therefore applies to every
    query exactly as it would if the app had asked directly, which means a bug in
    a service filter cannot leak another shop's rows -- the database still refuses.

    Not cached: the token differs per request.
    """
    if not settings.database_configured:
        raise DatabaseNotConfigured()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
