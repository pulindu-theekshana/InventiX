"""
Supplier orders logic

Purpose : Splits orders into Pending, Active and History, applies filtering and search, and performs confirm and reject through the state machine. Blocks confirming an order the supplier can no longer fulfil.
Spec    : Section 10.2
Look here when : An order is in the wrong section, or a supplier confirms stock they do not have.
"""

from datetime import UTC, datetime

from ....core.exceptions import Conflict, NotFound
from ....domain import order_state_machine as sm
from ...customer.delivery.schemas import (
    OrderDetailOut,
    OrderItemOut,
    OrderSummaryOut,
    StageEventOut,
)
from ...shared.notifications import service as notify

SELECT = (
    "id, reference, status, channel, requested_at, requested_delivery_date, "
    "supplier_marked_delivered_at, rejection_reason, message_body, customer_id, supplier_id, "
    "confirmed_at, rejected_at, cancelled_at, processing_at, put_to_delivery_at, "
    "on_the_way_at, purchased_at, "
    "customer:profiles!orders_customer_id_fkey(business_name, city, phone, address), "
    "order_items(id, stock_item_id, listing_id, catalog_product_id, quantity_requested, "
    "unit_price_at_order, product_catalog!inner(name, pack_size))"
)


def _summary(row: dict) -> OrderSummaryOut:
    items = row.get("order_items") or []
    customer = row.get("customer") or {}
    return OrderSummaryOut(
        id=row["id"], reference=row["reference"], status=row["status"], channel=row["channel"],
        counterparty_name=customer.get("business_name", "Unknown customer"),
        counterparty_city=customer.get("city"),
        item_count=len(items),
        total_quantity=sum(i["quantity_requested"] for i in items),
        total_value=sum(i["quantity_requested"] * float(i["unit_price_at_order"]) for i in items),
        requested_at=row["requested_at"],
        requested_delivery_date=row.get("requested_delivery_date"),
        supplier_marked_delivered_at=row.get("supplier_marked_delivered_at"),
        rejection_reason=row.get("rejection_reason"),
    )


def list_orders(db, supplier_id: str) -> list[OrderSummaryOut]:
    """
    Every order ever received, in any state. The app splits it into Pending,
    Active and History (spec 10.2) -- an order never disappears from this feed,
    which is why Delivery is a separate queue rather than a stage filter.

    Pending first and oldest first within it, so nobody is left waiting.
    """
    rows = (
        db.table("orders").select(SELECT).eq("supplier_id", supplier_id)
        .order("requested_at", desc=True).execute().data or []
    )
    orders = [_summary(r) for r in rows]
    orders.sort(key=lambda o: (
        o.status not in sm.SUPPLIER_PENDING,
        o.requested_at if o.status in sm.SUPPLIER_PENDING else "",
    ))
    return orders


def _get_row(db, supplier_id: str, order_id: str) -> dict:
    row = (
        db.table("orders").select(SELECT)
        .eq("id", order_id).eq("supplier_id", supplier_id)
        .maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("We could not find that order.")
    return row.data


def get_order(db, supplier_id: str, order_id: str) -> OrderDetailOut:
    row = _get_row(db, supplier_id, order_id)
    customer = row.get("customer") or {}
    rating = (
        db.table("supplier_ratings").select("quality_score, comment")
        .eq("order_id", order_id).maybe_single().execute()
    )
    return OrderDetailOut(
        **_summary(row).model_dump(),
        message_body=row["message_body"],
        items=[
            OrderItemOut(
                catalog_product_id=i["catalog_product_id"],
                name=i["product_catalog"]["name"],
                pack_size=i["product_catalog"]["pack_size"],
                quantity_requested=i["quantity_requested"],
                unit_price_at_order=float(i["unit_price_at_order"]),
            )
            for i in (row.get("order_items") or [])
        ],
        stage_history=[
            StageEventOut(status=s, at=row[c])
            for s, c in sm.TIMESTAMP_COLUMN.items() if row.get(c)
        ],
        # The supplier needs these to actually deliver.
        counterparty_phone=customer.get("phone"),
        counterparty_address=customer.get("address"),
        rating=rating.data if rating and rating.data else None,
    )


def confirm(db, supplier_id: str, order_id: str) -> None:
    """
    Spec 10.2. Availability is re-checked here rather than trusted from order
    time, because it may have fallen since. If it has, confirm is refused naming
    the product and only Reject remains -- a supplier must never be able to
    confirm stock they no longer hold.
    """
    row = _get_row(db, supplier_id, order_id)
    sm.assert_transition(row["status"], sm.CONFIRMED, "supplier")

    items = row.get("order_items") or []
    listings = {
        l["id"]: l
        for l in (db.table("supplier_listings")
                  .select("id, quantity_available")
                  .in_("id", [i["listing_id"] for i in items]).execute().data or [])
    }

    for item in items:
        listing = listings.get(item["listing_id"])
        name = item["product_catalog"]["name"]
        if listing is None:
            raise Conflict(
                f"Your listing for {name} no longer exists. You can only reject this order."
            )
        if listing["quantity_available"] < item["quantity_requested"]:
            raise Conflict(
                f"You now have only {listing['quantity_available']} units of {name}, "
                f"but {item['quantity_requested']} were ordered. "
                "You can only reject this order."
            )

    # Reserve the stock, so the supplier is not shown as still holding what they
    # have now committed to someone.
    for item in items:
        listing = listings[item["listing_id"]]
        db.table("supplier_listings").update(
            {"quantity_available": listing["quantity_available"] - item["quantity_requested"]}
        ).eq("id", listing["id"]).execute()

    db.table("orders").update({
        "status": sm.CONFIRMED, "confirmed_at": datetime.now(UTC).isoformat()
    }).eq("id", order_id).execute()

    notify.notify(row["customer_id"], "order_confirmed",
                  f"{row['reference']} was accepted",
                  "Your supplier has confirmed this order.", order_id=order_id)


def reject(db, supplier_id: str, order_id: str, reason: str) -> None:
    """Spec 11.4: the products return to the customer's Low stock section."""
    row = _get_row(db, supplier_id, order_id)
    sm.assert_transition(row["status"], sm.REJECTED, "supplier")

    ids = [i["stock_item_id"] for i in (row.get("order_items") or [])]
    if ids:
        db.table("stock_items").update({"restock_requested": False}).in_("id", ids).execute()

    db.table("orders").update({
        "status": sm.REJECTED,
        "rejected_at": datetime.now(UTC).isoformat(),
        "rejection_reason": reason,
    }).eq("id", order_id).execute()

    notify.notify(row["customer_id"], "order_rejected",
                  f"{row['reference']} was declined", reason, order_id=order_id)
