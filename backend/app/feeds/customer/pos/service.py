"""
Till logic

Purpose : Records a finished bill: totals it, moves stock through the one audited path, writes the bill and its lines, and feeds the same sales history Reports already read.
Spec    : Section 6.6 and 7
Look here when : A sale is stored twice, stock does not drop after a sale, or the day's summary disagrees with the bills.
"""

import logging
from datetime import date

from ....core.exceptions import NotFound, ValidationFailed
from ....core.supabase import service_client
from ....domain import pos as rules
from ....domain import seasonal, stock
from .schemas import DaySummaryOut, SaleIn, SaleLineOut, SaleOut

log = logging.getLogger(__name__)

SELECT = (
    "id, receipt_no, kind, sold_at, payment_method, discount, total, cashier_label, "
    "pos_sale_items(catalog_product_id, stock_item_id, quantity, unit_price, line_total, "
    "returned_quantity, product_catalog!inner(name))"
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
            )
            for i in (row.get("pos_sale_items") or [])
        ],
    )


def record_sale(db, owner_id: str, data: SaleIn) -> SaleOut:
    """
    A bill the till has already finished. The customer has paid and left: this is a record of
    something that happened, not a request for permission, so it is never refused over stock
    arithmetic (see domain/pos.stock_movement).

    Sent again after a timeout, it returns the first result rather than billing twice -- the
    same guarantee ordering gets, enforced by a unique constraint rather than by remembering.
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

    sale = service_client().table("pos_sales").insert({
        "owner_id": owner_id,
        "kind": "sale",
        "receipt_no": data.receipt_no,
        "device_id": data.device_id,
        "sold_at": data.sold_at.isoformat(),
        "payment_method": data.payment_method,
        "discount": float(rules.money(data.discount)),
        "total": float(total),
        "cashier_label": data.cashier_label,
        "client_sale_id": data.client_sale_id,
    }).execute().data[0]

    items = [
        {
            "sale_id": sale["id"],
            "catalog_product_id": line.catalog_product_id,
            "stock_item_id": line.stock_item_id,
            "quantity": line.quantity,
            "unit_price": line.unit_price,
            "line_total": float(rules.line_total(line.quantity, line.unit_price)),
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

    _move_stock(db, owner_id, sale["id"], data.lines, stock_rows)

    created = (
        db.table("pos_sales").select(SELECT).eq("id", sale["id"]).maybe_single().execute()
    )
    return _out(created.data)


def _move_stock(db, owner_id: str, sale_id: str, lines, stock_rows: dict) -> None:
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
            stock.apply(db, line.stock_item_id, -change, "pos_sale", owner_id, sale_id)
        except Exception:
            log.exception("stock did not move for line %s on sale %s",
                          line.stock_item_id, sale_id)


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
        db.table("pos_sales").select("kind, payment_method, total")
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
    return DaySummaryOut(
        date=day.isoformat(),
        bills=sum(1 for r in rows if r["kind"] == "sale"),
        sales_total=round(sales, 2),
        returns_total=round(returns, 2),
        cash_expected=round(total("sale", "cash") - total("return", "cash"), 2),
        card_total=round(total("sale", "card"), 2),
        other_total=round(total("sale", "other"), 2),
    )
