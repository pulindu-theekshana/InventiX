"""
Catalog endpoints

Purpose : Shared product search used by both roles.
Spec    : Section 5.2
Look here when : Catalog search returns nothing.
"""

from fastapi import APIRouter, Query, status

from ....dependencies import CurrentUserDep, CustomerDep
from . import service
from .schemas import CatalogProductOut, NewCatalogProductIn

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/search", response_model=list[CatalogProductOut])
def search_catalog(
    _user: CurrentUserDep,
    q: str = Query(default="", description="Free text. Empty returns the first page."),
) -> list[CatalogProductOut]:
    """Any authenticated user: customers add stock from it, suppliers add listings."""
    return service.search(q)


@router.get("/categories", response_model=list[str])
def list_categories(_user: CurrentUserDep) -> list[str]:
    return service.categories()


@router.post("", response_model=CatalogProductOut, status_code=status.HTTP_201_CREATED)
def add_to_catalog(body: NewCatalogProductIn, _user: CustomerDep) -> CatalogProductOut:
    """A shop adding a product the catalog does not have yet. Returns the existing row if it does."""
    return service.create(body)
