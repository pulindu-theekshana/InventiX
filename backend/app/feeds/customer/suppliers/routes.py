"""
Suppliers endpoints

Purpose : HTTP layer for supplier search and profiles.
Spec    : Section 9
Look here when : Supplier search returns nothing or errors.
"""

from fastapi import APIRouter, Query

from ....dependencies import CustomerDep
from . import service
from .schemas import SupplierOut, SupplierProfileOut

router = APIRouter(prefix="/customer/suppliers", tags=["customer: suppliers"])


@router.get("", response_model=list[SupplierOut])
def search_suppliers(user: CustomerDep, q: str = Query(default="")) -> list[SupplierOut]:
    return service.search_by_company(user.db, q)


@router.get("/by-product/{catalog_product_id}", response_model=list[SupplierOut])
def search_by_product(
    catalog_product_id: str,
    user: CustomerDep,
    quantity: int = Query(default=0, ge=0,
                          description="Spec 9.3 selection mode: marks who cannot fill it."),
) -> list[SupplierOut]:
    """Ranked by the backend. The app renders the array as given and never re-sorts."""
    return service.search_by_product(user.db, catalog_product_id, quantity)


@router.get("/{supplier_id}", response_model=SupplierProfileOut)
def get_supplier(supplier_id: str, user: CustomerDep) -> SupplierProfileOut:
    return service.get_profile(user.db, supplier_id, user.id)
