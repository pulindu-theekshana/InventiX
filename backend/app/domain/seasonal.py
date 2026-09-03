"""
Seasonal window rule

Purpose : The plain date comparison that decides which seasonal events are inside their lead time window, and the suggested order quantity from expected_uplift_pct. No machine learning here.
Spec    : Section 6.2
Look here when : A festival card appears too early, too late, or not at all.
"""

from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

# The shops are in Sri Lanka. date.today() reads the server's date, which on a
# UTC host is yesterday for the first five and a half hours of every Colombo day.
SHOP_TIMEZONE = ZoneInfo("Asia/Colombo")


def today() -> date:
    """Today where the shop is, not where the server is."""
    return datetime.now(SHOP_TIMEZONE).date()

# Roughly a month. Used only to turn lead_time_months into days for the comparison.
DAYS_PER_MONTH = 30


@dataclass(frozen=True)
class Event:
    id: str
    name: str
    event_date: date
    lead_time_months: int
    affected_categories: list[str]
    expected_uplift_pct: int


def is_in_window(event: Event, today: date) -> bool:
    """
    Spec 6.2, and it really is this simple: the gap between today and the event
    is within the lead time. It is a date comparison and it must stay one -- the
    learned version is a separate model in spec 7.2, and putting it here would
    mean the dashboard silently changing behaviour when that model lands.

    An event already past is not shown. Next year's date belongs in a new row.
    """
    if event.event_date < today:
        return False
    gap_days = (event.event_date - today).days
    return gap_days <= event.lead_time_months * DAYS_PER_MONTH


def weeks_away(event: Event, today: date) -> int:
    """What the card shows. Rounded up, so 'in 1 week' never means tomorrow."""
    return max(0, -(-(event.event_date - today).days // 7))


def affects(event: Event, category: str) -> bool:
    """Case-insensitive, because the catalog and the event list are seeded separately."""
    return category.strip().lower() in {c.strip().lower() for c in event.affected_categories}


def suggested_quantity(current_quantity: int, expected_uplift_pct: int) -> int:
    """
    Spec 6.2: current quantity raised by the expected uplift, rounded to something
    a person would actually order.

    Rounded to the nearest 5 above 20 -- suggesting 47 units of rice reads as
    false precision when the number came from a rough percentage.
    """
    raised = current_quantity * (1 + max(expected_uplift_pct, 0) / 100)
    if raised <= 20:
        return max(1, round(raised))
    return int(round(raised / 5) * 5)


def upcoming(events: list[Event], today: date) -> list[Event]:
    """Everything inside its window, soonest first."""
    return sorted(
        (e for e in events if is_in_window(e, today)),
        key=lambda e: e.event_date,
    )
