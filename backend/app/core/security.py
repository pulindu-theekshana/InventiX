"""
Token verification

Purpose : Verifies the Supabase JWT and extracts the user id and role. Called only by dependencies.py.
Spec    : Section 15.2
Look here when : Login works in the app but every API call returns 401.
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt

from ..config import settings
from .exceptions import Unauthorized

# Newer Supabase projects sign with an asymmetric key published at the JWKS URL;
# older ones with the shared HS256 secret. Each algorithm only ever gets its own
# kind of key, so a token cannot pass off the public key as an HMAC secret.
ASYMMETRIC = ["ES256", "RS256"]


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    """Cached, and PyJWKClient caches the keys, so this is not a fetch per request."""
    return jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


@dataclass(frozen=True)
class TokenClaims:
    """What the access token tells us. Nothing here comes from the request body."""

    user_id: str
    email: str | None


def verify_access_token(token: str) -> TokenClaims:
    """
    Spec 15.2: identity comes from the token, never from anything the app sends.
    A client that can name its own user id can read any shop's data.

    The role is deliberately NOT read from here. Supabase does not put the
    application role in the token by default, so dependencies.py reads it from
    the profiles table. Once a custom access token hook adds a role claim, this
    is the one function that changes.
    """
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise Unauthorized("The backend cannot verify sign-ins yet: SUPABASE_JWT_SECRET is unset.")
            key, algorithms = settings.supabase_jwt_secret, ["HS256"]
        elif alg in ASYMMETRIC:
            key, algorithms = _jwks_client().get_signing_key_from_jwt(token).key, ASYMMETRIC
        else:
            raise Unauthorized("Your sign-in could not be verified. Please sign in again.")

        payload = jwt.decode(token, key, algorithms=algorithms, audience="authenticated")
    except jwt.ExpiredSignatureError:
        raise Unauthorized("Your session has expired. Please sign in again.") from None
    except jwt.PyJWTError:
        raise Unauthorized("Your sign-in could not be verified. Please sign in again.") from None

    user_id = payload.get("sub")
    if not user_id:
        raise Unauthorized("Your sign-in could not be verified. Please sign in again.")

    return TokenClaims(user_id=user_id, email=payload.get("email"))
