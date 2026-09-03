"""
Learned threshold model

Purpose : Suggests a low_threshold from real sales velocity and supplier lead time.
Spec    : Section 7.2
Look here when : Suggested thresholds are wrong.
"""

# Spec 7.2. The non-learned version already exists and is in use:
# domain/thresholds.suggest_from_velocity computes a simple average of sales per
# day over a cover period. That is deliberately not machine learning, and spec
# 6.7 is explicit that it does not need to be.
#
# What this file adds in phase 10 is the part the average cannot do: accounting
# for variance, so a product that sells 5 a day every day gets a tighter
# threshold than one that sells 0 for six days and 30 on Sunday, even though
# both average the same.

from ..domain import thresholds


def is_available() -> bool:
    return False


def suggest(sales_rows: list[dict], lead_time_days: int) -> int | None:
    """
    Falls through to the simple average until the model exists, so the feature
    works from day one and improves later rather than being absent.
    """
    if not sales_rows:
        return None
    units = sum(r.get("quantity_sold", 0) for r in sales_rows)
    dates = {r["sale_date"] for r in sales_rows if r.get("sale_date")}
    return thresholds.suggest_from_velocity(units, len(dates), lead_time_days)
