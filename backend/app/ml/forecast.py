"""
Demand forecast model

Purpose : Predicts units sold over coming weeks from sales_records. Built last, after real history exists.
Spec    : Section 7.2
Look here when : A forecast is implausible.
"""

# Spec 7.2 builds this last, and gives the reason plainly: a forecasting model
# needs history to learn from, and until the Stocks, Delivery and Suppliers feeds
# have been in use there is no sales_records data. Building it first would mean
# training on nothing.
#
# So this file is the interface, not the model. It reports honestly that it
# cannot answer rather than returning a number that looks like a prediction --
# a fabricated forecast is worse than none, because a shop owner would order
# against it.
#
# What lands here in phase 10: a per-product weekly demand model over
# sales_records, seasonally adjusted from seasonal_events. scikit-learn and numpy
# are commented out in requirements.txt and get uncommented at the same time.

MIN_WEEKS_OF_HISTORY = 8


def is_available() -> bool:
    """False until phase 10. Callers check this instead of catching an error."""
    return False


def weeks_of_history(sales_rows: list[dict]) -> int:
    """
    How much history a shop actually has. Used to tell the owner what is missing
    rather than showing an empty chart with no explanation.
    """
    dates = sorted({row["sale_date"] for row in sales_rows if row.get("sale_date")})
    if len(dates) < 2:
        return 0
    from datetime import date
    first, last = date.fromisoformat(dates[0]), date.fromisoformat(dates[-1])
    return max(0, (last - first).days // 7)


def predict(sales_rows: list[dict], weeks_ahead: int = 4) -> dict | None:
    """
    Returns None until there is enough history, which the Reports screen renders
    as "not enough data yet" with what is still needed.
    """
    if not is_available() or weeks_of_history(sales_rows) < MIN_WEEKS_OF_HISTORY:
        return None
    raise NotImplementedError("Demand forecasting is phase 10, spec 7.2.")
