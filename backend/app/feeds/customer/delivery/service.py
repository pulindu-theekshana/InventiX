"""
Customer delivery logic

Purpose : Splits orders into Requested and Confirmed, and performs confirm receipt, cancel, re-order elsewhere and manual stage advance by calling the state machine.
Spec    : Section 8.1 and 8.3
Look here when : An order sits in the wrong section, or confirming receipt does not top up stock.
"""

from datetime import UTC, datetime

from ....core.exceptions import Forbidden, NotFound
from ....domain import order_state_machine as sm
from ....domain import stock
from ...shared.notifications import service as notify
from .schemas import OrderDetailOut, OrderItemOut, OrderSummaryOut, StageEventOut

SELECT = (
    "id, reference, status, channel, requested_at, requested_delivery_date, "
    "supplier_marked_delivered_at, rejection_reason, message_body, customer_id, supplier_id, "
    "confirmed_at, rejected_at, cancelled_at, processing_at, put_to_delivery_at, "
    "on_the_way_at, purchased_at, "
    "supplier:profiles!orders_supplier_id_fkey(business_name, city, phone, address), "
    "order_items(catalog_product_id, quantity_requested, unit_price_at_order, "
    "product_catalog!inner(name, pack_size))"
)


def _summary(row: dict) -> OrderSummaryOut:
    items = row.get("order_items") or []
    supplier = row.get("supplier") or {}
    return OrderSummaryOut(
        id=row["id"],
        reference=row["reference"],
        status=row["status"],
        channel=row["channel"],
        counterparty_name=supplier.get("business_name", "Unknown supplier"),
        counterparty_city=supplier.get("city"),
        item_count=len(items),
        total_quantity=sum(i["quantity_requested"] for i in items),
        total_value=sum(i["quantity_requested"] * float(i["unit_price_at_order"]) for i in items),
        requested_at=row["requested_at"],
        requested_delivery_date=row.get("requested_delivery_date"),
        supplier_marked_delivered_at=row.get("supplier_marked_delivered_at"),
        rejection_reason=row.get("rejection_reason"),
    )


def _history(row: dict) -> list[StageEventOut]:
    """Built from the stage timestamp columns, which is why they are columns."""
    return [
        StageEventOut(status=status, at=row[column])
        for status, column in sm.TIMESTAMP_COLUMN.items()
        if row.get(column)
    ]


def list_orders(db, customer_id: str) -> list[OrderSummaryOut]:
    rows = (
        db.table("orders").select(SELECT).eq("customer_id", customer_id)
        .order("requested_at", desc=True).execute().data or []
    )
    return [_summary(r) for r in rows]


def _get_row(db, customer_id: str, order_id: str) -> dict:
    row = (
        db.table("orders").select(SELECT)
        .eq("id", order_id).eq("customer_id", customer_id)
        .maybe_single().execute()
    )
    if not row or not row.data:
        # Not found and not yours look identical, so an id cannot be probed.
        raise NotFound("We could not find that order.")
    return row.data


def get_order(db, customer_id: str, order_id: str) -> OrderDetailOut:
    row = _get_row(db, customer_id, order_id)
    supplier = row.get("supplier") or {}
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
        stage_history=_history(row),
        counterparty_phone=supplier.get("phone"),
        counterparty_address=supplier.get("address"),
        rating=rating.data if rating and rating.data else None,
    )


def _set_status(db, order_id: str, status: str) -> None:
    column = sm.TIMESTAMP_COLUMN.get(status)
    patch = {"status": status}
    if column:
        patch[column] = datetime.now(UTC).isoformat()
    db.table("orders").update(patch).eq("id", order_id).execute()


def confirm_receipt(db, customer_id: str, order_id: str) -> None:
    """
    Spec 8.3 and 11.4. The only action that completes an order and the only one
    that increases stock -- which is exactly why a supplier cannot do it. If they
    could, stock would rise on a claim and their delivery speed would be
    self-reported (spec 10.4).
    """
    row = _get_row(db, customer_id, order_id)
    sm.assert_transition(row["status"], sm.PURCHASED, "customer")

    for item in row.get("order_items") or []:
        stock_item = (
            db.table("order_items").select("stock_item_id")
            .eq("order_id", order_id)
            .eq("catalog_product_id", item["catalog_product_id"])
            .single().execute()
        )
        sid = stock_item.data["stock_item_id"]
        # Through domain/stock so the top-up and its audit row commit together.
        stock.apply(db, sid, item["quantity_requested"], "order_received", customer_id, order_id)
        db.table("stock_items").update({"restock_requested": False}).eq("id", sid).execute()

    _set_status(db, order_id, sm.PURCHASED)

    notify.notify(
        row["supplier_id"], "order_completed",
        f"{row['reference']} is complete",
        "The customer has confirmed receipt.",
        order_id=order_id,
    )


def cancel(db, customer_id: str, order_id: str) -> None:
    """Spec 11.4: clears the flags so the products return to Low stock."""
    row = _get_row(db, customer_id, order_id)
    sm.assert_transition(row["status"], sm.CANCELLED, "customer")

    ids = [
        i["stock_item_id"]
        for i in (db.table("order_items").select("stock_item_id")
                  .eq("order_id", order_id).execute().data or [])
    ]
    if ids:
        db.table("stock_items").update({"restock_requested": False}).in_("id", ids).execute()

    _set_status(db, order_id, sm.CANCELLED)
    notify.notify(row["supplier_id"], "order_cancelled",
                  f"{row['reference']} was cancelled",
                  "The customer withdrew this order.", order_id=order_id)


def advance(db, customer_id: str, order_id: str, target: str) -> None:
    """
    Spec 8.3. Only for WhatsApp and email orders, where the supplier updates the
    customer outside the app. On an in-app order the supplier owns these
    transitions, so this is refused -- otherwise a customer could march their own
    order to delivered.
    """
    row = _get_row(db, customer_id, order_id)
    if row["channel"] == "in_app":
        raise Forbidden("The supplier updates this order from their own app.")
    # manual=True relaxes only who may act. The transition must still be legal.
    sm.assert_transition(row["status"], target, "customer", manual=True)
    _set_status(db, order_id, target)
