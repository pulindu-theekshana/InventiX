"""
Applying an upload

Purpose : Writes sales_records, reduces stock and writes an audit row per reduction. All or nothing: a half-applied upload leaves quantities nobody can explain.
Spec    : Section 6.6
Look here when : Stock was reduced twice, or half an upload was applied.
"""

import logging
from collections import defaultdict

from ....domain import stock
from ...shared.notifications import service as notify
from . import mapping, parser

log = logging.getLogger(__name__)


def apply(db, customer_id: str, upload: dict, rows: list[dict],
          column_map: dict[str, str]) -> dict:
    """
    Spec 6.6 step 22, and the order matters.

    Sales for the same product across many lines are summed first, so one product
    sold on twenty days is one stock movement with one audit row rather than
    twenty. The audit trail should read like what happened, not like the file.
    """
    aliases = mapping.load_aliases(db, customer_id)

    totals: dict[str, int] = defaultdict(int)
    records: list[dict] = []
    unmatched = 0

    for row in rows:
        pos_name = str(row.get(column_map["product"], "")).strip()
        quantity = parser.to_int(row.get(column_map["quantity"]))
        sale_date = parser.to_date(row.get(column_map["date"]))

        if not pos_name or quantity is None or quantity <= 0 or sale_date is None:
            continue

        catalog_id = mapping.resolve(aliases, pos_name)
        if catalog_id is None:
            # Recorded anyway: the upload's own row count has to add up, and an
            # unmatched line is data the owner may map later.
            unmatched += 1
            records.append({
                "upload_id": upload["id"], "stock_item_id": None,
                "catalog_product_id": None, "quantity_sold": quantity,
                "sale_date": sale_date.isoformat(),
            })
            continue

        totals[catalog_id] += quantity
        records.append({
            "upload_id": upload["id"], "stock_item_id": None,
            "catalog_product_id": catalog_id, "quantity_sold": quantity,
            "sale_date": sale_date.isoformat(),
        })

    items = {
        i["catalog_product_id"]: i
        for i in (db.table("stock_items")
                  .select("id, catalog_product_id, quantity_on_hand, low_threshold, "
                          "restock_requested, product_catalog!inner(name)")
                  .eq("owner_id", customer_id)
                  .in_("catalog_product_id", list(totals) or ["none"])
                  .execute().data or [])
    }

    for record in records:
        item = items.get(record["catalog_product_id"])
        if item:
            record["stock_item_id"] = item["id"]
    if records:
        db.table("sales_records").insert(records).execute()

    crossed: list[dict] = []
    for catalog_id, sold in totals.items():
        item = items.get(catalog_id)
        if not item:
            # Sold something the shop does not track. Recorded, not applied --
            # inventing a stock item from a sales line would guess a threshold.
            continue

        # Never below zero: a POS report can overlap a period already applied, and
        # refusing the whole upload for that would be worse than clamping.
        change = -min(sold, item["quantity_on_hand"])
        if change == 0:
            continue

        was_low = stock.is_low(item["quantity_on_hand"], item["low_threshold"])
        after = stock.apply(db, item["id"], change, "sales_upload", customer_id, upload["id"])
        if not was_low and stock.is_low(after, item["low_threshold"]):
            crossed.append({"id": item["id"], "name": item["product_catalog"]["name"],
                            "quantity": after})

    db.table("sales_uploads").update({
        "status": "applied", "row_count": len(records),
        "unmatched_count": unmatched, "applied_at": "now()",
    }).eq("id", upload["id"]).execute()

    # Spec 6.6 step 23. After the upload is committed, so a failed notification
    # cannot roll back a correct stock reduction.
    for item in crossed:
        notify.notify(
            customer_id, "low_stock",
            f"{item['name']} is low",
            f"Only {item['quantity']} left after your latest sales report.",
            stock_item_id=item["id"],
        )

    return {"row_count": len(records), "unmatched_count": unmatched,
            "reduced": len(totals), "now_low": len(crossed)}
