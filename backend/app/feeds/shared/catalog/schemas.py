"""
Catalog models

Purpose : Product search result shape.
Spec    : Section 5.2
Look here when : The product picker shows the wrong fields.
"""

from pydantic import BaseModel


class CatalogProductOut(BaseModel):
    """Mirrors CatalogProduct in frontend/src/types/database.ts."""

    id: str
    name: str
    category: str
    pack_size: str
    unit: str
    barcode: str | None = None
    is_seasonal: bool
    is_active: bool
