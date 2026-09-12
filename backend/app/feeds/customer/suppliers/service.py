"""
Suppliers logic

Purpose : Company and product search, the profile, and the ranking order. Ranking comes from domain/ranking.py and the stored score; this file only assembles.
Spec    : Section 9
Look here when : The wrong suppliers appear, or measured delivery time looks wrong.
"""

from ....core.exceptions import NotFound
from ....domain import config_store, ranking
from ...supplier.listings.service import _to_out as listing_to_out
from .schemas import ListingSummaryOut, SupplierOut, SupplierProfileOut

PUBLIC = "id, business_name, city, is_active"
RANK = "supplier_ranking(score, average_rating, rating_count, measured_delivery_days, completed_orders, is_new_supplier)"


def _merge(profile: dict) -> SupplierOut:
    rank_row = profile.get("supplier_ranking") or {}
    if isinstance(rank_row, list):
        rank_row = rank_row[0] if rank_row else {}
    return SupplierOut(
        id=profile["id"],
        business_name=profile["business_name"],
        city=profile.get("city"),
        is_active=profile["is_active"],
        score=rank_row.get("score"),
        average_rating=rank_row.get("average_rating"),
        rating_count=rank_row.get("rating_count") or 0,
        measured_delivery_days=rank_row.get("measured_delivery_days"),
        is_new_supplier=rank_row.get("is_new_supplier", True),
    )


def search_by_company(db, query: str) -> list[SupplierOut]:
    """Spec 9.1 second search type. Results open a profile."""
    request = (
        db.table("profiles").select(f"{PUBLIC}, {RANK}")
        .eq("role", "supplier").order("business_name").limit(50)
    )
    text = query.strip()
    if text:
        request = request.ilike("business_name", f"%{text}%")
    return [_merge(row) for row in (request.execute().data or [])]


def search_by_product(db, catalog_product_id: str, requested_quantity: int = 0) -> list[SupplierOut]:
    """
    Spec 9.1 first search type: the suppliers with an active listing for that
    product, in ranking order.

    The stored score covers quality and measured delivery. Availability and price
    depend on this particular order, so they are applied here -- which is why a
    supplier can rank second for rice and fifth for sugar.
    """
    rows = (
        db.table("supplier_listings")
        .select(f"unit_price, quantity_available, lead_time_days, min_order_quantity, "
                f"profiles!inner({PUBLIC}, {RANK})")
        .eq("catalog_product_id", catalog_product_id)
        .eq("is_active", True)
        .execute().data or []
    )
    rows = [r for r in rows if r["profiles"].get("is_active")]
    if not rows:
        return []

    by_id: dict[str, tuple[SupplierOut, dict]] = {}
    candidates: list[ranking.Candidate] = []
    for row in rows:
        out = _merge(row["profiles"])
        out.listing = ListingSummaryOut(
            unit_price=float(row["unit_price"]),
            quantity_available=row["quantity_available"],
            lead_time_days=row["lead_time_days"],
            min_order_quantity=row["min_order_quantity"],
        )
        # Spec 9.3: marked, not hidden.
        if requested_quantity:
            out.can_meet_quantity = row["quantity_available"] >= requested_quantity
        by_id[out.id] = (out, row)
        candidates.append(ranking.Candidate(
            supplier_id=out.id,
            average_rating=out.average_rating,
            rating_count=out.rating_count,
            measured_delivery_days=out.measured_delivery_days,
            completed_orders=0,
            unit_price=float(row["unit_price"]),
            quantity_available=row["quantity_available"],
        ))

    weights = config_store.ranking_weights(db)
    ordered = ranking.rank(candidates, weights, requested_quantity=requested_quantity)
    return [by_id[c.supplier_id][0] for c, _score in ordered]


def get_profile(db, supplier_id: str, viewer_id: str) -> SupplierProfileOut:
    """Spec 9.2. Public business fields only, and the viewer's own order history."""
    row = (
        db.table("profiles")
        .select(f"{PUBLIC}, contact_person, phone, whatsapp_number, email, address, "
                f"delivery_areas, {RANK}")
        .eq("id", supplier_id).eq("role", "supplier").maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("We could not find that supplier.")

    base = _merge(row.data)

    listings = (
        db.table("supplier_listings")
        .select("id, quantity_available, unit_price, min_order_quantity, lead_time_days, "
                "is_active, product_catalog!inner(*)")
        .eq("supplier_id", supplier_id).eq("is_active", True)
        .execute().data or []
    )

    # Scoped to the viewer: a customer must never see another shop's orders.
    # The value is summed from the items, the same way delivery/service.py does it:
    # orders carries no total column, because a stored total can disagree with its lines.
    history = (
        db.table("orders")
        .select("id, reference, status, requested_at, "
                "order_items(quantity_requested, unit_price_at_order)")
        .eq("supplier_id", supplier_id).eq("customer_id", viewer_id)
        .order("requested_at", desc=True).limit(20)
        .execute().data or []
    )

    return SupplierProfileOut(
        **base.model_dump(),
        contact_person=row.data["contact_person"],
        phone=row.data["phone"],
        whatsapp_number=row.data.get("whatsapp_number"),
        email=row.data["email"],
        address=row.data.get("address"),
        delivery_areas=row.data.get("delivery_areas"),
        listings=[listing_to_out(l) for l in listings],
        order_history=[
            {
                "id": o["id"],
                "reference": o["reference"],
                "status": o["status"],
                "requested_at": o["requested_at"],
                "total_value": sum(
                    i["quantity_requested"] * float(i["unit_price_at_order"])
                    for i in (o.get("order_items") or [])
                ),
            }
            for o in history
        ],
    )
