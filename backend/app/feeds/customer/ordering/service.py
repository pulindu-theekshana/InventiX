"""
Restock popup logic

Purpose : Orchestrates the most important interaction in the app: build the message, validate quantities against the listing, regenerate on supplier change, create the order and order_items, set restock_requested, dispatch on the chosen channel.
Spec    : Section 6.5
Look here when : Send is wrongly disabled or enabled, the wrong supplier is used, or stock is not marked as requested.
"""

from ....core import idempotency
from ....core.exceptions import NotFound, ValidationFailed
from ....domain import message_builder
from ....integrations import queue
from .schemas import GenerateMessageOut, OrderLineIn, SendOrderIn, SendOrderOut


def _load_context(db, customer_id: str, supplier_id: str, lines: list[OrderLineIn]) -> dict:
    """
    Everything the popup needs in three queries rather than one per line: the
    supplier, the stock items being ordered, and the supplier's listings for them.
    """
    supplier = (
        db.table("profiles")
        .select("id, business_name, email, whatsapp_number, is_active")
        .eq("id", supplier_id).eq("role", "supplier").maybe_single().execute()
    )
    if not supplier or not supplier.data:
        raise NotFound("We could not find that supplier.")

    ids = [line.stock_item_id for line in lines]
    items = (
        db.table("stock_items")
        .select("id, quantity_on_hand, catalog_product_id, "
                "product_catalog!inner(id, name, pack_size)")
        .eq("owner_id", customer_id).in_("id", ids).execute().data or []
    )
    if len(items) != len(ids):
        raise NotFound("One of those products is no longer in your stock.")

    by_item = {i["id"]: i for i in items}
    listings = (
        db.table("supplier_listings")
        .select("id, catalog_product_id, unit_price, quantity_available, min_order_quantity")
        .eq("supplier_id", supplier_id).eq("is_active", True)
        .in_("catalog_product_id", [i["catalog_product_id"] for i in items])
        .execute().data or []
    )
    return {
        "supplier": supplier.data,
        "items": by_item,
        "listings": {l["catalog_product_id"]: l for l in listings},
    }


def validate(context: dict, lines: list[OrderLineIn]) -> list[str]:
    """
    Spec 6.5 quantity validation. Returns one message per offending line, naming
    the product and the limit.

    A disabled Send button with no explanation is explicitly not acceptable, so
    every refusal here has to be readable by a shop owner. This runs server-side
    regardless of what the app already checked -- the app's validation is a
    convenience, not a control.
    """
    supplier_name = context["supplier"]["business_name"]
    problems: list[str] = []

    for line in lines:
        item = context["items"][line.stock_item_id]
        product = item["product_catalog"]
        listing = context["listings"].get(item["catalog_product_id"])

        if listing is None:
            problems.append(f"{supplier_name} does not sell {product['name']} {product['pack_size']}.")
            continue
        if line.quantity > listing["quantity_available"]:
            problems.append(
                f"{supplier_name} has only {listing['quantity_available']} units of "
                f"{product['name']} {product['pack_size']}."
            )
        if line.quantity < listing["min_order_quantity"]:
            problems.append(
                f"{supplier_name} needs at least {listing['min_order_quantity']} units of "
                f"{product['name']} {product['pack_size']}."
            )
    return problems


def generate_message(db, customer: dict, supplier_id: str,
                     lines: list[OrderLineIn]) -> GenerateMessageOut:
    """
    Spec 6.5: built by the backend so the wording can improve without an app
    release, and so two implementations cannot drift apart.
    """
    context = _load_context(db, customer["id"], supplier_id, lines)
    message_lines = []
    for line in lines:
        item = context["items"][line.stock_item_id]
        listing = context["listings"].get(item["catalog_product_id"])
        message_lines.append(message_builder.MessageLine(
            name=item["product_catalog"]["name"],
            pack_size=item["product_catalog"]["pack_size"],
            quantity_requested=line.quantity,
            current_quantity=item["quantity_on_hand"],
            unit_price=float(listing["unit_price"]) if listing else None,
        ))

    return GenerateMessageOut(
        message_body=message_builder.build(
            shop_name=customer["business_name"],
            supplier_name=context["supplier"]["business_name"],
            lines=message_lines,
            delivery_address=customer.get("address"),
        ),
        problems=validate(context, lines),
    )


