"""
Reports logic

Purpose : The non-ML reports built first: stock movement, best and worst sellers, spend by supplier, delivery times per supplier, stock-out counts. Also reads stored ML predictions, never computes them live.
Spec    : Section 7.1
Look here when : A report number looks wrong or a report is slow.
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta

from ....domain import stock
from ....ml import forecast
from .schemas import (
    ForecastLineOut,
    ForecastReportOut,
    InventoryLineOut,
    InventoryReportOut,
    ReportSectionOut,
    TrendPointOut,
)

# Spec 7.1: the five reports that need no machine learning. Each becomes a plain
# query once sales_records and orders carry data. The four models in 7.2 come
# after that, computed on a schedule and stored -- never on screen open.
SECTIONS: list[dict] = [
    {
        "key": "stock-movement",
        "title": "Stock movement",
        "description": "How one product has risen and fallen over a chosen period.",
        "icon": "trending-up-outline",
        "requires": "At least one applied sales report, so there is movement to plot.",
    },
    {
        "key": "best-worst",
        "title": "Best and worst sellers",
        "description": "Which products move fastest, and which sit on the shelf.",
        "icon": "podium-outline",
        "requires": "A few weeks of sales records, so fast and slow are meaningful.",
    },
    {
        "key": "spend-by-supplier",
        "title": "Spend by supplier",
        "description": "What you have spent with each supplier over a period.",
        "icon": "wallet-outline",
        "requires": "At least one completed order.",
    },
    {
        "key": "delivery-times",
        "title": "Order history and delivery times",
        "description": "Every order, and how long each supplier actually took.",
        "icon": "time-outline",
        "requires": "At least one order that reached Completed, which is what times a delivery.",
    },
    {
        "key": "stock-outs",
        "title": "Stock-out events",
        "description": "How often a product reached zero, and which ones.",
        "icon": "alert-circle-outline",
        "requires": "Sales history, so we can see when a product reached zero.",
    },
]


def list_sections(db, customer_id: str) -> list[ReportSectionOut]:
    """
    Returns the sections, each marked with whether this shop has the data for it
    yet. Two cheap counts rather than five queries: every section depends on
    either sales history or completed orders.

    Sales history means a row in sales_records, not an applied upload. It used to
    mean the upload, which was true until the till existed and silently wrong
    afterwards: a shop billing every sale through the POS has no uploads at all,
    and was told it had no sales history while its own reports sat on hundreds of
    rows. The table that the reports actually read is the one to ask.
    """
    has_sales = bool(
        db.table("sales_records").select("id").limit(1).execute().data
    )
    has_orders = bool(
        db.table("orders").select("id")
        .eq("customer_id", customer_id).eq("status", "purchased").limit(1).execute().data
    )

    needs_orders = {"spend-by-supplier", "delivery-times"}
    return [
        ReportSectionOut(
            **section,
            available=has_orders if section["key"] in needs_orders else has_sales,
        )
        for section in SECTIONS
    ]


STOCK_SELECT = (
    "id, quantity_on_hand, low_threshold, restock_requested, preferred_supplier_id, "
    "product_catalog!inner(id, name, pack_size)"
)


def inventory_report(db, customer_id: str, days: int = 30) -> InventoryReportOut:
    """
    Spec 7.1. What is on the shelf right now, plus how the total got there.

    This is the one report that works on day one. Every other section waits on
    sales history; stock levels exist as soon as a shop adds a product, and
    stock_adjustments has recorded every change since.

    Two queries, not one per product: the items with their catalog rows embedded,
    then every adjustment for those items inside the window.
    """
    rows = (
        db.table("stock_items").select(STOCK_SELECT)
        .eq("owner_id", customer_id).execute().data or []
    )

    prices = _preferred_prices(db, rows)
    items: list[InventoryLineOut] = []
    total_units = 0
    total_value = 0.0
    priced = 0
    counts: dict[str, int] = defaultdict(int)
    at_zero = 0

    for row in rows:
        quantity = row["quantity_on_hand"]
        price = prices.get(row["id"])
        # The same classification the pie chart and the stock list read, so the
        # report can never disagree with the screen it was generated from.
        status = stock.classify(quantity, row["low_threshold"], row["restock_requested"])

        total_units += quantity
        counts[status] += 1
        if quantity == 0:
            at_zero += 1
        value = None
        if price is not None:
            value = round(quantity * price, 2)
            total_value += value
            priced += 1

        items.append(InventoryLineOut(
            stock_item_id=row["id"],
            name=row["product_catalog"]["name"],
            pack_size=row["product_catalog"]["pack_size"],
            quantity_on_hand=quantity,
            low_threshold=row["low_threshold"],
            unit_price=price,
            value=value,
            status=status,
        ))

    # Worst first: a report is read to find what needs doing.
    order = {stock.LOW_STOCK: 0, stock.RESTOCK_REQUESTED: 1, stock.IN_STOCK: 2}
    items.sort(key=lambda i: (order.get(i.status, 3), i.quantity_on_hand))

    return InventoryReportOut(
        generated_at=datetime.now(UTC).isoformat(),
        days=days,
        total_products=len(rows),
        total_units=total_units,
        # None rather than 0.0 when nothing is priced: zero would read as "worth nothing".
        total_value=round(total_value, 2) if priced else None,
        priced_products=priced,
        in_stock=counts[stock.IN_STOCK],
        low_stock=counts[stock.LOW_STOCK],
        restock_requested=counts[stock.RESTOCK_REQUESTED],
        at_zero=at_zero,
        trend=_trend(db, [r["id"] for r in rows], total_units, days),
        items=items,
    )


def _preferred_prices(db, rows: list[dict]) -> dict[str, float]:
    """The preferred supplier's listed price per item. One query for all of them."""
    pairs = {
        (r["preferred_supplier_id"], r["product_catalog"]["id"])
        for r in rows
        if r.get("preferred_supplier_id")
    }
    if not pairs:
        return {}

    listings = (
        db.table("supplier_listings")
        .select("supplier_id, catalog_product_id, unit_price")
        .in_("supplier_id", list({s for s, _ in pairs}))
        .in_("catalog_product_id", list({p for _, p in pairs}))
        .execute().data or []
    )
    by_pair = {(l["supplier_id"], l["catalog_product_id"]): float(l["unit_price"]) for l in listings}
    return {
        r["id"]: by_pair[(r["preferred_supplier_id"], r["product_catalog"]["id"])]
        for r in rows
        if (r.get("preferred_supplier_id"), r["product_catalog"]["id"]) in by_pair
    }


