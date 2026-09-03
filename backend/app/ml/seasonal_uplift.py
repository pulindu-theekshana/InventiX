"""
Learned seasonal uplift

Purpose : Learns this shop's actual festival uplift, replacing the fixed expected_uplift_pct.
Spec    : Section 7.2
Look here when : Seasonal suggestions are far off.
"""

# Spec 7.2. Today domain/seasonal.suggested_quantity uses the fixed
# expected_uplift_pct on the seasonal_events row -- one number for every shop.
#
# That is wrong in an obvious way: a shop in Jaffna and a shop in Galle do not
# see the same Christmas. What lands here in phase 10 compares each shop's own
# sales_records around past festival dates against its baseline, and returns a
# per-shop uplift.
#
# It needs at least one full cycle of the festival in question to say anything,
# which is why it cannot exist yet -- the application has not been running for a
# year.

MIN_PAST_OCCURRENCES = 1


def is_available() -> bool:
    return False


def learned_uplift(customer_id: str, event_name: str, sales_rows: list[dict]) -> int | None:
    """
    Returns None until this shop has lived through the festival at least once.
    domain/seasonal then falls back to the seeded estimate, which is honest about
    being an estimate.
    """
    return None
