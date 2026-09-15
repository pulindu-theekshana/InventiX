"""
Overview shapes

Purpose : What the supplier's home screen shows above their listings: who they are, how they are rated, and who buys from them.
Spec    : Section 10.1 and 12
Look here when : A figure on the supplier dashboard is missing or wrongly typed.
"""

from pydantic import BaseModel


class TopCustomerOut(BaseModel):
    """A shop that buys from this supplier, by completed orders."""

    name: str
    orders: int
    total_value: float


class OverviewOut(BaseModel):
    business_name: str
    city: str | None = None

    # From supplier_ranking, the same precomputed row customers see. Null until the
    # ranking has been computed at least once (spec 12.2).
    average_rating: float | None = None
    rating_count: int = 0
    score: float | None = None
    is_new_supplier: bool = True

    active_listings: int = 0
    pending_orders: int = 0
    active_orders: int = 0
    completed_orders: int = 0

    # Their best shops, most valuable first. Spec 10.1 shows a supplier who they serve.
    top_customers: list[TopCustomerOut] = []
