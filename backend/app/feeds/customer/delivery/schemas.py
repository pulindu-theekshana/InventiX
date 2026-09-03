"""
Customer delivery models

Purpose : Order card and order detail response shapes for the customer side.
Spec    : Section 8.2
Look here when : An order card shows a missing or wrong field.
"""

from pydantic import BaseModel


class OrderItemOut(BaseModel):
    catalog_product_id: str
    name: str
    pack_size: str
    quantity_requested: int
    unit_price_at_order: float


class StageEventOut(BaseModel):
    status: str
    at: str


class OrderSummaryOut(BaseModel):
    """
    Mirrors OrderSummary in frontend/src/types/api.ts. counterparty_* is the
    supplier here and the customer on the supplier side -- one shape, two feeds,
    which is why OrderCard.tsx serves both.
    """

    id: str
    reference: str
    status: str
    channel: str
    counterparty_name: str
    counterparty_city: str | None = None
    item_count: int
    total_quantity: int
    total_value: float
    requested_at: str
    requested_delivery_date: str | None = None
    # Spec 11.3: a claim, not a status. The order stays on_the_way until confirmed.
    supplier_marked_delivered_at: str | None = None
    rejection_reason: str | None = None


class OrderDetailOut(OrderSummaryOut):
    message_body: str
    items: list[OrderItemOut] = []
    stage_history: list[StageEventOut] = []
    counterparty_phone: str | None = None
    counterparty_address: str | None = None
    rating: dict | None = None


class AdvanceStageIn(BaseModel):
    status: str
