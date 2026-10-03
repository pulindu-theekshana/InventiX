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


class ForecastLineOut(BaseModel):
    """
    One product as the demand model sees it. Spec 7.2.

    Every figure here is computed in app/ml/forecast.py, which holds no database
    code at all -- so the rule that decides a run-out date is unit tested, and the
    app renders a number rather than deriving one.
    """

    stock_item_id: str
    catalog_product_id: str
    name: str
    pack_size: str

    # Units a day, weighted towards recent weeks.
    units_per_day: float
    trend: str                          # "rising" | "steady" | "falling"
    units_sold: int
    days_selling: int

    quantity_on_hand: int
    # Null where the product is not moving, rather than a date that never arrives.
    days_of_cover: float | None
    runs_out_on: str | None
    is_urgent: bool

    low_threshold: int
    suggested_threshold: int | None
    # True when the level the shop set is far enough from the sales to be worth saying.
    threshold_looks_wrong: bool


class ForecastReportOut(BaseModel):
    """
    Spec 7.2. What the shop is about to run out of, and how much to believe it.

    `confidence` and `weeks_until_good` are the honest half of this report and are
    not decoration: a forecast from ten days of sales is a different thing from
    one from ten weeks, and the screen says which it is holding. `has_enough`
    false means the model declined to answer, and `products` is then empty.
    """

    generated_on: str
    has_enough: bool
    days_counted: int
    weeks_counted: int
    confidence: str                     # "rough" | "fair" | "good"
    # 0 once there is enough history for the spec's own bar of eight weeks.
    weeks_until_good: int
    # What the screen needs to explain an empty report without hardcoding the rule.
    min_days_needed: int
    products: list[ForecastLineOut]
