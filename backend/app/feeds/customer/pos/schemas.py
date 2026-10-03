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
    """
    A name and a PIN kept on the shop's record. Superseded by cashier accounts (migration 0029),
    which are real logins; this stays so a shop that set PINs in phase 5 does not have its row
    rewritten, and so old settings still parse.
    """

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


class CashierAccountIn(BaseModel):
    """What the owner types to give someone their own login."""

    name: str = Field(min_length=2, max_length=60)
    # Supabase's own minimum. Typed by the owner rather than generated, because a password the
    # owner chose is one they can tell the cashier without a screenshot.
    password: str = Field(min_length=6, max_length=72)


class CashierAccountOut(BaseModel):
    id: str
    name: str
    # Made for them, because a shop assistant may have no email address. It is only ever typed
    # into the till's sign-in screen.
    login_email: str
    is_active: bool = True


class SaleLineIn(BaseModel):
    catalog_product_id: str
    # Null when the shop does not track the product in Stocks. The sale is still recorded.
    stock_item_id: str | None = None
    # Decimal, because rice and dhal are sold by weight.
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    # The shop had no price for this product, so the cashier typed one. Kept because a price a
    # cashier chooses is a price they can choose too low, and the owner's till view shows it.
    price_from_till: bool = False


class SaleIn(BaseModel):
    """One finished bill. The till may have been offline when it was made."""

    # The till's own id for this bill. A retry sends the same one, so the sale is stored once.
    client_sale_id: str
    receipt_no: str
    device_id: str = Field(min_length=1, max_length=6)
    sold_at: datetime
    payment_method: str = "cash"
    discount: float = Field(default=0, ge=0)
    # Ignored since migration 0029: the name on a bill is the signed-in account's, not a label
    # the till can choose. Still accepted so bills queued by an older till still send.
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
    price_from_till: bool = False


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
    """Takings per cashier. The name comes from the account that was signed in (0029)."""

    cashier: str | None = None
    bills: int
    sales_total: float


class TillEventOut(BaseModel):
    """One thing on a bill the owner might want to ask about: a discount, or goods coming back."""

    receipt_no: str
    kind: str
    sold_at: datetime
    cashier: str | None = None
    cashier_id: str | None = None
    total: float
    discount: float
    # Above the shop's own limit, so the owner should have been asked. True on a bill they were
    # not asked about means either the limit was off or the PIN was known.
    above_limit: bool = False
    # A line on this bill was priced by the cashier because the shop had no price for it.
    priced_at_till: bool = False


class TillCashierOut(BaseModel):
    """What one person took, over the whole range rather than one day."""

    cashier_id: str | None = None
    cashier: str | None = None
    bills: int = 0
    sales_total: float = 0
    discounts_total: float = 0
    returns_total: float = 0


class TillActivityOut(BaseModel):
    """The owner's view of the counter: who sold what, and what is worth a second look."""

    from_date: str
    to_date: str
    bills: int
    sales_total: float
    returns_total: float
    discounts_total: float
    by_cashier: list[TillCashierOut] = []
    events: list[TillEventOut] = []


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
