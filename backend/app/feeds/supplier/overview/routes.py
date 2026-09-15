"""
Overview endpoint

Purpose : HTTP layer for the supplier's home summary.
Spec    : Section 10.1
Look here when : The supplier dashboard fails to load.
"""

from fastapi import APIRouter

from ....dependencies import SupplierDep
from . import service
from .schemas import OverviewOut

router = APIRouter(prefix="/supplier/overview", tags=["supplier: overview"])


@router.get("", response_model=OverviewOut)
async def get_overview(user: SupplierDep) -> OverviewOut:
    """Their own figures only: the dependency decides whose, never the request."""
    return service.overview(user.db, user.id)
