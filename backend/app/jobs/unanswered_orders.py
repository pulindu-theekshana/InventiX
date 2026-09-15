"""
Unanswered order check

Purpose : Hourly. Finds requested orders older than the configured limit and notifies both parties.
Spec    : Section 14
Look here when : Nobody is warned about a stale order.
"""

import logging
from datetime import UTC, datetime, timedelta

from ..core.supabase import service_client
from ..domain import config_store, order_labels
from ..feeds.shared.notifications import service as notify

log = logging.getLogger(__name__)


def run() -> None:
    """
    Spec 14, default 24 hours from app_config (open question Q2).

    Both parties are told: the customer so they can try someone else, the
    supplier because they may simply not have looked. Notifying only the customer
    would push business away from a supplier who was one tap from accepting.
    """
    db = service_client()
    hours = config_store.get_int(db, "unanswered_order_hours", 24)
    cutoff = (datetime.now(UTC) - timedelta(hours=hours)).isoformat()

    rows = (
        db.table("orders")
        .select("id, reference, customer_id, supplier_id, requested_at, "
                "order_items(product_catalog!inner(name)), "
                "customer:profiles!orders_customer_id_fkey(business_name), "
                "supplier:profiles!orders_supplier_id_fkey(business_name)")
        .eq("status", "requested").lt("requested_at", cutoff)
        # Told once, not every hour until they act.
        .is_("unanswered_notified_at", "null")
        .execute().data or []
    )

    for order in rows:
        supplier_name = (order.get("supplier") or {}).get("business_name", "your supplier")
        customer_name = (order.get("customer") or {}).get("business_name", "a customer")
        titled = order_labels.titled(order["reference"], order.get("order_items") or [])

        notify.notify(
            order["customer_id"], "order_unanswered",
            f"{titled} has had no reply",
            f"{supplier_name} has not responded in {hours} hours. "
            "You may want to try another supplier.",
            order_id=order["id"],
        )
        notify.notify(
            order["supplier_id"], "order_ageing",
            f"{titled} is still waiting",
            f"{customer_name} has been waiting {hours} hours for a reply.",
            order_id=order["id"],
        )
        db.table("orders").update(
            {"unanswered_notified_at": datetime.now(UTC).isoformat()}
        ).eq("id", order["id"]).execute()

    log.info("unanswered_orders: notified on %d order(s)", len(rows))
