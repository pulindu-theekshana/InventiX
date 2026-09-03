"""
Upload models

Purpose : Session, mapping and unmatched row shapes for the three upload steps.
Spec    : Section 6.6
Look here when : The mapping screen cannot read the columns.
"""

from pydantic import BaseModel


class ColumnMapping(BaseModel):
    product: str
    quantity: str
    date: str


class UploadSessionOut(BaseModel):
    id: str
    file_name: str
    status: str
    row_count: int
    unmatched_count: int
    columns: list[str]
    # Pre-filled from this shop's last upload, which is what makes mapping a
    # one-time cost rather than a chore on every upload (spec 6.6).
    suggested_mapping: dict[str, str | None]


class UnmatchedRowOut(BaseModel):
    pos_product_name: str
    # So the owner deals with the names that matter first.
    occurrences: int
    catalog_product_id: str | None = None


class ResolveUnmatchedIn(BaseModel):
    pos_product_name: str
    # None means skip this name for good.
    catalog_product_id: str | None = None


class ApplyResultOut(BaseModel):
    row_count: int
    unmatched_count: int
    reduced: int
    now_low: int
