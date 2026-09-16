"""
Catalog logic

Purpose : Search across the shared product list, used by both roles.
Spec    : Section 5.2
Look here when : A product cannot be found, or a duplicate catalog entry appears.
"""

from ....core.exceptions import Conflict, ValidationFailed
from ....core.supabase import service_client
from .schemas import CatalogProductOut, NewCatalogProductIn

COLUMNS = "id, name, category, pack_size, unit, barcode, is_seasonal, is_active"

# The picker screens open with no query and expect the list to be usable, but the
# catalog will grow well past a screenful.
DEFAULT_LIMIT = 50


def search(query: str, limit: int = DEFAULT_LIMIT) -> list[CatalogProductOut]:
    """
    Spec 5.2: both customers and suppliers search this same table, which is the
    entire reason a shop's item and a supplier's listing can ever be matched.

    Only active rows. A retired product must not be addable to new stock or new
    listings, but the rows already pointing at it keep working.
    """
    request = (
        service_client()
        .table("product_catalog")
        .select(COLUMNS)
        .eq("is_active", True)
        .order("name")
        .limit(limit)
    )

    text = query.strip()
    if text:
        # Matches name or category, case-insensitively. Searching "dairy" finding
        # the milk powders is worth the extra column.
        request = request.or_(f"name.ilike.%{text}%,category.ilike.%{text}%")

    return [CatalogProductOut(**row) for row in (request.execute().data or [])]


def _tidy(value: str) -> str:
    return " ".join(value.split())


def create(data: NewCatalogProductIn) -> CatalogProductOut:
    """
    Adds a product nobody has entered yet. Insert only: an existing row is never
    edited, so no user can rename a product out from under other shops.

    Spec 5.2 needs one row per product, so "white sugar / 1 KG" typed by a second
    shop returns the row the first shop made instead of creating a near-duplicate.
    """
    name, pack_size = _tidy(data.name), _tidy(data.pack_size)
    # Seasonal warnings match on the exact category string, so "Biscuit" would never
    # match a festival set up for "Biscuits". Only an existing category is accepted.
    category = {c.lower(): c for c in categories()}.get(_tidy(data.category).lower())
    if not category:
        raise ValidationFailed("Choose one of the existing categories.")
    table = service_client().table("product_catalog")

    # ilike narrows; the exact case-insensitive comparison is done here, because
    # a % or _ in a product name would act as a wildcard.
    candidates = table.select(COLUMNS).ilike("name", name).execute().data or []
    for row in candidates:
        if row["name"].lower() == name.lower() and row["pack_size"].lower() == pack_size.lower():
            if not row["is_active"]:
                raise Conflict(f"{row['name']} {row['pack_size']} has been retired from the catalog.")
            return CatalogProductOut(**row)

    created = table.insert({
        "name": name,
        "pack_size": pack_size,
        "category": category,
        "unit": _tidy(data.unit).lower(),
    }).execute()
    return CatalogProductOut(**created.data[0])


def categories() -> list[str]:
    """Every category in use, for the new-product picker."""
    # ponytail: pulls one column per row and dedupes here; a distinct view if the catalog passes PostgREST's row cap.
    rows = (service_client().table("product_catalog").select("category")
            .eq("is_active", True).execute().data or [])
    return sorted({r["category"] for r in rows})
