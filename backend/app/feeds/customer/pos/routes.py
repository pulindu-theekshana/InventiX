"""
Till endpoints

Purpose : HTTP layer for the POS. Parses the request, calls service.py, returns the response.
Spec    : Section 6.6
Look here when : A till sale 404s or is rejected before it reaches the service.
"""

from datetime import date

from fastapi import APIRouter, Query, status

from ....dependencies import CustomerDep
from . import service
from .schemas import DaySummaryOut, SaleIn, SaleOut

router = APIRouter(prefix="/customer/pos", tags=["customer: pos"])


@router.post("/sales", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def record_sale(body: SaleIn, user: CustomerDep) -> SaleOut:
    """A bill the till has finished. Safe to send again: the same client_sale_id wins once."""
    return service.record_sale(user.db, user.id, body)


@router.get("/sales", response_model=list[SaleOut])
def list_sales(
    user: CustomerDep,
    day: date | None = Query(default=None, description="Defaults to today."),  # noqa: B008 - FastAPI's documented idiom
) -> list[SaleOut]:
    return service.list_sales(user.db, user.id, day)


@router.get("/summary", response_model=DaySummaryOut)
def day_summary(
    user: CustomerDep,
    day: date | None = Query(default=None),  # noqa: B008 - FastAPI's documented idiom
) -> DaySummaryOut:
    return service.day_summary(user.db, user.id, day)


# Declared last: "/sales" and "/summary" would otherwise be read as receipt numbers.
@router.get("/sales/{receipt_no}", response_model=SaleOut)
def get_sale(receipt_no: str, user: CustomerDep) -> SaleOut:
    return service.get_sale(user.db, user.id, receipt_no)
