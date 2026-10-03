"""
Stocks endpoints

Purpose : HTTP layer only for the customer Stocks feed. Parses the request, calls service.py, returns the response. No business logic.
Spec    : Section 6
Look here when : A stocks endpoint 404s, returns the wrong status code, or rejects a valid body.
"""

from fastapi import APIRouter, status

from ....dependencies import CustomerDep, TillDep
from . import service
from .schemas import (
    AddStockItemIn,
    AdjustIn,
    AdjustmentOut,
    BarcodeIn,
    SeasonalWarningOut,
    StockItemOut,
    StockSummaryOut,
    UpdateStockItemIn,
)

router = APIRouter(prefix="/customer/stocks", tags=["customer: stocks"])


# TillDep, not CustomerDep: the till searches this list to build a bill, so a cashier account
# has to be able to read it. user.shop_id is the owner either way. Every other route here edits
# stock or reads its history, which stays the owner's.
@router.get("", response_model=list[StockItemOut])
def list_stocks(user: TillDep) -> list[StockItemOut]:
    return service.list_stocks(user.db, user.shop_id)


@router.get("/summary", response_model=StockSummaryOut)
def get_summary(user: CustomerDep) -> StockSummaryOut:
    return service.summary(user.db, user.id)


# Declared before /{stock_item_id} or "seasonal" would be read as an id.
@router.get("/seasonal", response_model=list[SeasonalWarningOut])
def get_seasonal(user: CustomerDep) -> list[SeasonalWarningOut]:
    return service.seasonal_warnings(user.db, user.id)


@router.get("/{stock_item_id}", response_model=StockItemOut)
def get_stock_item(stock_item_id: str, user: CustomerDep) -> StockItemOut:
    return service.get_one(user.db, user.id, stock_item_id)


@router.get("/{stock_item_id}/adjustments", response_model=list[AdjustmentOut])
def get_adjustments(stock_item_id: str, user: CustomerDep) -> list[AdjustmentOut]:
    return service.adjustments(user.db, user.id, stock_item_id)


@router.post("", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
def add_stock_item(body: AddStockItemIn, user: CustomerDep) -> StockItemOut:
    return service.add(user.db, user.id, body)


@router.patch("/{stock_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_stock_item(
    stock_item_id: str, body: UpdateStockItemIn, user: CustomerDep
) -> None:
    service.update(user.db, user.id, stock_item_id, body)


# TillDep: this is a cashier's job, done at the counter while the item is in their hand.
@router.post("/{stock_item_id}/barcode", status_code=status.HTTP_204_NO_CONTENT)
def save_barcode(stock_item_id: str, body: BarcodeIn, user: TillDep) -> None:
    """Teaches the shop a barcode it did not know, by saying which product it is."""
    service.save_barcode(user.db, user.shop_id, stock_item_id, body.barcode)


@router.post("/{stock_item_id}/adjust", status_code=status.HTTP_204_NO_CONTENT)
def adjust_quantity(stock_item_id: str, body: AdjustIn, user: CustomerDep) -> None:
    service.adjust(user.db, user.id, user.id, stock_item_id,
                   body.change_quantity, body.reason)
