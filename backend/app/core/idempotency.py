"""
Idempotency keys

Purpose : Stores and checks request keys so a repeated send on a poor connection creates only one order.
Spec    : Section 15.4
Look here when : A customer taps Send once but two orders appear.
"""

from .exceptions import Conflict


def find_existing_order(db, customer_id: str, key: str) -> str | None:
    """
    Returns the order this key already created, if any.

    There is no separate keys table. orders.idempotency_key is nullable and
    unique, so the key lives on the row it protects -- one fewer table, one fewer
    thing to clean up, and the guarantee is enforced by the database rather than
    by remembering to check. See D-007.
    """
    if not key:
        return None
    result = (
        db.table("orders")
        .select("id")
        .eq("customer_id", customer_id)
        .eq("idempotency_key", key)
        .maybe_single()
        .execute()
    )
    return result.data["id"] if result and result.data else None


def claim(db, customer_id: str, key: str) -> str | None:
    """
    Called before creating an order. Returns an existing order id to replay, or
    None to proceed.

    Two identical requests arriving at once both see None and both insert. The
    unique constraint makes one fail, and the caller catches that and replays --
    which is why the constraint matters more than this check does. This one just
    avoids the round trip in the common case.
    """
    return find_existing_order(db, customer_id, key)


def resolve_duplicate(db, customer_id: str, key: str) -> str:
    """
    Called when an insert fails on the unique constraint. The other request won;
    return its order so the user sees one order rather than an error.
    """
    order_id = find_existing_order(db, customer_id, key)
    if not order_id:
        raise Conflict("That order could not be completed. Please try again.")
    return order_id
