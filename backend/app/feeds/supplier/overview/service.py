"""
Overview logic

Purpose : Assembles the supplier's home summary: their ranking row, how many listings and orders they have, and which shops buy most from them.
Spec    : Section 10.1 and 12
Look here when : The supplier dashboard shows the wrong counts, or top customers are missing.
"""

from collections import defaultdict

from ....core.exceptions import NotFound
from ....domain import order_state_machine as sm
from .schemas import OverviewOut, TopCustomerOut

RANK = ("supplier_ranking(score, average_rating, rating_count, "
        "completed_orders, is_new_supplier)")

# One query for every order, then counted in Python. A supplier has tens of orders, not
# thousands, and PostgREST cannot group and sum for us without a database view.
ORDERS = ("id, status, "
          "customer:profiles!orders_customer_id_fkey(business_name), "
          "order_items(quantity_requested, unit_price_at_order)")


def _value(order: dict) -> float:
    """Summed from the lines, the same way every other feed does it: orders store no total."""
    return sum(
        i["quantity_requested"] * float(i["unit_price_at_order"])
        for i in (order.get("order_items") or [])
    )


def overview(db, supplier_id: str) -> OverviewOut:
    profile = (
        db.table("profiles").select(f"business_name, city, {RANK}")
        .eq("id", supplier_id).maybe_single().execute()
    )
    if not profile or not profile.data:
        raise NotFound("We could not find your profile.")

    rank = profile.data.get("supplier_ranking") or {}

    listings = (
        db.table("supplier_listings").select("id")
        .eq("supplier_id", supplier_id).eq("is_active", True)
        .execute().data or []
    )

    orders = (
        db.table("orders").select(ORDERS)
        .eq("supplier_id", supplier_id).execute().data or []
    )

    pending = sum(1 for o in orders if o["status"] in sm.SUPPLIER_PENDING)
    active = sum(1 for o in orders if o["status"] in sm.SUPPLIER_ACTIVE)
    completed = [o for o in orders if o["status"] == sm.PURCHASED]

    # Completed orders only: a shop that ordered once and cancelled is not a top customer.
    totals: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    for order in completed:
        name = (order.get("customer") or {}).get("business_name") or "A shop"
        totals[name][0] += 1
        totals[name][1] += _value(order)

    top = sorted(totals.items(), key=lambda kv: kv[1][1], reverse=True)[:3]

    return OverviewOut(
        business_name=profile.data["business_name"],
        city=profile.data.get("city"),
        average_rating=rank.get("average_rating"),
        rating_count=rank.get("rating_count") or 0,
        score=rank.get("score"),
        is_new_supplier=rank.get("is_new_supplier", True),
        active_listings=len(listings),
        pending_orders=pending,
        active_orders=active,
        completed_orders=len(completed),
        top_customers=[
            TopCustomerOut(name=name, orders=int(count), total_value=round(value, 2))
            for name, (count, value) in top
        ],
    )
