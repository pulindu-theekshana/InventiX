"""
Listings logic

Purpose : Add, edit and deactivate listings, reduce quantity_available when an order is confirmed, and raise the low-availability warning.
Spec    : Section 10.1
Look here when : Available quantity does not drop after confirming, or a deactivated listing still appears in search.
"""

from ....core.exceptions import Conflict, NotFound
from .schemas import ListingIn, ListingOut, ListingPatch

SELECT = (
    "id, quantity_available, unit_price, min_order_quantity, lead_time_days, is_active, "
    "product_catalog!inner(id, name, category, pack_size, unit, barcode, is_seasonal, is_active)"
)

# Below this many units a listing is flagged low to its owner. A proportion of
# min_order_quantity would be neater but means nothing for a supplier who sets
# their minimum to 1; a flat figure is honest about being a rule of thumb.
LOW_AVAILABILITY = 25


def _to_out(row: dict) -> ListingOut:
    return ListingOut(
        id=row["id"],
        product=row["product_catalog"],
        quantity_available=row["quantity_available"],
        unit_price=float(row["unit_price"]),
        min_order_quantity=row["min_order_quantity"],
        lead_time_days=row["lead_time_days"],
        is_active=row["is_active"],
        is_low=row["quantity_available"] <= LOW_AVAILABILITY,
    )


def list_all(db, supplier_id: str) -> list[ListingOut]:
    rows = (
        db.table("supplier_listings").select(SELECT)
        .eq("supplier_id", supplier_id).execute().data or []
    )
    items = [_to_out(r) for r in rows]
    # Low first: this screen exists so a supplier knows what to restock.
    items.sort(key=lambda l: (not l.is_low, not l.is_active, l.product.name.lower()))
    return items


def get_one(db, supplier_id: str, listing_id: str) -> ListingOut:
    row = (
        db.table("supplier_listings").select(SELECT)
        .eq("supplier_id", supplier_id).eq("id", listing_id)
        .maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("We could not find that listing.")
    return _to_out(row.data)


def create(db, supplier_id: str, data: ListingIn) -> ListingOut:
    existing = (
        db.table("supplier_listings").select("id")
        .eq("supplier_id", supplier_id)
        .eq("catalog_product_id", data.catalog_product_id)
        .execute().data
    )
    if existing:
        raise Conflict("You already list that product. Edit the existing listing instead.")

    created = db.table("supplier_listings").insert(
        {"supplier_id": supplier_id, **data.model_dump()}
    ).execute()
    return get_one(db, supplier_id, created.data[0]["id"])


def update(db, supplier_id: str, listing_id: str, data: ListingPatch) -> None:
    get_one(db, supplier_id, listing_id)
    patch = data.model_dump(exclude_none=True)
    if not patch:
        return
    (db.table("supplier_listings").update(patch)
       .eq("id", listing_id).eq("supplier_id", supplier_id).execute())


def reduce_available(db, listing_id: str, quantity: int) -> None:
    """
    Called when an order is confirmed (spec 10.2), so a supplier is never shown
    as holding stock they have already committed.

    Reads then writes, which is a race if two orders are confirmed at the same
    instant. The check constraint on quantity_available refuses a negative
    result, so the worst case is a failed confirm rather than oversold stock.
    """
    row = (
        db.table("supplier_listings").select("quantity_available")
        .eq("id", listing_id).maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("That listing no longer exists.")
    remaining = row.data["quantity_available"] - quantity
    if remaining < 0:
        raise Conflict("That quantity is no longer available.")
    db.table("supplier_listings").update(
        {"quantity_available": remaining}
    ).eq("id", listing_id).execute()
