"""
Stocks logic

Purpose : Assembles the Stocks feed: the three-way classification, the two sections, the pie chart counts and the seasonal cards. Every quantity change goes through domain/stock.py.
Spec    : Section 6.1 to 6.4 and 6.7
Look here when : The wrong items appear in a section, or the pie chart numbers are wrong.
"""

from datetime import date

from ....core.exceptions import Conflict, NotFound
from ....domain import seasonal, stock, thresholds
from .schemas import (
    AddStockItemIn,
    AdjustmentOut,
    SeasonalProductOut,
    SeasonalWarningOut,
    StockItemOut,
    StockSummaryOut,
    UpdateStockItemIn,
)

# One query, not N+1. Embedding the catalog product and the preferred supplier
# means the whole feed is a single round trip rather than one per row.
# `*` instead of a column list so the feed still loads on a database without 0021's unit_price.
SELECT = (
    "*, "
    "product_catalog!inner(id, name, category, pack_size, unit, barcode, is_seasonal, is_active), "
    "preferred_supplier:profiles!stock_items_preferred_supplier_id_fkey(id, business_name)"
)


def _to_out(row: dict, price: float | None = None) -> StockItemOut:
    supplier = row.get("preferred_supplier") or {}
    return StockItemOut(
        id=row["id"],
        product=row["product_catalog"],
        quantity_on_hand=row["quantity_on_hand"],
        low_threshold=row["low_threshold"],
        restock_requested=row["restock_requested"],
        preferred_supplier_id=row.get("preferred_supplier_id"),
        preferred_supplier_name=supplier.get("business_name"),
        # The shop's own price when it entered one, otherwise a supplier's.
        unit_price=float(row["unit_price"]) if row.get("unit_price") is not None else price,
        # The single classification rule. If the chart counted separately it
        # could say four items are low while the list shows three.
        status=stock.classify(
            row["quantity_on_hand"], row["low_threshold"], row["restock_requested"]
        ),
    )


def _prices_for(db, rows: list[dict]) -> dict[str, float]:
    """
    Price per stock item id, for the row display. The preferred supplier's price when
    they list the product; otherwise the cheapest active listing, so a product with no
    supplier chosen yet still shows what it costs. One query for all rows.
    """
    products = {r["product_catalog"]["id"] for r in rows}
    if not products:
        return {}

    listings = (
        db.table("supplier_listings")
        .select("supplier_id, catalog_product_id, unit_price")
        .in_("catalog_product_id", list(products))
        .eq("is_active", True)
        .execute()
        .data
        or []
    )
    prices = {}
    for row in rows:
        offers = {
            l["supplier_id"]: float(l["unit_price"])
            for l in listings
            if l["catalog_product_id"] == row["product_catalog"]["id"]
        }
        if offers:
            preferred = row.get("preferred_supplier_id")
            prices[row["id"]] = offers[preferred] if preferred in offers else min(offers.values())
    return prices


def list_stocks(db, owner_id: str) -> list[StockItemOut]:
    rows = (
        db.table("stock_items").select(SELECT).eq("owner_id", owner_id)
        .execute().data or []
    )
    prices = _prices_for(db, rows)
    items = [
        _to_out(row, prices.get(row["id"]))
        for row in rows
    ]
    # Spec 6.4 sorts Low stock by urgency; In stock reads better alphabetically.
    items.sort(key=lambda i: (
        i.status == "in_stock",
        -stock.urgency(i.quantity_on_hand, i.low_threshold) if i.status != "in_stock" else 0,
        i.product.name.lower(),
    ))
    return items


def summary(db, owner_id: str) -> StockSummaryOut:
    """
    Derived from the same classify() as the list. Counting separately here is how
    a chart and a list end up disagreeing while both look correct.
    """
    rows = (
        db.table("stock_items")
        .select("quantity_on_hand, low_threshold, restock_requested")
        .eq("owner_id", owner_id).execute().data or []
    )
    counts = {stock.IN_STOCK: 0, stock.LOW_STOCK: 0, stock.RESTOCK_REQUESTED: 0}
    for row in rows:
        counts[stock.classify(
            row["quantity_on_hand"], row["low_threshold"], row["restock_requested"]
        )] += 1
    return StockSummaryOut(
        total=len(rows),
        in_stock=counts[stock.IN_STOCK],
        low_stock=counts[stock.LOW_STOCK],
        restock_requested=counts[stock.RESTOCK_REQUESTED],
    )