def send(db, customer: dict, data: SendOrderIn, idempotency_key: str) -> SendOrderOut:
    """
    Spec 6.5 "what happens on send", in order.

    The whole database side is one call to create_order(), because the orders
    row, its lines and the restock flags have to commit together -- a crash
    between them leaves an order with no lines, or lines whose products can be
    ordered again immediately.
    """
    # 1. Idempotency, before anything is written. Spec 15.4: a repeated send on a
    #    poor connection must produce one order, not two.
    existing = idempotency.claim(db, customer["id"], idempotency_key)
    if existing:
        row = db.table("orders").select("id, reference").eq("id", existing).single().execute()
        return SendOrderOut(order_id=row.data["id"], reference=row.data["reference"],
                            message_sent=True, message_detail="already sent")

    context = _load_context(db, customer["id"], data.supplier_id, data.lines)

    # 2. Re-validate server-side. What the app checked does not count.
    problems = validate(context, data.lines)
    if problems:
        raise ValidationFailed(" ".join(problems))

    # 3. in_app is only offered when the supplier is on InventiX (spec 6.5).
    if data.channel == "in_app" and not context["supplier"].get("is_active"):
        raise ValidationFailed(
            f"{context['supplier']['business_name']} is not accepting in-app orders. "
            "Send by WhatsApp or email instead."
        )

    payload = []
    for line in data.lines:
        item = context["items"][line.stock_item_id]
        listing = context["listings"][item["catalog_product_id"]]
        payload.append({
            "stock_item_id": line.stock_item_id,
            "listing_id": listing["id"],
            "catalog_product_id": item["catalog_product_id"],
            "quantity": line.quantity,
            # Captured now, so a later price change does not rewrite this order.
            "unit_price": float(listing["unit_price"]),
        })

    # 4. One transaction: order, lines, restock flags.
    try:
        created = db.rpc("create_order", {
            "p_customer_id": customer["id"],
            "p_supplier_id": data.supplier_id,
            "p_channel": data.channel,
            "p_message_body": data.message_body,
            "p_message_edited": data.message_edited,
            "p_delivery_date": data.requested_delivery_date.isoformat()
            if data.requested_delivery_date else None,
            "p_notes": data.notes,
            "p_idempotency_key": idempotency_key,
            "p_lines": payload,
        }).execute()
    except Exception as exc:
        # The other half of idempotency: two identical requests raced, the unique
        # constraint refused this one, so return the order the winner created.
        if "idempotency_key" in str(exc):
            order_id = idempotency.resolve_duplicate(db, customer["id"], idempotency_key)
            row = db.table("orders").select("id, reference").eq("id", order_id).single().execute()
            return SendOrderOut(order_id=row.data["id"], reference=row.data["reference"])
        raise

    row = created.data[0] if isinstance(created.data, list) else created.data
    order_id, reference = row["order_id"], row["reference"]

    # 5. Dispatch. Spec 15.4: a channel being down must not fail the order, which
    #    already exists. The user is told the order was placed and the message is
    #    pending, rather than that everything failed.
    sent, detail = queue.dispatch(
        data.channel,
        to_number=context["supplier"].get("whatsapp_number"),
        to_address=context["supplier"].get("email"),
        subject=f"Restock request from {customer['business_name']}",
        message=data.message_body,
    )
    if not sent:
        queue.enqueue(order_id, data.channel, {"reason": detail})

    return SendOrderOut(order_id=order_id, reference=reference,
                        message_sent=sent, message_detail=None if sent else detail)
