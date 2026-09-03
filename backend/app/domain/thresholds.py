"""
Low threshold defaults

Purpose : The default threshold offered for a new stock item and the sales-velocity suggestion once history exists. Simple average, not ML.
Spec    : Section 6.7
Look here when : A suggested threshold is obviously wrong.
"""

# A week of cover is the default horizon: long enough that a shop is not
# reordering constantly, short enough that a delivery arrives before the shelf
# empties. Spec 6.7 phrases it as "one week of typical demand".
DEFAULT_COVER_DAYS = 7


def default_threshold(quantity_on_hand: int) -> int:
    """
    Offered when a product is added and there is no sales history at all.

    Spec 6.7 is explicit that the owner must not be asked for a considered
    decision on every one of hundreds of products, so this exists to be accepted
    and moved past. A quarter of current stock is a guess, and it is labelled as
    one in the UI.
    """
    return max(round(quantity_on_hand * 0.25), 1)


def suggest_from_velocity(units_sold: int, days_of_history: int,
                          lead_time_days: int = 0) -> int | None:
    """
    Spec 6.7: once sales history exists, suggest a threshold from how fast the
    product actually sells. A simple average -- this is deliberately not machine
    learning, which is a separate model in spec 7.2.

    Covers a week of demand plus however long the supplier actually takes, so the
    reorder point accounts for the wait rather than assuming instant delivery.

    Returns None when there is not enough history to say anything honest.
    """
    if days_of_history < 14 or units_sold <= 0:
        return None

    per_day = units_sold / days_of_history
    cover = DEFAULT_COVER_DAYS + max(lead_time_days, 0)
    return max(round(per_day * cover), 1)