def _trend(db, item_ids: list[str], total_now: int, days: int) -> list[TrendPointOut]:
    """
    Total units held, one point per day, oldest first.

    Reconstructed backwards from today rather than stored: the total at the end of
    yesterday is today's total minus everything that changed today. stock_adjustments
    is the audit trail every quantity change already writes, so this needs no new
    table and cannot drift from the real numbers.
    """
    today = datetime.now(UTC).date()
    start = today - timedelta(days=days - 1)
    if not item_ids:
        return [TrendPointOut(date=str(start + timedelta(days=i)), total_units=0)
                for i in range(days)]

    adjustments = (
        db.table("stock_adjustments").select("change_quantity, created_at")
        .in_("stock_item_id", item_ids)
        .gte("created_at", start.isoformat())
        .execute().data or []
    )

    moved: dict[str, int] = defaultdict(int)
    for a in adjustments:
        moved[a["created_at"][:10]] += a["change_quantity"]

    # Walk back from today, undoing each day's net movement as we go.
    running = total_now
    points: list[TrendPointOut] = []
    for i in range(days):
        day = today - timedelta(days=i)
        points.append(TrendPointOut(date=str(day), total_units=max(running, 0)))
        running -= moved.get(str(day), 0)

    points.reverse()
    return points


# Ninety days is as far back as a forecast looks. Further would weight a season
# the shop is no longer in, and the exponential weighting in ml/forecast.py has
# already reduced anything that old to a rounding error.
FORECAST_WINDOW_DAYS = 90


