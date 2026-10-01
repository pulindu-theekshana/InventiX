"""
Till shapes

Purpose : What the POS sends when a bill is finished, and what comes back. Mirrors frontend/src/types/api.ts.
Spec    : Section 6.6
Look here when : A sale is rejected as invalid, or a field is missing from the day's summary.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from ....domain import pos as rules


class CashierIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    # Hashed on the device: the server has no use for the number itself, and storing it would
    # make a shop's PINs readable by anyone who ever reads a backup.
    pin_hash: str = Field(min_length=16, max_length=128)


class PosSettingsIn(BaseModel):
    """What the owner sets once, from their phone or from the till."""

    owner_pin_hash: str | None = Field(default=None, min_length=16, max_length=128)
    discount_limit: float = Field(default=100, ge=0)
    return_limit: float = Field(default=500, ge=0)
    cashiers: list[CashierIn] = []


class PosSettingsOut(BaseModel):
    owner_pin_hash: str | None = None
    discount_limit: float = 100
    return_limit: float = 500
    cashiers: list[CashierIn] = []


class SaleLineIn(BaseModel):
    catalog_product_id: str
    # Null when the shop does not track the product in Stocks. The sale is still recorded.
    stock_item_id: str | None = None
    # Decimal, because rice and dhal are sold by weight.
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class SaleIn(BaseModel):
    """One finished bill. The till may have been offline when it was made."""

    # The till's own id for this bill. A retry sends the same one, so the sale is stored once.
    client_sale_id: str
    receipt_no: str
    device_id: str = Field(min_length=1, max_length=6)
    sold_at: datetime
    payment_method: str = "cash"
    discount: float = Field(default=0, ge=0)
    cashier_label: str | None = Field(default=None, max_length=60)
    lines: list[SaleLineIn] = Field(min_length=1)

    @field_validator("receipt_no")
    @classmethod
    def _receipt(cls, value: str) -> str:
        if not rules.is_valid_receipt_no(value):
            raise ValueError("A receipt number looks like T1-000147.")
        return value.strip()

    @field_validator("payment_method")
    @classmethod
    def _payment(cls, value: str) -> str:
        if value not in rules.PAYMENT_METHODS:
            raise ValueError("Payment must be cash, card or other.")
        return value


class ReturnLineIn(BaseModel):
    catalog_product_id: str
    quantity: float = Field(gt=0)


class ReturnIn(BaseModel):
    """
    Goods coming back against a bill the shop already has. The customer names the receipt; the
    prices come from that bill, never from this request, so a return cannot refund more than was
    charged.
    """

    client_sale_id: str
    receipt_no: str
    device_id: str = Field(min_length=1, max_length=6)
    returns_receipt_no: str
    sold_at: datetime
    cashier_label: str | None = Field(default=None, max_length=60)
    reason: str | None = Field(default=None, max_length=200)
    lines: list[ReturnLineIn] = Field(min_length=1)

    @field_validator("receipt_no", "returns_receipt_no")
    @classmethod
    def _receipt(cls, value: str) -> str:
        if not rules.is_valid_receipt_no(value):
            raise ValueError("A receipt number looks like T1-000147.")
        return value.strip()


class SaleLineOut(BaseModel):
    catalog_product_id: str
    stock_item_id: str | None = None
    name: str
    quantity: float
    unit_price: float
    line_total: float
    returned_quantity: float = 0


class SaleOut(BaseModel):
    id: str
    receipt_no: str
    kind: str
    sold_at: datetime
    payment_method: str
    discount: float
    total: float
    cashier_label: str | None = None
    lines: list[SaleLineOut] = []


class CashierTotalOut(BaseModel):
    """Takings per cashier. Phase 5 fills `cashier` with a real person; until then it is None."""

    cashier: str | None = None
    bills: int
    sales_total: float


class DaySummaryOut(BaseModel):
    """What the cashier counts the drawer against at closing time."""

    date: str
    bills: int
    sales_total: float
    returns_total: float
    cash_expected: float
    card_total: float
    other_total: float
    by_cashier: list[CashierTotalOut] = []
