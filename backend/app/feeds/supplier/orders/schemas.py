"""
Supplier orders models

Purpose : Order card, order detail and rejection request shapes for the supplier side.
Spec    : Section 10.2
Look here when : The supplier order card is missing a field.
"""

from pydantic import BaseModel, Field

from ...customer.delivery.schemas import OrderDetailOut, OrderSummaryOut

# Same shapes, opposite counterparty. Re-exported rather than redefined so a
# change to the order card cannot land on one side of the app and not the other.
SupplierOrderSummaryOut = OrderSummaryOut
SupplierOrderDetailOut = OrderDetailOut


class RejectIn(BaseModel):
    """
    Spec 10.2 requires a reason, stored on the order and shown to the customer,
    who has to decide what to do next. A vague reason wastes their time, so the
    minimum length is a real check rather than decoration.
    """

    reason: str = Field(min_length=5, max_length=500)
