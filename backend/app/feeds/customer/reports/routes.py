"""
Reports endpoints

Purpose : HTTP layer for both the plain database reports and the stored machine learning predictions.
Spec    : Section 7
Look here when : A report endpoint fails.
"""

from fastapi import APIRouter, Query

from ....dependencies import CustomerDep
from . import service
from .schemas import ForecastReportOut, InventoryReportOut, ReportSectionOut

router = APIRouter(prefix="/customer/reports", tags=["customer: reports"])


@router.get("", response_model=list[ReportSectionOut])
def list_sections(user: CustomerDep) -> list[ReportSectionOut]:
    """
    Sections only, with no figures and no charts. Spec 7 builds this feed last,
    and the sections say what has to happen before each can show anything.
    """
    return service.list_sections(user.db, user.id)


@router.get("/inventory", response_model=InventoryReportOut)
def inventory_report(
    user: CustomerDep,
    days: int = Query(default=30, ge=7, le=90),
) -> InventoryReportOut:
    """
    Generated on request, not stored. It reads stock_items and the adjustment
    trail, both of which are small per shop, so there is nothing to cache and no
    staleness to explain -- pressing Generate always shows the shelf as it is now.
    """
    return service.inventory_report(user.db, user.id, days)


@router.get("/forecast", response_model=ForecastReportOut)
def forecast_report(user: CustomerDep) -> ForecastReportOut:
    """
    Spec 7.2. What is about to run out, and how much of that to believe.

    An owner endpoint, not a till one: sales history is the most sensitive data a
    shop has (spec 15.1), and a cashier has no reason to read turnover. The same
    rule is in the row level security policy behind it, so hiding the screen is
    not what enforces it.
    """
    return service.forecast_report(user.db, user.shop_id)
