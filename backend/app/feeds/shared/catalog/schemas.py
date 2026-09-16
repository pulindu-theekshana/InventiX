"""
Catalog models

Purpose : Product search result shape.
Spec    : Section 5.2
Look here when : The product picker shows the wrong fields.
"""

from pydantic import BaseModel, Field


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


class NewCatalogProductIn(BaseModel):
    """A product the shop could not find. Unit defaults to what nearly every row already uses."""

    name: str = Field(min_length=2, max_length=80)
    pack_size: str = Field(min_length=1, max_length=30)
    category: str = Field(min_length=2, max_length=40)
    unit: str = Field(default="packet", min_length=1, max_length=20)
