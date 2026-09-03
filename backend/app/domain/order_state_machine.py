"""
Order state machine

Purpose : THE single definition of order states and which transitions are legal, plus who is allowed to make each one. Every status change in the whole system passes through this file.
Spec    : Section 11.1 and 11.2
Look here when : An order moves to a state it should not, a legal transition is refused, or a supplier changes something only a customer may change.
"""

from ..core.exceptions import Forbidden, InvalidTransition

# Spec 11.1. The eight states, mirrored by frontend/src/types/orderStatus.ts and
# constrained again by a check on the orders table.
REQUESTED = "requested"
REJECTED = "rejected"
CANCELLED = "cancelled"
CONFIRMED = "confirmed"
PROCESSING = "processing"
PUT_TO_DELIVERY = "put_to_delivery"
ON_THE_WAY = "on_the_way"
PURCHASED = "purchased"

ALL_STATES = frozenset({
    REQUESTED, REJECTED, CANCELLED, CONFIRMED,
    PROCESSING, PUT_TO_DELIVERY, ON_THE_WAY, PURCHASED,
})

TERMINAL = frozenset({REJECTED, CANCELLED, PURCHASED})

# Spec 11.2, exactly as written. Anything not in this table is illegal, including
# skipping a stage forward, going backwards, and leaving a terminal state.
ALLOWED: dict[str, frozenset[str]] = {
    REQUESTED: frozenset({CONFIRMED, REJECTED, CANCELLED}),
    CONFIRMED: frozenset({PROCESSING, CANCELLED}),
    PROCESSING: frozenset({PUT_TO_DELIVERY}),
    PUT_TO_DELIVERY: frozenset({ON_THE_WAY}),
    ON_THE_WAY: frozenset({PURCHASED}),
    REJECTED: frozenset(),
    CANCELLED: frozenset(),
    PURCHASED: frozenset(),
}

# Who may make each transition. Spec 11.1 assigns every state an owner, and 10.4
# is explicit that a supplier may never set purchased -- stock would then rise on
# a claim rather than a fact, and delivery speed would be self-reported.
ACTOR: dict[str, str] = {
    CONFIRMED: "supplier",
    REJECTED: "supplier",
    PROCESSING: "supplier",
    PUT_TO_DELIVERY: "supplier",
    ON_THE_WAY: "supplier",
    CANCELLED: "customer",
    PURCHASED: "customer",
}

# The stage timestamp each state writes, so a caller never has to remember.
TIMESTAMP_COLUMN: dict[str, str] = {
    CONFIRMED: "confirmed_at",
    REJECTED: "rejected_at",
    CANCELLED: "cancelled_at",
    PROCESSING: "processing_at",
    PUT_TO_DELIVERY: "put_to_delivery_at",
    ON_THE_WAY: "on_the_way_at",
    PURCHASED: "purchased_at",
}

# Spec 8.1: the customer Delivery feed has two sections, not three.
CUSTOMER_REQUESTED = (REQUESTED,)
CUSTOMER_CONFIRMED = (CONFIRMED, PROCESSING, PUT_TO_DELIVERY, ON_THE_WAY, PURCHASED)

# Spec 10.2: the supplier Orders feed has three.
SUPPLIER_PENDING = (REQUESTED,)
SUPPLIER_ACTIVE = (CONFIRMED, PROCESSING, PUT_TO_DELIVERY, ON_THE_WAY)
SUPPLIER_HISTORY = (PURCHASED, REJECTED, CANCELLED)

# Spec 10.3: the supplier Delivery queue holds only what is in flight.
SUPPLIER_QUEUE = SUPPLIER_ACTIVE


def is_terminal(status: str) -> bool:
    return status in TERMINAL


def can_transition(current: str, target: str) -> bool:
    return target in ALLOWED.get(current, frozenset())


def assert_transition(current: str, target: str, actor_role: str, *, manual: bool = False) -> None:
    """
    The single gate every status change passes through. Raises rather than
    returning a bool, so a caller cannot forget to check the answer.

    `manual` is spec 8.3: an order sent by WhatsApp or email is updated by the
    supplier outside the app, so the customer advances it themselves. The
    transition must still be legal -- they may not skip a stage -- only the actor
    check is relaxed.
    """
    if current not in ALL_STATES:
        raise InvalidTransition(f"'{current}' is not a known order status.")
    if target not in ALL_STATES:
        raise InvalidTransition(f"'{target}' is not a known order status.")

    if is_terminal(current):
        raise InvalidTransition(
            f"This order is already {current} and cannot change again."
        )

    if not can_transition(current, target):
        raise InvalidTransition(
            f"An order cannot go from {current.replace('_', ' ')} "
            f"to {target.replace('_', ' ')}."
        )

    expected = ACTOR.get(target)
    if manual and expected == "supplier":
        # The customer is standing in for a supplier who is not on InventiX.
        return
    if expected and expected != actor_role:
        raise Forbidden(f"Only the {expected} can move an order to {target.replace('_', ' ')}.")


def next_stage(current: str) -> str | None:
    """
    The single forward step a supplier's Delivery card offers. on_the_way returns
    None because marking delivered records a timestamp without changing status
    (spec 11.3) -- the order waits for the customer.
    """
    forward = {
        CONFIRMED: PROCESSING,
        PROCESSING: PUT_TO_DELIVERY,
        PUT_TO_DELIVERY: ON_THE_WAY,
    }
    return forward.get(current)
