"""
Stocks request and response models

Purpose : Pydantic models describing exactly what the Stocks endpoints accept and return. The contract the frontend types mirror.
Spec    : Section 6
Look here when : The app says a field is missing or undefined.
"""

from typing import Literal

from pydantic import BaseModel, Field

from ...shared.catalog.schemas import CatalogProductOut


class StockItemOut(BaseModel):
    """Mirrors StockItemView in frontend/src/types/api.ts, field for field."""

    id: str
    product: CatalogProductOut
    quantity_on_hand: int
    low_threshold: int
    restock_requested: bool
    preferred_supplier_id: str | None = None
    preferred_supplier_name: str | None = None
    unit_price: float | None = None
    # Computed by domain/stock.classify, never by the app. Spec 6.2.
    status: Literal["in_stock", "low_stock", "restock_requested"]


class StockSummaryOut(BaseModel):
    """
    The three pie segments. Spec 6.2 defines three; the Figma draws a fourth that
    cannot be computed because there is no high_threshold column. See docs/07.
    """

    total: int
    in_stock: int
    low_stock: int
    restock_requested: int


class SeasonalProductOut(BaseModel):
    stock_item_id: str
    name: str
    pack_size: str
    suggested_quantity: int


class SeasonalWarningOut(BaseModel):
    id: str
    name: str
    event_date: str
    weeks_away: int
    affected_categories: list[str]
    products: list[SeasonalProductOut]


class AdjustmentOut(BaseModel):
    id: str
    stock_item_id: str
    change_quantity: int
    quantity_after: int
    reason: str
    source_id: str | None = None
    created_by: str
    created_at: str


class AddStockItemIn(BaseModel):
    catalog_product_id: str
    quantity_on_hand: int = Field(ge=0)
    low_threshold: int = Field(ge=0)


class UpdateStockItemIn(BaseModel):
    """
    quantity_on_hand is deliberately absent. A quantity may only change through
    the adjust endpoint, so that every movement leaves an audit row -- accepting
    it here would create a path that changes stock without history, which is the
    one thing spec 5.10 exists to prevent.
    """

    low_threshold: int | None = Field(default=None, ge=0)
    preferred_supplier_id: str | None = None


class AdjustIn(BaseModel):
    change_quantity: int
    # sales_upload and order_received are written by the system, never by a person.
    reason: Literal["manual", "damage", "correction"]
