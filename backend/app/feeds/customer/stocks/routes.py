"""
Stocks endpoints

Purpose : HTTP layer only for the customer Stocks feed. Parses the request, calls service.py, returns the response. No business logic.
Spec    : Section 6
Look here when : A stocks endpoint 404s, returns the wrong status code, or rejects a valid body.
"""

from fastapi import APIRouter, status

from ....dependencies import CustomerDep
from . import service
from .schemas import (
    AddStockItemIn,
    AdjustIn,
    AdjustmentOut,
    SeasonalWarningOut,
    StockItemOut,
    StockSummaryOut,
    UpdateStockItemIn,
)

router = APIRouter(prefix="/customer/stocks", tags=["customer: stocks"])


@router.get("", response_model=list[StockItemOut])
async def list_stocks(user: CustomerDep) -> list[StockItemOut]:
    return service.list_stocks(user.db, user.id)


@router.get("/summary", response_model=StockSummaryOut)
async def get_summary(user: CustomerDep) -> StockSummaryOut:
    return service.summary(user.db, user.id)


# Declared before /{stock_item_id} or "seasonal" would be read as an id.
@router.get("/seasonal", response_model=list[SeasonalWarningOut])
async def get_seasonal(user: CustomerDep) -> list[SeasonalWarningOut]:
    return service.seasonal_warnings(user.db, user.id)


@router.get("/{stock_item_id}", response_model=StockItemOut)
async def get_stock_item(stock_item_id: str, user: CustomerDep) -> StockItemOut:
    return service.get_one(user.db, user.id, stock_item_id)


@router.get("/{stock_item_id}/adjustments", response_model=list[AdjustmentOut])
async def get_adjustments(stock_item_id: str, user: CustomerDep) -> list[AdjustmentOut]:
    return service.adjustments(user.db, user.id, stock_item_id)


@router.post("", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
async def add_stock_item(body: AddStockItemIn, user: CustomerDep) -> StockItemOut:
    return service.add(user.db, user.id, body)


@router.patch("/{stock_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_stock_item(
    stock_item_id: str, body: UpdateStockItemIn, user: CustomerDep
) -> None:
    service.update(user.db, user.id, stock_item_id, body)


@router.post("/{stock_item_id}/adjust", status_code=status.HTTP_204_NO_CONTENT)
async def adjust_quantity(stock_item_id: str, body: AdjustIn, user: CustomerDep) -> None:
    service.adjust(user.db, user.id, user.id, stock_item_id,
                   body.change_quantity, body.reason)
