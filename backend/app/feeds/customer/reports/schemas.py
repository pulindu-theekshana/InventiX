"""
Reports models

Purpose : Response shapes for each report type.
Spec    : Section 7
Look here when : A chart on the phone cannot read the report data.
"""

from pydantic import BaseModel


class ReportSectionOut(BaseModel):
    """
    Metadata only. Spec 7 builds this feed last because a report needs history to
    report on, and there is none until the other feeds have been in use. The
    screens render each section with an empty state explaining what has to happen
    first, rather than a chart of nothing.
    """

    key: str
    title: str
    description: str
    icon: str
    # What has to exist before this section can say anything.
    requires: str
    available: bool = False


class TrendPointOut(BaseModel):
    """One day on the inventory line. `date` is ISO, so the app never parses a locale."""

    date: str
    total_units: int


class InventoryLineOut(BaseModel):
    """One product as the report counts it."""

    stock_item_id: str
    name: str
    pack_size: str
    quantity_on_hand: int
    low_threshold: int
    unit_price: float | None
    # quantity x price, or null where no preferred supplier sets a price.
    value: float | None
    status: str


class InventoryReportOut(BaseModel):
    """
    Spec 7.1. The one report that needs no sales history: it counts what is on the
    shelf right now, which exists from the day a shop adds its first product.

    Every figure is computed here rather than in the app, and `status` comes from
    domain.stock.classify -- the same function the pie chart and the stock list
    use, so a report can never disagree with the screen it was generated from.
    """

    generated_at: str
    days: int

    total_products: int
    total_units: int
    # Null when no product has a price, rather than a misleading zero.
    total_value: float | None
    priced_products: int

    in_stock: int
    low_stock: int
    restock_requested: int
    # Distinct from low stock: a shelf at zero is a different problem from a thin one.
    at_zero: int

    trend: list[TrendPointOut]
    items: list[InventoryLineOut]
