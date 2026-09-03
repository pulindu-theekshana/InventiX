"""
Supplier delivery logic

Purpose : Returns only in-flight orders grouped by stage, and advances stages through the state machine. Records supplier_marked_delivered_at without changing status.
Spec    : Section 10.3 and 11.3
Look here when : Marking delivered wrongly completes the order, or an order is missing from the queue.
"""

from datetime import UTC, datetime

from ....domain import order_state_machine as sm
from ...shared.notifications import service as notify
from ..orders.service import SELECT, _get_row, _summary
from .schemas import StageGroupOut

LABELS = {
    sm.CONFIRMED: ("Confirmed", "Move to Processing"),
    sm.PROCESSING: ("Processing", "Put to delivery"),
    sm.PUT_TO_DELIVERY: ("Put to delivery", "Mark on the way"),
    sm.ON_THE_WAY: ("On the way", "Mark as delivered"),
}


def queue(db, supplier_id: str) -> list[StageGroupOut]:
    """
    Spec 10.3: only what is in flight, grouped by stage, most urgent first.

    Orders leave the moment they are complete, rejected or cancelled, and stay
    permanently in the Orders feed -- which is why an order never vanishes from
    where the supplier expects to find it.
    """
    rows = (
        db.table("orders").select(SELECT)
        .eq("supplier_id", supplier_id)
        .in_("status", list(sm.SUPPLIER_QUEUE))
        .execute().data or []
    )
    orders = [_summary(r) for r in rows]

    groups: list[StageGroupOut] = []
    for stage in sm.SUPPLIER_QUEUE:
        label, action = LABELS[stage]
        in_stage = [o for o in orders if o.status == stage]
        if not in_stage:
            continue
        # Sorted by the date the customer asked for, so the most urgent is first.
        in_stage.sort(key=lambda o: o.requested_delivery_date or "9999-12-31")
        groups.append(StageGroupOut(
            stage=stage, label=label, next_stage=sm.next_stage(stage),
            action=action, orders=in_stage,
        ))
    return groups


def advance(db, supplier_id: str, order_id: str, target: str) -> None:
    """Spec 10.3, validated by the same state machine the customer side uses."""
    row = _get_row(db, supplier_id, order_id)
    sm.assert_transition(row["status"], target, "supplier")

    patch = {"status": target}
    column = sm.TIMESTAMP_COLUMN.get(target)
    if column:
        patch[column] = datetime.now(UTC).isoformat()
    db.table("orders").update(patch).eq("id", order_id).execute()

    notify.notify(
        row["customer_id"], "stage_change",
        f"{row['reference']} is now {target.replace('_', ' ')}",
        "Your order has moved to the next stage.", order_id=order_id,
    )


def mark_delivered(db, supplier_id: str, order_id: str) -> None:
    """
    Spec 11.3, and the reasoning matters more than the code.

    This records a timestamp and notifies the customer. It does NOT change the
    status: the order stays on_the_way until the customer confirms receipt.

    Adding a seventh visible stage for "delivered, awaiting confirmation" would
    make the pipeline longer than a shop owner wants to read, and letting the
    supplier set purchased directly would mean stock rising on a claim rather
    than a fact -- and their own delivery speed being self-reported.
    """
    row = _get_row(db, supplier_id, order_id)
    if row["status"] != sm.ON_THE_WAY:
        from ....core.exceptions import InvalidTransition
        raise InvalidTransition("Only an order that is on the way can be marked delivered.")

    db.table("orders").update({
        "supplier_marked_delivered_at": datetime.now(UTC).isoformat()
    }).eq("id", order_id).execute()

    notify.notify(
        row["customer_id"], "supplier_delivered",
        f"{row['reference']} has been delivered",
        "Confirm receipt so your stock is topped up.", order_id=order_id,
    )
