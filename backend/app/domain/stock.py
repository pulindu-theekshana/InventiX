"""
Stock movement rules

Purpose : Applies every quantity change and writes the matching stock_adjustments row. Also decides what counts as low stock. No other file may change a quantity directly.
Spec    : Section 6.6 and 5.10
Look here when : A quantity is wrong, an item does not become low when it should, or a change has no audit row.
"""

from ..core.exceptions import ValidationFailed

IN_STOCK = "in_stock"
LOW_STOCK = "low_stock"
RESTOCK_REQUESTED = "restock_requested"

# Spec 5.10. sales_upload and order_received are written by the system; the other
# three are the only reasons a person may give.
SYSTEM_REASONS = frozenset({"sales_upload", "order_received"})
MANUAL_REASONS = frozenset({"manual", "damage", "correction"})
ALL_REASONS = SYSTEM_REASONS | MANUAL_REASONS


def classify(quantity_on_hand: int, low_threshold: int, restock_requested: bool) -> str:
    """
    Spec 6.2, and the only definition of these three states anywhere.

    The pie chart and both list sections read the result of this function. If the
    chart counted separately it could say four items are low while the list below
    shows three, and both would look correct in isolation.
    """
    if quantity_on_hand > low_threshold:
        return IN_STOCK
    return RESTOCK_REQUESTED if restock_requested else LOW_STOCK


def is_low(quantity_on_hand: int, low_threshold: int) -> bool:
    """At or below, not below. Spec 5.4 says 'at or below this quantity'."""
    return quantity_on_hand <= low_threshold


def urgency(quantity_on_hand: int, low_threshold: int) -> float:
    """
    Spec 6.4 sorts the Low stock section by how far below threshold an item is,
    as a proportion rather than an absolute -- 2 of 10 is more urgent than 40 of 50.
    Higher is more urgent.
    """
    if low_threshold <= 0:
        return 0.0
    return max(0.0, (low_threshold - quantity_on_hand) / low_threshold)


def suggested_order_quantity(quantity_on_hand: int, low_threshold: int) -> int:
    """
    What the restock popup pre-fills. Enough to clear the threshold with headroom,
    rather than the bare minimum that would put the item straight back into Low
    stock after two days.
    """
    return max(low_threshold * 2 - quantity_on_hand, 1)


def validate_adjustment(quantity_on_hand: int, change: int, reason: str) -> int:
    """
    Checks a movement before it is applied and returns the resulting quantity.

    The database enforces both of these again -- apply_stock_adjustment() raises
    on a negative result and stock_adjustments has a check constraint on reason.
    Checking here as well is what lets the message name the product and the
    numbers, which a constraint violation never can.
    """
    if change == 0:
        raise ValidationFailed("An adjustment of zero would not change anything.")
    if reason not in ALL_REASONS:
        raise ValidationFailed(f"'{reason}' is not a reason we record.")

    result = quantity_on_hand + change
    if result < 0:
        raise ValidationFailed(
            f"You only have {quantity_on_hand}, so you cannot remove {abs(change)}."
        )
    return result


def apply(db, stock_item_id: str, change: int, reason: str, actor_id: str,
          source_id: str | None = None) -> int:
    """
    The only way a quantity changes anywhere in this application.

    Calls the SQL function rather than doing an update and an insert, because
    between two statements a process can crash and leave a quantity with no
    audit row -- the exact situation spec 5.10 exists to prevent. In the function
    both happen or neither does.

    Returns the new quantity.
    """
    result = db.rpc(
        "apply_stock_adjustment",
        {
            "p_stock_item_id": stock_item_id,
            "p_change": change,
            "p_reason": reason,
            "p_source_id": source_id,
            "p_created_by": actor_id,
        },
    ).execute()
    return result.data
