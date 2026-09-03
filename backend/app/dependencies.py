"""
Shared route dependencies

Purpose : get_current_user, require_customer, require_supplier. Every protected route depends on one of these. Role checks live here, not scattered in routes.
Spec    : Section 15.2
Look here when : A user reaches an endpoint their role should not reach, or a valid user gets 401 or 403.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header
from supabase import Client

from .core.exceptions import Forbidden, Unauthorized
from .core.security import verify_access_token
from .core.supabase import service_client, user_client


@dataclass(frozen=True)
class CurrentUser:
    """
    Everything a service is allowed to know about the caller. All of it derived
    from the token and the database, none of it from the request body.
    """

    id: str
    role: str
    business_name: str
    email: str
    access_token: str

    @property
    def db(self) -> Client:
        """
        A client acting as this user, so row level security applies to everything
        the service does on their behalf. Services use this by default; they reach
        for service_client() only where the client is forbidden to act at all.
        """
        return user_client(self.access_token)


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized("You need to be signed in to do that.")
    return authorization.split(" ", 1)[1].strip()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """
    Verifies the token, then loads the profile to find the role.

    The role is read from the database rather than trusted from the request,
    because the app is never trusted to say what it is allowed to be (spec 15.2).
    This costs one query per request; putting role into the JWT as a custom claim
    would remove it, and this is the one function that would change.
    """
    token = _bearer(authorization)
    claims = verify_access_token(token)

    result = (
        service_client()
        .table("profiles")
        .select("id, role, business_name, email, is_active")
        .eq("id", claims.user_id)
        .maybe_single()
        .execute()
    )
    profile = result.data if result else None

    if not profile:
        # Signed in with no profile row: registration was interrupted between
        # creating the auth user and writing the profile. Not an authorisation
        # failure, but there is no role, so nothing can be authorised.
        raise Unauthorized("Your account setup is incomplete. Please finish registration.")

    if not profile.get("is_active", True):
        raise Forbidden("This account has been disabled.")

    return CurrentUser(
        id=profile["id"],
        role=profile["role"],
        business_name=profile["business_name"],
        email=profile["email"],
        access_token=token,
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


async def require_customer(user: CurrentUserDep) -> CurrentUser:
    """Spec 4.2: hiding a tab is a convenience. This is the control."""
    if user.role != "customer":
        raise Forbidden("This is only available to shop accounts.")
    return user


async def require_supplier(user: CurrentUserDep) -> CurrentUser:
    if user.role != "supplier":
        raise Forbidden("This is only available to supplier accounts.")
    return user


CustomerDep = Annotated[CurrentUser, Depends(require_customer)]
SupplierDep = Annotated[CurrentUser, Depends(require_supplier)]
