"""
Supplier delivery models

Purpose : Stage group and advancement request shapes.
Spec    : Section 10.3
Look here when : A stage group renders empty on the phone.
"""

from pydantic import BaseModel

from ...customer.delivery.schemas import OrderSummaryOut


class StageGroupOut(BaseModel):
    """
    Spec 10.3 groups the queue by stage, so a supplier moving twenty orders in a
    morning sees them in the order they will act on them.
    """

    stage: str
    label: str
    # None at on_the_way: marking delivered records a timestamp without changing
    # status (spec 11.3), so there is no next stage to offer.
    next_stage: str | None
    action: str
    orders: list[OrderSummaryOut]


class AdvanceIn(BaseModel):
    status: str
