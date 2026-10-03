"""
Till endpoints

Purpose : HTTP layer for the POS. Parses the request, calls service.py, returns the response.
Spec    : Section 6.6
Look here when : A till sale 404s or is rejected before it reaches the service.
"""

from datetime import date

from fastapi import APIRouter, Query, status

from ....dependencies import CustomerDep, TillDep
from . import service
from .schemas import (
    CashierAccountIn,
    CashierAccountOut,
    DaySummaryOut,
    PosSettingsIn,
    PosSettingsOut,
    ReturnIn,
    SaleIn,
    SaleOut,
    TillActivityOut,
)

router = APIRouter(prefix="/customer/pos", tags=["customer: pos"])


# TillDep below, not CustomerDep: a cashier account may sell, and user.shop_id is the shop they
# sell for -- their own id if they are the owner. Everything a cashier must not do (ordering,
# stock edits, reports, these settings) stays on CustomerDep and answers them 403.


@router.post("/sales", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def record_sale(body: SaleIn, user: TillDep) -> SaleOut:
    """A bill the till has finished. Safe to send again: the same client_sale_id wins once."""
    return service.record_sale(user.db, user.shop_id, body, user.id, user.contact_person)


@router.post("/returns", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def record_return(body: ReturnIn, user: TillDep) -> SaleOut:
    """Goods coming back against a bill. Prices come from that bill, not from this request."""
    return service.record_return(user.db, user.shop_id, body, user.id, user.contact_person)


@router.get("/sales", response_model=list[SaleOut])
def list_sales(
    user: TillDep,
    day: date | None = Query(default=None, description="Defaults to today."),  # noqa: B008 - FastAPI's documented idiom
) -> list[SaleOut]:
    return service.list_sales(user.db, user.shop_id, day)


@router.get("/settings", response_model=PosSettingsOut)
def get_settings(user: TillDep) -> PosSettingsOut:
    """The till reads this once and keeps it, so a PIN still works with no connection."""
    return service.get_settings(user.db, user.shop_id)


@router.put("/settings", response_model=PosSettingsOut)
def save_settings(body: PosSettingsIn, user: CustomerDep) -> PosSettingsOut:
    """CustomerDep: the limits and the owner's PIN are the owner's, and a cashier is refused."""
    return service.save_settings(user.db, user.id, body)


@router.get("/next-receipt")
def next_receipt(user: TillDep, device: str = "T1") -> dict:
    """Where this shop's numbering has reached for that till, so a reset device does not collide."""
    return {"receipt_no": service.next_receipt(user.db, user.shop_id, device)}


@router.get("/summary", response_model=DaySummaryOut)
def day_summary(
    user: TillDep,
    day: date | None = Query(default=None),  # noqa: B008 - FastAPI's documented idiom
) -> DaySummaryOut:
    return service.day_summary(user.db, user.shop_id, day)


@router.get("/activity", response_model=TillActivityOut)
def activity(
    user: CustomerDep,
    from_: date | None = Query(default=None, alias="from"),  # noqa: B008 - FastAPI's documented idiom
    to: date | None = Query(default=None),  # noqa: B008 - FastAPI's documented idiom
) -> TillActivityOut:
    """
    Who sold what, and what is worth a second look. CustomerDep: this is the owner checking on
    the counter, and a cashier reading it would be the one person it is not for.
    """
    return service.activity(user.db, user.id, from_, to)


@router.get("/cashiers", response_model=list[CashierAccountOut])
def list_cashiers(user: CustomerDep) -> list[CashierAccountOut]:
    """The owner's staff list. Owner only, so a cashier cannot see or add logins."""
    return service.list_cashiers(user.id)


@router.post("/cashiers", response_model=CashierAccountOut, status_code=status.HTTP_201_CREATED)
def create_cashier(body: CashierAccountIn, user: CustomerDep) -> CashierAccountOut:
    """Creates the login. The address it returns is shown once, for the owner to pass on."""
    return service.create_cashier(user.id, body)


@router.delete("/cashiers/{cashier_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cashier(cashier_id: str, user: CustomerDep) -> None:
    """Switched off, not deleted: the bills they rang keep a name."""
    service.remove_cashier(user.id, cashier_id)


# Declared last: "/sales" and "/summary" would otherwise be read as receipt numbers.
@router.get("/sales/{receipt_no}", response_model=SaleOut)
def get_sale(receipt_no: str, user: TillDep) -> SaleOut:
    return service.get_sale(user.db, user.shop_id, receipt_no)
