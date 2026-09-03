"""
Token verification

Purpose : Verifies the Supabase JWT and extracts the user id and role. Called only by dependencies.py.
Spec    : Section 15.2
Look here when : Login works in the app but every API call returns 401.
"""

from dataclasses import dataclass

import jwt

from ..config import settings
from .exceptions import Unauthorized


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
    if not settings.supabase_jwt_secret:
        raise Unauthorized("The backend cannot verify sign-ins yet: SUPABASE_JWT_SECRET is unset.")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise Unauthorized("Your session has expired. Please sign in again.") from None
    except jwt.InvalidTokenError:
        raise Unauthorized("Your sign-in could not be verified. Please sign in again.") from None

    user_id = payload.get("sub")
    if not user_id:
        raise Unauthorized("Your sign-in could not be verified. Please sign in again.")

    return TokenClaims(user_id=user_id, email=payload.get("email"))
