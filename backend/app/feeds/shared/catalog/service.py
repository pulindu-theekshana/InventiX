"""
Catalog logic

Purpose : Search across the shared product list, used by both roles.
Spec    : Section 5.2
Look here when : A product cannot be found, or a duplicate catalog entry appears.
"""

from ....core.supabase import service_client
from .schemas import CatalogProductOut

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
