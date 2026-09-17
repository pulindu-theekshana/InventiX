"""
Ordering models

Purpose : Request and response models for message generation, validation results and the send call.
Spec    : Section 6.5
Look here when : A validation message does not reach the app, or the send body is rejected.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class OrderLineIn(BaseModel):
    # A reorder names the shop's stock item. A product the shop has never stocked,
    # ordered from the Suppliers feed, names the catalog product instead.
    stock_item_id: str | None = None
    catalog_product_id: str | None = None
    quantity: int = Field(gt=0)

    @model_validator(mode="after")
    def _names_a_product(self):
        if not self.stock_item_id and not self.catalog_product_id:
            raise ValueError("Each line needs a stock_item_id or a catalog_product_id.")
        return self


class GenerateMessageIn(BaseModel):
    supplier_id: str
    lines: list[OrderLineIn] = Field(min_length=1)
    # Optional so the first preview, drawn before either box is filled, still works.
    # Sent again on each regeneration, so the preview is exactly what the supplier reads.
    notes: str | None = None
    requested_delivery_date: date | None = None


class GenerateMessageOut(BaseModel):
    message_body: str
    # Returned alongside so the popup can show each line's limits without a
    # second request. Spec 6.5 wants availability under every quantity field.
    problems: list[str] = []

    # Said out loud but not refused: the same product already on order with a
    # different supplier. Spec 6.5.
    warnings: list[str] = []

    # Refused unless the owner confirms: the same product already on order with
    # THIS supplier. The app turns each of these into a confirmation.
    duplicates: list[str] = []


class SendOrderIn(BaseModel):
    supplier_id: str
    channel: Literal["in_app", "whatsapp", "email"]
    message_body: str
    message_edited: bool = False
    requested_delivery_date: date | None = None
    notes: str | None = None
    lines: list[OrderLineIn] = Field(min_length=1)

    # Set only after the owner has been shown the duplicate and said yes. Default
    # false, so a repeated order is never created by accident or by a stale screen.
    allow_duplicate: bool = False


class SendOrderOut(BaseModel):
    order_id: str
    reference: str
    # Spec 15.4: when the channel is down the order still exists and the user is
    # told the message is pending, rather than the whole action failing.
    message_sent: bool = True
    message_detail: str | None = None
