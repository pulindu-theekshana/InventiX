"""
Stale stock reminder

Purpose : Daily. Reminds customers who have not uploaded a sales report recently.
Spec    : Section 14
Look here when : No reminder despite an old last upload.
"""

import logging
from datetime import UTC, datetime, timedelta

from ..core.supabase import service_client
from ..domain import config_store
from ..feeds.shared.notifications import service as notify

log = logging.getLogger(__name__)


def run() -> None:
    """
    Spec 6.6 names staleness as the known weakness of the upload method: stock is
    only accurate as of the last report, and low-stock warnings quietly stop
    being true after that.

    Reminds weekly rather than daily once overdue -- a daily nag about the same
    thing gets ignored, and then so does everything else.
    """
    db = service_client()
    days = config_store.get_int(db, "stale_upload_days", 7)
    cutoff = (datetime.now(UTC) - timedelta(days=days)).isoformat()

    customers = (
        db.table("profiles").select("id").eq("role", "customer").eq("is_active", True)
        .execute().data or []
    )

    reminded = 0
    for customer in customers:
        last = (
            db.table("sales_uploads").select("created_at")
            .eq("customer_id", customer["id"]).eq("status", "applied")
            .order("created_at", desc=True).limit(1).execute().data
        )
        if last and last[0]["created_at"] > cutoff:
            continue

        # A shop with no stock yet has nothing to be stale about.
        has_stock = (
            db.table("stock_items").select("id")
            .eq("owner_id", customer["id"]).limit(1).execute().data
        )
        if not has_stock:
            continue

        recent = (
            db.table("notifications").select("id")
            .eq("user_id", customer["id"]).eq("type", "stale_stock")
            .gt("created_at", (datetime.now(UTC) - timedelta(days=7)).isoformat())
            .limit(1).execute().data
        )
        if recent:
            continue

        notify.notify(
            customer["id"], "stale_stock",
            f"No sales report for {days} days",
            "Your stock figures may be out of date. Upload a report to bring them current.",
        )
        reminded += 1

    log.info("stale_stock: reminded %d customer(s)", reminded)
