"""
Till logic

Purpose : Records a finished bill: totals it, moves stock through the one audited path, writes the bill and its lines, and feeds the same sales history Reports already read.
Spec    : Section 6.6 and 7
Look here when : A sale is stored twice, stock does not drop after a sale, or the day's summary disagrees with the bills.
"""

import logging
import re
import secrets
from datetime import date, timedelta
from decimal import Decimal

from ....core.exceptions import Conflict, NotFound, ValidationFailed
from ....core.supabase import service_client
from ....domain import pos as rules
from ....domain import seasonal, stock
from .schemas import (
    CashierAccountIn,
    CashierAccountOut,
    CashierTotalOut,
    DaySummaryOut,
    PosSettingsIn,
    PosSettingsOut,
    ReturnIn,
    SaleIn,
    SaleLineOut,
    SaleOut,
    TillActivityOut,
    TillCashierOut,
    TillEventOut,
)

log = logging.getLogger(__name__)

SELECT = (
    "id, receipt_no, kind, sold_at, payment_method, discount, total, cashier_label, "
    "pos_sale_items(catalog_product_id, stock_item_id, quantity, unit_price, line_total, "
    "returned_quantity, price_from_till, product_catalog!inner(name))"
)


def _out(row: dict) -> SaleOut:
    return SaleOut(
        id=row["id"],
        receipt_no=row["receipt_no"],
        kind=row["kind"],
        sold_at=row["sold_at"],
        payment_method=row["payment_method"],
        discount=float(row["discount"]),
        total=float(row["total"]),
        cashier_label=row.get("cashier_label"),
        lines=[
            SaleLineOut(
                catalog_product_id=i["catalog_product_id"],
                stock_item_id=i.get("stock_item_id"),
                name=(i.get("product_catalog") or {}).get("name", "Product"),
                quantity=float(i["quantity"]),
                unit_price=float(i["unit_price"]),
                line_total=float(i["line_total"]),
                returned_quantity=float(i["returned_quantity"]),
                price_from_till=bool(i.get("price_from_till")),
            )
            for i in (row.get("pos_sale_items") or [])
        ],
    )


