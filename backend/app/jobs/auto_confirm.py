"""
Auto confirmation

Purpose : Daily. Warns one day ahead, then closes orders marked delivered but never confirmed, setting auto_confirmed true.
Spec    : Section 11.5 and 14
Look here when : An order closes too early, too late, or never.
"""

import logging
from datetime import UTC, datetime, timedelta

from ..core.supabase import service_client
from ..domain import config_store, order_labels, stock
from ..feeds.shared.notifications import service as notify

log = logging.getLogger(__name__)

SELECT = ("id, reference, customer_id, supplier_id, supplier_marked_delivered_at, "
          "order_items(stock_item_id, catalog_product_id, quantity_requested, product_catalog!inner(name))")


def run() -> None:
    """
    Spec 11.5. Without this an order the customer never confirms stays open
    forever: stock is never topped up and the supplier's delivery speed never
    completes, which quietly corrupts 30 percent of their ranking.
    """
    db = service_client()
    close_after = config_store.get_int(db, "auto_confirm_days", 3)
    warn_before = config_store.get_int(db, "auto_confirm_warning_days", 1)
    now = datetime.now(UTC)

    _warn(db, now - timedelta(days=close_after - warn_before))
    _close(db, now - timedelta(days=close_after))


def _warn(db, cutoff) -> None:
    rows = (
        db.table("orders")
        .select("id, reference, customer_id, order_items(product_catalog!inner(name))")
        .eq("status", "on_the_way")
        .not_.is_("supplier_marked_delivered_at", "null")
        .lt("supplier_marked_delivered_at", cutoff.isoformat())
        .is_("auto_confirm_warned_at", "null")
        .execute().data or []
    )
    for order in rows:
        notify.notify(
            order["customer_id"], "auto_confirm_warning",
            f"{order_labels.titled(order['reference'], order.get('order_items') or [])}"
            " will close tomorrow",
            "Confirm receipt now if anything was wrong with this delivery.",
            order_id=order["id"],
        )
        db.table("orders").update(
            {"auto_confirm_warned_at": datetime.now(UTC).isoformat()}
        ).eq("id", order["id"]).execute()
    log.info("auto_confirm: warned on %d order(s)", len(rows))


def _close(db, cutoff) -> None:
    rows = (
        db.table("orders").select(SELECT)
        .eq("status", "on_the_way")
        .not_.is_("supplier_marked_delivered_at", "null")
        .lt("supplier_marked_delivered_at", cutoff.isoformat())
        .execute().data or []
    )

    for order in rows:
        # Same effects as a real confirmation, so stock and flags end up correct
        # either way. The difference is auto_confirmed, which excludes this order
        # from delivery speed -- a supplier should not be credited for a delivery
        # nobody actually verified.
        for item in order.get("order_items") or []:
            stock.receive(db, order["customer_id"], order["supplier_id"], order["id"], item)

        db.table("orders").update({
            "status": "purchased",
            "purchased_at": datetime.now(UTC).isoformat(),
            "auto_confirmed": True,
        }).eq("id", order["id"]).execute()

        notify.notify(order["customer_id"], "order_auto_confirmed",
                      f"{order_labels.titled(order['reference'], order.get('order_items') or [])}"
                      " closed automatically",
                      "Your stock has been topped up.", order_id=order["id"])

        # The supplier's half of the same event. Confirming by hand tells them
        # (delivery/service.py); closing on a timer used to tell nobody.
        notify.notify(order["supplier_id"], "order_completed",
                      f"{order['reference']} closed automatically",
                      "The customer did not confirm in time, so it closed itself.",
                      order_id=order["id"])

    log.info("auto_confirm: closed %d order(s)", len(rows))
