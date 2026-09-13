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


# An order in one of these states is still expected to arrive, so its products are
# already on their way and ordering them again would double the delivery.
OPEN_STATES = ("requested", "confirmed", "processing", "put_to_delivery", "on_the_way")


def _open_orders(db, customer_id: str, stock_item_ids: list[str]) -> dict[str, list[dict]]:
    """
    Which of these products are already on an order that has not arrived yet.

    Two queries rather than one join: PostgREST would have to make the orders embed
    inner to filter on its status, and the shape that produces is harder to read
    than asking twice.
    """
    orders = (
        db.table("orders")
        .select("id, reference, supplier_id, "
                "supplier:profiles!orders_supplier_id_fkey(business_name)")
        .eq("customer_id", customer_id).in_("status", list(OPEN_STATES))
        .execute().data or []
    )
    if not orders:
        return {}

    by_order = {o["id"]: o for o in orders}
    rows = (
        db.table("order_items").select("order_id, stock_item_id")
        .in_("order_id", list(by_order)).in_("stock_item_id", stock_item_ids)
        .execute().data or []
    )

    found: dict[str, list[dict]] = {}
    for row in rows:
        order = by_order[row["order_id"]]
        found.setdefault(row["stock_item_id"], []).append({
            "reference": order["reference"],
            "supplier_id": order["supplier_id"],
            "supplier_name": (order.get("supplier") or {}).get("business_name", "another supplier"),
        })
    return found


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
        "open_orders": _open_orders(db, customer_id, ids),
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


def duplicate_refusals(context: dict, lines: list[OrderLineIn]) -> list[str]:
    """
    The same product already on an open order with THIS supplier.

    Spec 6.5. Two deliveries of the same thing would both arrive and the stock would
    rise twice, so this is refused by default -- refused, not forbidden: a shop may
    genuinely want more. The app turns each of these into a confirmation and sends
    `allow_duplicate` once the owner has said yes.
    """
    supplier_name = context["supplier"]["business_name"]
    refusals: list[str] = []
    for line in lines:
        item = context["items"][line.stock_item_id]
        product = item["product_catalog"]
        for open_order in context["open_orders"].get(line.stock_item_id, []):
            if open_order["supplier_id"] == context["supplier"]["id"]:
                refusals.append(
                    f"{product['name']} {product['pack_size']} is already on order "
                    f"{open_order['reference']} with {supplier_name}."
                )
    return refusals


def duplicate_warnings(context: dict, lines: list[OrderLineIn]) -> list[str]:
    """
    Products already on an open order with someone else. Said out loud, not refused:
    a shop chasing a slow supplier is doing this deliberately.
    """
    warnings: list[str] = []
    for line in lines:
        item = context["items"][line.stock_item_id]
        product = item["product_catalog"]
        for open_order in context["open_orders"].get(line.stock_item_id, []):
            if open_order["supplier_id"] != context["supplier"]["id"]:
                warnings.append(
                    f"{product['name']} {product['pack_size']} is already on order "
                    f"{open_order['reference']} with {open_order['supplier_name']}."
                )
    return warnings


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
        warnings=duplicate_warnings(context, lines),
        duplicates=duplicate_refusals(context, lines),
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

    # Only the owner may waive this, and only after seeing it (spec 6.5).
    if not data.allow_duplicate:
        duplicates = duplicate_refusals(context, data.lines)
        if duplicates:
            raise ValidationFailed(
                " ".join(duplicates) + " Confirm the reorder if you meant to order it again."
            )

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
