"""
Catalog endpoints

Purpose : Shared product search used by both roles.
Spec    : Section 5.2
Look here when : Catalog search returns nothing.
"""

from fastapi import APIRouter, Query

from ....dependencies import CurrentUserDep
from . import service
from .schemas import CatalogProductOut

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/search", response_model=list[CatalogProductOut])
async def search_catalog(
    _user: CurrentUserDep,
    q: str = Query(default="", description="Free text. Empty returns the first page."),
) -> list[CatalogProductOut]:
    """Any authenticated user: customers add stock from it, suppliers add listings."""
    return service.search(q)