def record_sale(db, owner_id: str, data: SaleIn, actor_id: str, actor_name: str) -> SaleOut:
    """
    A bill the till has already finished. The customer has paid and left: this is a record of
    something that happened, not a request for permission, so it is never refused over stock
    arithmetic (see domain/pos.stock_movement).

    Sent again after a timeout, it returns the first result rather than billing twice -- the
    same guarantee ordering gets, enforced by a unique constraint rather than by remembering.

    `actor_id` and `actor_name` come from the token, never from the body. Before cashier
    accounts the till sent the name it had been given, which made the signature on a bill worth
    exactly as much as the honesty of whoever typed it.
    """
    existing = (
        db.table("pos_sales").select(SELECT)
        .eq("owner_id", owner_id).eq("client_sale_id", data.client_sale_id)
        .maybe_single().execute()
    )
    if existing and existing.data:
        return _out(existing.data)

    # The lines name products; what the shop holds of each is read here, because the till may
    # have been offline for hours and its own idea of stock is out of date.
    stock_rows = {
        row["id"]: row
        for row in (
            db.table("stock_items").select("id, owner_id, quantity_on_hand")
            .eq("owner_id", owner_id)
            .in_("id", [line.stock_item_id for line in data.lines if line.stock_item_id] or ["none"])
            .execute().data or []
        )
    }
    for line in data.lines:
        if line.stock_item_id and line.stock_item_id not in stock_rows:
            # Someone else's stock id, or one that has been deleted. Refuse: a sale must not
            # move a quantity this shop does not own.
            raise ValidationFailed("That product is not in your stock list.")

    total = rules.bill_total(
        [{"quantity": line.quantity, "unit_price": line.unit_price} for line in data.lines],
        data.discount,
    )

    try:
        sale = service_client().table("pos_sales").insert({
            "owner_id": owner_id,
            "kind": "sale",
            "receipt_no": data.receipt_no,
            "device_id": data.device_id,
            "sold_at": data.sold_at.isoformat(),
            "payment_method": data.payment_method,
            "discount": float(rules.money(data.discount)),
            "total": float(total),
            "cashier_id": actor_id,
            "cashier_label": actor_name,
            "client_sale_id": data.client_sale_id,
        }).execute().data[0]
    except Exception as exc:
        # The database refuses a receipt number this shop has already used. That is a
        # conflict, not a server fault: a till whose stored counter was reset -- cleared
        # browser data, a new laptop -- starts again at 1 and collides. Said plainly, the
        # till can renumber and resend; as a 500 it retried the same number for ever.
        if "pos_sale_receipt_is_unique_per_shop" in str(exc):
            raise Conflict(
                f"Receipt {data.receipt_no} already exists for this shop.",
                code="receipt_taken",
            ) from exc
        raise

    items = [
        {
            "sale_id": sale["id"],
            "catalog_product_id": line.catalog_product_id,
            "stock_item_id": line.stock_item_id,
            "quantity": line.quantity,
            "unit_price": line.unit_price,
            "line_total": float(rules.line_total(line.quantity, line.unit_price)),
            "price_from_till": line.price_from_till,
        }
        for line in data.lines
    ]
    service_client().table("pos_sale_items").insert(items).execute()

    # Reports read sales_records, so a till sale has to land there too or the shop's own
    # history would show only what was uploaded from a file.
    service_client().table("sales_records").insert([
        {
            "source": "pos",
            "pos_sale_id": sale["id"],
            "stock_item_id": line.stock_item_id,
            "catalog_product_id": line.catalog_product_id,
            "quantity_sold": rules.whole_units(line.quantity),
            "sale_date": data.sold_at.date().isoformat(),
        }
        for line in data.lines
    ]).execute()

    _move_stock(db, actor_id, sale["id"], data.lines, stock_rows)

    created = (
        db.table("pos_sales").select(SELECT).eq("id", sale["id"]).maybe_single().execute()
    )
    return _out(created.data)


def _move_stock(db, actor_id: str, sale_id: str, lines, stock_rows: dict) -> None:
    """
    Through domain/stock.apply, so the quantity and its audit row commit together -- a sale is
    not allowed to be the one quantity change nobody can explain afterwards.

    A failure here is logged, not raised: the money has already changed hands, and losing the
    bill to keep the stock figure tidy would be the wrong way round. The shop can correct a
    count; it cannot recover a sale it never recorded.
    """
    for line in lines:
        if not line.stock_item_id:
            continue
        on_hand = stock_rows.get(line.stock_item_id, {}).get("quantity_on_hand")
        change = rules.stock_movement(line.quantity, on_hand)
        if change <= 0:
            continue
        try:
            # actor_id, so the audit row names the person at the counter rather than the shop.
            stock.apply(db, line.stock_item_id, -change, "pos_sale", actor_id, sale_id)
        except Exception:
            log.exception("stock did not move for line %s on sale %s",
                          line.stock_item_id, sale_id)