def get_one(db, owner_id: str, stock_item_id: str) -> StockItemOut:
    row = (
        db.table("stock_items").select(SELECT)
        .eq("owner_id", owner_id).eq("id", stock_item_id)
        .maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("We could not find that product in your stock.")
    return _to_out(row.data, _prices_for(db, [row.data]).get(row.data["id"]))


def adjustments(db, owner_id: str, stock_item_id: str) -> list[AdjustmentOut]:
    """The answer to "the number is wrong and I need to know why" (spec 5.10)."""
    get_one(db, owner_id, stock_item_id)   # 404s if it is not theirs
    rows = (
        db.table("stock_adjustments").select("*")
        .eq("stock_item_id", stock_item_id)
        .order("created_at", desc=True).limit(100)
        .execute().data or []
    )
    return [AdjustmentOut(**row) for row in rows]


def add(db, owner_id: str, data: AddStockItemIn) -> StockItemOut:
    existing = (
        db.table("stock_items").select("id")
        .eq("owner_id", owner_id).eq("catalog_product_id", data.catalog_product_id)
        .execute().data
    )
    if existing:
        raise Conflict("You already track that product.")

    threshold = data.low_threshold or thresholds.default_threshold(data.quantity_on_hand)
    row = {
        "owner_id": owner_id,
        "catalog_product_id": data.catalog_product_id,
        "quantity_on_hand": data.quantity_on_hand,
        "low_threshold": threshold,
        "last_counted_at": "now()",
    }
    # Only sent when given, so adding without a price works before 0021 is applied.
    if data.unit_price is not None:
        row["unit_price"] = data.unit_price
    created = db.table("stock_items").insert(row).execute()
    return get_one(db, owner_id, created.data[0]["id"])


def update(db, owner_id: str, stock_item_id: str, data: UpdateStockItemIn) -> None:
    get_one(db, owner_id, stock_item_id)
    patch = data.model_dump(exclude_none=True)
    if not patch:
        return
    db.table("stock_items").update(patch).eq("id", stock_item_id).eq("owner_id", owner_id).execute()


def adjust(db, owner_id: str, actor_id: str, stock_item_id: str,
           change: int, reason: str) -> int:
    """
    Spec 6.6 manual adjustment. Validates first so the refusal can name the
    numbers, then applies through domain/stock.py -- which calls the SQL function,
    so the quantity change and its audit row commit together or not at all.
    """
    item = get_one(db, owner_id, stock_item_id)
    stock.validate_adjustment(item.quantity_on_hand, change, reason)
    return stock.apply(db, stock_item_id, change, reason, actor_id)


def seasonal_warnings(db, owner_id: str, today: date | None = None) -> list[SeasonalWarningOut]:
    """
    Spec 6.2. A date comparison against the festival calendar, matched to the
    categories this shop actually carries. Not machine learning, and it must not
    become machine learning -- the learned version is a separate model in 7.2.
    """
    today = today or seasonal.today()

    events = [
        seasonal.Event(
            id=row["id"],
            name=row["name"],
            event_date=date.fromisoformat(row["event_date"]),
            lead_time_months=row["lead_time_months"],
            affected_categories=row["affected_categories"] or [],
            expected_uplift_pct=row["expected_uplift_pct"],
        )
        for row in (db.table("seasonal_events").select("*").execute().data or [])
    ]
    upcoming = seasonal.upcoming(events, today)
    if not upcoming:
        return []

    items = list_stocks(db, owner_id)

    warnings: list[SeasonalWarningOut] = []
    for event in upcoming:
        affected = [i for i in items if seasonal.affects(event, i.product.category)]
        if not affected:
            # A festival that touches nothing this shop sells is not a warning.
            continue
        warnings.append(SeasonalWarningOut(
            id=event.id,
            name=event.name,
            event_date=event.event_date.isoformat(),
            weeks_away=seasonal.weeks_away(event, today),
            affected_categories=event.affected_categories,
            products=[
                SeasonalProductOut(
                    stock_item_id=i.id,
                    name=i.product.name,
                    pack_size=i.product.pack_size,
                    suggested_quantity=seasonal.suggested_quantity(
                        i.quantity_on_hand, event.expected_uplift_pct
                    ),
                )
                for i in affected
            ],
        ))
    return warnings
