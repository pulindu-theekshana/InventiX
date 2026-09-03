"""
Suppliers models

Purpose : Supplier row and profile response shapes.
Spec    : Section 9
Look here when : A supplier card is missing a field the design shows.
"""

from pydantic import BaseModel

from ...supplier.listings.schemas import ListingOut


class ListingSummaryOut(BaseModel):
    """The figures a customer compares when searching by product. Spec 9.1."""

    unit_price: float
    quantity_available: int
    lead_time_days: int
    min_order_quantity: int


class SupplierOut(BaseModel):
    """Mirrors SupplierView in frontend/src/types/api.ts."""

    id: str
    business_name: str
    city: str | None = None
    is_active: bool
    # The stored score: quality and measured delivery only, renormalised. See D-006.
    score: float | None = None
    average_rating: float | None = None
    rating_count: int = 0
    # Measured, never the supplier's own stated lead_time_days. Spec 12.1.
    measured_delivery_days: float | None = None
    is_new_supplier: bool = True
    # Spec 9.3 selection mode: shown but marked, never hidden.
    can_meet_quantity: bool | None = None
    listing: ListingSummaryOut | None = None


class SupplierProfileOut(SupplierOut):
    """Spec 9.2."""

    contact_person: str
    phone: str
    whatsapp_number: str | None = None
    email: str
    address: str | None = None
    delivery_areas: list[str] | None = None
    listings: list[ListingOut] = []
    order_history: list[dict] = []