def record_return(db, owner_id: str, data: ReturnIn, actor_id: str, actor_name: str) -> SaleOut:
    """
    Goods coming back against a bill this shop issued.

    Prices come from the original bill, never from the request: a return that could name its own
    price is a way to empty the drawer. Quantities are checked against what is left on each line,
    so the same item cannot be returned twice.
    """
    existing = (
        db.table("pos_sales").select(SELECT)
        .eq("owner_id", owner_id).eq("client_sale_id", data.client_sale_id)
        .maybe_single().execute()
    )
    if existing and existing.data:
        return _out(existing.data)

    original = (
        db.table("pos_sales").select(f"id, kind, {SELECT}")
        .eq("owner_id", owner_id).eq("receipt_no", data.returns_receipt_no)
        .maybe_single().execute()
    )
    if not original or not original.data:
        raise NotFound("We could not find a bill with that receipt number.")
    if original.data["kind"] != "sale":
        raise ValidationFailed("That receipt is itself a return.")

    sold = {i["catalog_product_id"]: i for i in (original.data.get("pos_sale_items") or [])}

    lines: list[dict] = []
    for line in data.lines:
        item = sold.get(line.catalog_product_id)
        if not item:
            raise ValidationFailed("That product is not on the bill being returned.")
        left = rules.returnable(item["quantity"], item["returned_quantity"])
        if Decimal(str(line.quantity)) > left:
            raise ValidationFailed(
                f"Only {left} of {(item.get('product_catalog') or {}).get('name', 'that item')} "
                "is left to return on this bill."
            )
        lines.append({
            "item": item,
            "quantity": line.quantity,
            "unit_price": float(item["unit_price"]),
        })

    total = rules.bill_total(
        [{"quantity": line["quantity"], "unit_price": line["unit_price"]} for line in lines]
    )

    ret = service_client().table("pos_sales").insert({
        "owner_id": owner_id,
        "kind": "return",
        "returns_sale_id": original.data["id"],
        "receipt_no": data.receipt_no,
        "device_id": data.device_id,
        "sold_at": data.sold_at.isoformat(),
        # Money goes back the way it came in. Card refunds are the card machine's business.
        "payment_method": "cash",
        "discount": 0,
        "total": float(total),
        "cashier_id": actor_id,
        "cashier_label": actor_name,
        "client_sale_id": data.client_sale_id,
    }).execute().data[0]

    service_client().table("pos_sale_items").insert([
        {
            "sale_id": ret["id"],
            "catalog_product_id": line["item"]["catalog_product_id"],
            "stock_item_id": line["item"].get("stock_item_id"),
            "quantity": line["quantity"],
            "unit_price": line["unit_price"],
            "line_total": float(rules.line_total(line["quantity"], line["unit_price"])),
        }
        for line in lines
    ]).execute()

    # Mark the original lines, so the same goods cannot come back a second time.
    for line in lines:
        item = line["item"]
        service_client().table("pos_sale_items").update({
            "returned_quantity": float(Decimal(str(item["returned_quantity"]))
                                       + Decimal(str(line["quantity"]))),
        }).eq("sale_id", original.data["id"]).eq(
            "catalog_product_id", item["catalog_product_id"]
        ).execute()

    # Sales history, as negative rows: summing quantity_sold then gives what the shop really
    # sold. Without this a return would restore the stock but leave the sale counted (0027).
    service_client().table("sales_records").insert([
        {
            "source": "pos",
            "pos_sale_id": ret["id"],
            "stock_item_id": line["item"].get("stock_item_id"),
            "catalog_product_id": line["item"]["catalog_product_id"],
            "quantity_sold": -rules.whole_units(line["quantity"]),
            "sale_date": data.sold_at.date().isoformat(),
        }
        for line in lines
        if rules.whole_units(line["quantity"]) > 0
    ]).execute()

    # Stock comes back. Through the same audited path, so the shelf and the trail agree.
    for line in lines:
        stock_item_id = line["item"].get("stock_item_id")
        if not stock_item_id:
            continue
        change = rules.whole_units(line["quantity"])
        if change <= 0:
            continue
        try:
            stock.apply(db, stock_item_id, change, "return", actor_id, ret["id"])
        except Exception:
            log.exception("stock did not come back for %s on return %s", stock_item_id, ret["id"])

    created = db.table("pos_sales").select(SELECT).eq("id", ret["id"]).maybe_single().execute()
    return _out(created.data)