def forecast_report(db, customer_id: str) -> ForecastReportOut:
    """
    Spec 7.2. What the shop is about to run out of.

    Computed on request rather than read from a stored prediction, which is a
    deliberate departure from spec 7.2's "computed on a schedule and stored".
    The spec's reason for storing is that a screen must never trigger training,
    and this model does no training: it is a weighted mean over at most ninety
    days of one shop's rows, which is three queries and a loop. Storing it would
    add a table, a migration and a staleness question to save a few milliseconds.

    ponytail: computed live, move to ml/storage.py and the forecast_recalc job
    when a model lands that is slow enough to notice -- a weekday effect or a
    per-product fit, both of which are named in ml/forecast.py.

    Sales rows are scoped by row level security rather than by a where clause,
    because sales_records has no owner column -- ownership is reached through its
    upload or its till sale (policy sales_records_own, migration 0032).
    """
    items = (
        db.table("stock_items").select(STOCK_SELECT)
        .eq("owner_id", customer_id).execute().data or []
    )

    start = datetime.now(UTC).date() - timedelta(days=FORECAST_WINDOW_DAYS)
    sales = (
        db.table("sales_records").select("catalog_product_id, quantity_sold, sale_date")
        .gte("sale_date", start.isoformat()).execute().data or []
    )

    # Keyed by catalog product: stock_items is unique on (owner_id,
    # catalog_product_id), so one shop has at most one shelf row per product.
    shelf = {
        row["product_catalog"]["id"]: {
            "name": row["product_catalog"]["name"],
            "quantity_on_hand": row["quantity_on_hand"],
            "low_threshold": row["low_threshold"],
        }
        for row in items
    }
    stock_item_ids = {row["product_catalog"]["id"]: row["id"] for row in items}
    pack_sizes = {row["product_catalog"]["id"]: row["product_catalog"]["pack_size"] for row in items}

    result = forecast.forecast(sales, shelf, _lead_times(db, items))

    return ForecastReportOut(
        generated_on=str(result.generated_on),
        has_enough=forecast.has_enough(sales),
        days_counted=result.days_counted,
        weeks_counted=result.weeks_counted,
        confidence=result.confidence,
        weeks_until_good=result.weeks_until_good,
        min_days_needed=forecast.MIN_DAYS_OF_HISTORY,
        # Empty rather than a list of zeros when the model declined: a screen
        # showing "not enough data yet" must not also show a table under it.
        products=[
            ForecastLineOut(
                stock_item_id=stock_item_ids[p.catalog_product_id],
                catalog_product_id=p.catalog_product_id,
                name=p.name,
                pack_size=pack_sizes.get(p.catalog_product_id, ""),
                units_per_day=p.units_per_day,
                trend=p.trend,
                units_sold=p.units_sold,
                days_selling=p.days_selling,
                quantity_on_hand=p.quantity_on_hand or 0,
                days_of_cover=p.days_of_cover,
                runs_out_on=str(p.runs_out_on) if p.runs_out_on else None,
                is_urgent=p.is_urgent,
                low_threshold=p.low_threshold or 0,
                suggested_threshold=p.suggested_threshold,
                threshold_looks_wrong=p.threshold_looks_wrong,
            )
            for p in result.products
        ] if forecast.has_enough(sales) else [],
    )


def _lead_times(db, items: list[dict]) -> dict[str, int]:
    """
    How long the preferred supplier actually takes, per product, for the reorder
    point to cover the wait rather than assuming instant delivery.

    Measured first, stated second. Spec 12.1 is explicit that a supplier's own
    lead_time_days is a claim; supplier_ranking.measured_delivery_days is what
    past orders show. The claim is the fallback for a supplier nobody has ordered
    from yet, which is better than treating the wait as zero.
    """
    pairs = {
        (r["preferred_supplier_id"], r["product_catalog"]["id"])
        for r in items
        if r.get("preferred_supplier_id")
    }
    if not pairs:
        return {}

    supplier_ids = list({s for s, _ in pairs})
    listings = (
        db.table("supplier_listings")
        .select("supplier_id, catalog_product_id, lead_time_days")
        .in_("supplier_id", supplier_ids)
        .in_("catalog_product_id", list({p for _, p in pairs}))
        .execute().data or []
    )
    measured = {
        row["supplier_id"]: row.get("measured_delivery_days")
        for row in (
            db.table("supplier_ranking").select("supplier_id, measured_delivery_days")
            .in_("supplier_id", supplier_ids).execute().data or []
        )
    }

    stated = {(l["supplier_id"], l["catalog_product_id"]): l["lead_time_days"] for l in listings}
    out: dict[str, int] = {}
    for supplier_id, product_id in pairs:
        days = measured.get(supplier_id)
        if days is None:
            days = stated.get((supplier_id, product_id))
        if days is not None:
            out[product_id] = max(0, round(days))
    return out
