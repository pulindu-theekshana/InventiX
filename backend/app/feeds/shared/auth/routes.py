"""
Auth endpoints

Purpose : Registration and profile setup. Sessions are handled by Supabase directly from the app; only the profile row, which carries role, comes through here.
Spec    : Section 4.1
Look here when : Registration or profile setup fails.
"""

from typing import Annotated

from fastapi import APIRouter, Header, status

from ....core.security import verify_access_token
from ....dependencies import CurrentUserDep
from . import service
from .schemas import ProfileOut, ProfileSetupIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/profile", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: ProfileSetupIn,
    authorization: Annotated[str | None, Header()] = None,
) -> ProfileOut:
    """
    Deliberately does NOT depend on get_current_user: at this point the caller has
    an auth account but no profile row, so the usual dependency would reject them
    for having no role. It verifies the token directly instead.
    """
    token = (authorization or "").removeprefix("Bearer ").strip()
    claims = verify_access_token(token)
    return service.create_profile(claims.user_id, claims.email or "", body)


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: CurrentUserDep) -> ProfileOut:
    return service.get_profile(user.id)
