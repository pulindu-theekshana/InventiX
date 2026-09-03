"""
Listings models

Purpose : Request and response shapes for supplier listings.
Spec    : Section 10.1
Look here when : A listing field is missing in the app.
"""

from pydantic import BaseModel, Field

from ...shared.catalog.schemas import CatalogProductOut


class ListingOut(BaseModel):
    """Mirrors ListingView in frontend/src/types/api.ts."""

    id: str
    product: CatalogProductOut
    quantity_available: int
    unit_price: float
    min_order_quantity: int
    lead_time_days: int
    is_active: bool
    # Spec 10.1: the supplier's own low-availability warning. A customer cannot
    # order what they do not hold, so they need to know before the customer does.
    is_low: bool


class ListingIn(BaseModel):
    catalog_product_id: str
    quantity_available: int = Field(ge=0)
    unit_price: float = Field(gt=0)
    min_order_quantity: int = Field(default=1, gt=0)
    lead_time_days: int = Field(ge=0)


class ListingPatch(BaseModel):
    quantity_available: int | None = Field(default=None, ge=0)
    unit_price: float | None = Field(default=None, gt=0)
    min_order_quantity: int | None = Field(default=None, gt=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    # Spec 10.1 retires a listing with this rather than deleting it, because
    # order_items references it and deleting would break the order history.
    is_active: bool | None = None
