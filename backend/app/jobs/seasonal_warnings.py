"""
Seasonal warning check

Purpose : Daily. Finds seasonal events entering their lead time window and notifies affected customers.
Spec    : Section 14
Look here when : A festival notification never arrives.
"""

import logging
from datetime import date

from ..core.supabase import service_client
from ..domain import seasonal
from ..feeds.shared.notifications import service as notify

log = logging.getLogger(__name__)


def run(today: date | None = None) -> None:
    """
    Spec 14. Notifies only on the day an event *enters* its window, not every day
    it is inside one -- otherwise a customer gets the same Christmas warning every
    morning for three months and stops reading notifications entirely.
    """
    today = today or seasonal.today()
    db = service_client()

    events = [
        seasonal.Event(
            id=row["id"], name=row["name"],
            event_date=date.fromisoformat(row["event_date"]),
            lead_time_months=row["lead_time_months"],
            affected_categories=row["affected_categories"] or [],
            expected_uplift_pct=row["expected_uplift_pct"],
        )
        for row in (db.table("seasonal_events").select("*").execute().data or [])
    ]

    entering = [
        e for e in events
        if seasonal.is_in_window(e, today) and not seasonal.is_in_window(e, _yesterday(today))
    ]
    if not entering:
        log.info("seasonal_warnings: no event entered its window today")
        return

    customers = (
        db.table("profiles").select("id").eq("role", "customer").eq("is_active", True)
        .execute().data or []
    )

    sent = 0
    for event in entering:
        weeks = seasonal.weeks_away(event, today)
        for customer in customers:
            # Only customers who actually carry something in the affected
            # categories. A warning about biscuits to a shop that sells none is
            # noise, and noise is how notifications get switched off.
            carried = (
                db.table("stock_items")
                .select("id, product_catalog!inner(category)")
                .eq("owner_id", customer["id"]).execute().data or []
            )
            if not any(seasonal.affects(event, i["product_catalog"]["category"]) for i in carried):
                continue
            notify.notify(
                customer["id"], "seasonal",
                f"{event.name} is {weeks} weeks away",
                f"{', '.join(event.affected_categories)} usually sell faster. "
                "Review your stock on the dashboard.",
            )
            sent += 1

    log.info("seasonal_warnings: %d event(s) entering, %d notification(s)", len(entering), sent)


def _yesterday(today: date) -> date:
    from datetime import timedelta
    return today - timedelta(days=1)