def get_sale(db, owner_id: str, receipt_no: str) -> SaleOut:
    """Used at the counter when a customer brings a receipt back."""
    row = (
        db.table("pos_sales").select(SELECT)
        .eq("owner_id", owner_id).eq("receipt_no", receipt_no.strip())
        .maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("We could not find a bill with that receipt number.")
    return _out(row.data)


def list_sales(db, owner_id: str, day: date | None = None, limit: int = 50) -> list[SaleOut]:
    # seasonal.today() is the shop's date in Colombo; date.today() on a UTC host is yesterday
    # until 5.30am, which would empty the till's own day view every morning.
    day = day or seasonal.today()
    rows = (
        db.table("pos_sales").select(SELECT)
        .eq("owner_id", owner_id)
        .gte("sold_at", f"{day.isoformat()}T00:00:00")
        .lte("sold_at", f"{day.isoformat()}T23:59:59")
        .order("sold_at", desc=True).limit(limit)
        .execute().data or []
    )
    return [_out(row) for row in rows]


def day_summary(db, owner_id: str, day: date | None = None) -> DaySummaryOut:
    """
    What the drawer should hold at closing time. Cash only: a card payment never reached the
    drawer, so counting it in would make every honest till look short.
    """
    day = day or seasonal.today()
    rows = (
        db.table("pos_sales").select("kind, payment_method, total, cashier_label")
        .eq("owner_id", owner_id)
        .gte("sold_at", f"{day.isoformat()}T00:00:00")
        .lte("sold_at", f"{day.isoformat()}T23:59:59")
        .execute().data or []
    )

    def total(kind: str, method: str | None = None) -> float:
        return float(sum(
            float(r["total"]) for r in rows
            if r["kind"] == kind and (method is None or r["payment_method"] == method)
        ))

    sales, returns = total("sale"), total("return")

    # Grouped here rather than in the database: a shop's day is tens of bills, and PostgREST
    # cannot group without a view. Phase 5 gives cashier_label a real person behind it.
    per: dict[str | None, list[float]] = {}
    for row in rows:
        if row["kind"] != "sale":
            continue
        slot = per.setdefault(row.get("cashier_label"), [0, 0.0])
        slot[0] += 1
        slot[1] += float(row["total"])

    return DaySummaryOut(
        date=day.isoformat(),
        bills=sum(1 for r in rows if r["kind"] == "sale"),
        sales_total=round(sales, 2),
        returns_total=round(returns, 2),
        cash_expected=round(total("sale", "cash") - total("return", "cash"), 2),
        card_total=round(total("sale", "card"), 2),
        other_total=round(total("sale", "other"), 2),
        by_cashier=[
            CashierTotalOut(cashier=name, bills=int(count), sales_total=round(value, 2))
            for name, (count, value) in sorted(per.items(), key=lambda kv: -kv[1][1])
        ],
    )


def get_settings(db, owner_id: str) -> PosSettingsOut:
    """
    Defaults when the shop has never set anything: no PIN, so the till does not lock. A
    one-person shop should not have to configure a lock against nobody.
    """
    row = (
        db.table("pos_settings").select("owner_pin_hash, discount_limit, return_limit, cashiers")
        .eq("owner_id", owner_id).maybe_single().execute()
    )
    if not row or not row.data:
        return PosSettingsOut()
    return PosSettingsOut(
        owner_pin_hash=row.data.get("owner_pin_hash"),
        discount_limit=float(row.data["discount_limit"]),
        return_limit=float(row.data["return_limit"]),
        cashiers=row.data.get("cashiers") or [],
    )


def save_settings(db, owner_id: str, data: PosSettingsIn) -> PosSettingsOut:
    """
    The hashes arrive already hashed, so this never handles a PIN. Upsert on owner_id: a shop has
    one set of till settings, and "create or update" is the only operation that makes sense.
    """
    service_client().table("pos_settings").upsert({
        "owner_id": owner_id,
        "owner_pin_hash": data.owner_pin_hash,
        "discount_limit": data.discount_limit,
        "return_limit": data.return_limit,
        "cashiers": [c.model_dump() for c in data.cashiers],
    }).execute()
    return get_settings(db, owner_id)


def next_receipt(db, owner_id: str, device_id: str) -> str:
    """
    The number this till should use next, read from what the shop already has.

    A till keeps its own counter so it can number bills with no connection, but that counter
    lives on the device: clear the browser data and it starts at 1 again, colliding with every
    bill already stored. Asking once, while online, is what stops that.
    """
    rows = (
        db.table("pos_sales").select("receipt_no")
        .eq("owner_id", owner_id).like("receipt_no", f"{device_id}-%")
        .execute().data or []
    )
    highest = 0
    for row in rows:
        tail = row["receipt_no"].rsplit("-", 1)[-1]
        if tail.isdigit():
            highest = max(highest, int(tail))
    return f"{device_id}-{highest + 1:06d}"


# ---------------------------------------------------------------------------
# What the owner sees
# ---------------------------------------------------------------------------
# Day close answers "does the drawer match" for one till on one day. This answers a different
# question -- "who did what, and is any of it odd" -- from the owner's own phone, over a range.

# One query, grouped in Python, as day_summary does. A month of a small shop's bills is hundreds
# of rows, and PostgREST cannot group without a view. The cap is what keeps that true.
MAX_DAYS = 31
MAX_EVENTS = 200


def activity(db, owner_id: str, start: date | None, end: date | None) -> TillActivityOut:
    """
    Takings per person and every bill worth a second look, between two dates.

    `cashier_id` is what makes this worth reading: it is stamped from the signed-in account
    (migration 0029), so the name beside an amount is not something the till chose.
    """
    end = end or seasonal.today()
    start = start or (end - timedelta(days=6))
    if start > end:
        start, end = end, start
    # A range nobody asked for is a query nobody can afford. The screen offers a day or a week.
    start = max(start, end - timedelta(days=MAX_DAYS - 1))

    rows = (
        db.table("pos_sales")
        .select("receipt_no, kind, sold_at, total, discount, cashier_id, cashier_label, "
                "pos_sale_items(price_from_till)")
        .eq("owner_id", owner_id)
        .gte("sold_at", f"{start.isoformat()}T00:00:00")
        .lte("sold_at", f"{end.isoformat()}T23:59:59")
        .order("sold_at", desc=True)
        .execute().data or []
    )

    limits = get_settings(db, owner_id)

    people: dict[tuple[str | None, str | None], TillCashierOut] = {}
    events: list[TillEventOut] = []
    sales = returns = discounts = 0.0
    bills = 0

    for row in rows:
        total = float(row["total"])
        discount = float(row["discount"])
        key = (row.get("cashier_id"), row.get("cashier_label"))
        person = people.setdefault(
            key, TillCashierOut(cashier_id=key[0], cashier=key[1])
        )

        if row["kind"] == "sale":
            bills += 1
            sales += total
            discounts += discount
            person.bills += 1
            person.sales_total += total
            person.discounts_total += discount
            over = discount > 0 and discount > limits.discount_limit
        else:
            returns += total
            person.returns_total += total
            over = total > limits.return_limit

        # A price typed at the counter belongs beside the discounts: it is the other way a bill
        # can be worth less than it should be, and the shop fixes it by setting a price in Stocks.
        priced_at_till = any(
            item.get("price_from_till") for item in (row.get("pos_sale_items") or [])
        )

        # Every discount and every return. A return of nothing unusual still belongs here: it is
        # the other way money leaves the drawer, and the owner is the one who decides what is odd.
        if (row["kind"] == "return" or discount > 0 or priced_at_till) and len(events) < MAX_EVENTS:
            events.append(TillEventOut(
                receipt_no=row["receipt_no"],
                kind=row["kind"],
                sold_at=row["sold_at"],
                cashier=row.get("cashier_label"),
                cashier_id=row.get("cashier_id"),
                total=round(total, 2),
                discount=round(discount, 2),
                above_limit=over,
                priced_at_till=priced_at_till,
            ))

    for person in people.values():
        person.sales_total = round(person.sales_total, 2)
        person.discounts_total = round(person.discounts_total, 2)
        person.returns_total = round(person.returns_total, 2)

    return TillActivityOut(
        from_date=start.isoformat(),
        to_date=end.isoformat(),
        bills=bills,
        sales_total=round(sales, 2),
        returns_total=round(returns, 2),
        discounts_total=round(discounts, 2),
        by_cashier=sorted(people.values(), key=lambda c: -c.sales_total),
        events=events,
    )
# ---------------------------------------------------------------------------
# Cashier accounts
# ---------------------------------------------------------------------------
# A cashier account is an ordinary Supabase user with a profile whose role is 'cashier' and
# whose employer_id is this shop. That is the whole mechanism: the database policies and
# dependencies.py both ask app_shop_id()/shop_id, so nothing else had to learn about staff.
#
# Created here with the service key, for the same reason registration is (feeds/shared/auth):
# a client that can write its own profile row can give itself a role.

# A shop assistant may well have no email address, so the till makes one. No mail is ever sent
# to it -- it is a username that happens to be shaped like an address, because Supabase signs
# people in by email.
LOGIN_DOMAIN = "till.inventix.app"


def _login_email(name: str) -> str:
    """nimal.3f8a1c@till.inventix.app -- short enough to type at a counter, unique per account."""
    slug = re.sub(r"[^a-z0-9]+", "", name.lower())[:12] or "cashier"
    return f"{slug}.{secrets.token_hex(3)}@{LOGIN_DOMAIN}"


def list_cashiers(owner_id: str) -> list[CashierAccountOut]:
    """Only the ones still working here. A removed account stays in the table so the bills it
    rang keep their name, but it has no business on the owner's list."""
    rows = (
        service_client().table("profiles")
        .select("id, contact_person, email, is_active")
        .eq("employer_id", owner_id).eq("role", "cashier").eq("is_active", True)
        .order("contact_person")
        .execute().data or []
    )
    return [
        CashierAccountOut(
            id=row["id"],
            name=row["contact_person"],
            login_email=row["email"],
            is_active=row["is_active"],
        )
        for row in rows
    ]


def create_cashier(owner_id: str, data: CashierAccountIn) -> CashierAccountOut:
    """
    Makes the login and the profile that ties it to this shop.

    email_confirm is set so the account works immediately: there is no inbox to confirm from,
    and an unconfirmed user cannot sign in.
    """
    db = service_client()

    shop = (
        db.table("profiles").select("business_name, phone")
        .eq("id", owner_id).maybe_single().execute()
    )
    if not shop or not shop.data:
        raise NotFound("We could not find your shop's profile.")

    name = data.name.strip()
    if any(c.name.lower() == name.lower() for c in list_cashiers(owner_id)):
        raise Conflict("Someone with that name already has a login.")

    email = _login_email(name)
    created = db.auth.admin.create_user({
        "email": email,
        "password": data.password,
        "email_confirm": True,
    })
    user_id = created.user.id

    try:
        db.table("profiles").insert({
            "id": user_id,
            "role": "cashier",
            "employer_id": owner_id,
            # The shop's name, so the till's header reads the same for everyone standing at it.
            "business_name": shop.data["business_name"],
            "contact_person": name,
            "phone": shop.data["phone"],
            "email": email,
        }).execute()
    except Exception:
        # Without this the shop would be left with a login that can sign in and has no profile,
        # which every request then reports as an incomplete account nobody can finish.
        db.auth.admin.delete_user(user_id)
        raise

    return CashierAccountOut(id=user_id, name=name, login_email=email)


def remove_cashier(owner_id: str, cashier_id: str) -> None:
    """
    Switches the account off rather than deleting it: get_current_user refuses an inactive
    account, and every bill they rang keeps a name that still resolves to a person.
    """
    row = (
        service_client().table("profiles").select("id")
        .eq("id", cashier_id).eq("employer_id", owner_id).eq("role", "cashier")
        .maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("That cashier is not one of yours.")
    service_client().table("profiles").update({"is_active": False}).eq("id", cashier_id).execute()
