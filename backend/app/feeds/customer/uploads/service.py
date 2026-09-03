"""
Upload logic

Purpose : Orchestrates the three upload steps and owns the duplicate check. Parsing, matching and applying live in their own files because they fail in three different ways.
Spec    : Section 6.6
Look here when : An upload gets stuck in a status, or a duplicate file is not rejected.
"""

import json

from ....core.exceptions import Conflict, NotFound, ValidationFailed
from . import applier, mapping, parser
from .schemas import ApplyResultOut, ColumnMapping, UnmatchedRowOut, UploadSessionOut

# The parsed rows for an in-progress upload. The file is read once at step one
# and the mapping and unmatched screens work against this rather than re-reading.
_pending: dict[str, list[dict]] = {}


def start(db, customer_id: str, filename: str, content: bytes) -> UploadSessionOut:
    """
    Spec 6.6 steps 17 and 18. The duplicate check is the whole reason the hash
    exists: applying the same report twice would decrement stock twice, and
    nothing downstream could tell that had happened.
    """
    parsed = parser.parse(content, filename)

    duplicate = (
        db.table("sales_uploads").select("id, file_name, applied_at")
        .eq("customer_id", customer_id).eq("file_hash", parsed.file_hash)
        .maybe_single().execute()
    )
    if duplicate and duplicate.data:
        raise Conflict(
            f"This report has already been uploaded as '{duplicate.data['file_name']}'. "
            "Uploading it again would reduce your stock a second time."
        )

    previous = (
        db.table("sales_uploads").select("column_mapping")
        .eq("customer_id", customer_id).eq("status", "applied")
        .order("created_at", desc=True).limit(1).execute().data
    )
    remembered = (previous[0].get("column_mapping") if previous else None) or {}
    suggested = mapping.guess_mapping(parsed.columns)
    for field in ("product", "quantity", "date"):
        # A remembered choice beats a guess, but only if that column still exists.
        if remembered.get(field) in parsed.columns:
            suggested[field] = remembered[field]

    created = db.table("sales_uploads").insert({
        "customer_id": customer_id, "file_name": filename,
        "file_hash": parsed.file_hash, "status": "needs_mapping",
        "row_count": len(parsed.rows),
    }).execute()

    upload_id = created.data[0]["id"]
    _pending[upload_id] = parsed.rows

    return UploadSessionOut(
        id=upload_id, file_name=filename, status="needs_mapping",
        row_count=len(parsed.rows), unmatched_count=0,
        columns=parsed.columns, suggested_mapping=suggested,
    )


def _get_upload(db, customer_id: str, upload_id: str) -> dict:
    row = (
        db.table("sales_uploads").select("*")
        .eq("id", upload_id).eq("customer_id", customer_id)
        .maybe_single().execute()
    )
    if not row or not row.data:
        raise NotFound("We could not find that upload.")
    return row.data


def _rows_for(upload_id: str) -> list[dict]:
    rows = _pending.get(upload_id)
    if rows is None:
        # ponytail: parsed rows are held in memory, so a restart between steps
        # loses them and the owner uploads again. Storing the file in Supabase
        # Storage would survive that; not worth it until uploads are common.
        raise ValidationFailed(
            "That upload has expired. Please choose the file again."
        )
    return rows


def save_mapping(db, customer_id: str, upload_id: str, column_map: ColumnMapping) -> None:
    upload = _get_upload(db, customer_id, upload_id)
    if upload["status"] == "applied":
        raise Conflict("That upload has already been applied.")
    db.table("sales_uploads").update(
        {"column_mapping": json.loads(column_map.model_dump_json())}
    ).eq("id", upload_id).execute()


def unmatched(db, customer_id: str, upload_id: str) -> list[UnmatchedRowOut]:
    upload = _get_upload(db, customer_id, upload_id)
    column_map = upload.get("column_mapping") or {}
    if not column_map.get("product"):
        raise ValidationFailed("Choose which column holds the product name first.")

    aliases = mapping.load_aliases(db, customer_id)
    rows = mapping.unmatched_summary(_rows_for(upload_id), aliases, column_map["product"])
    db.table("sales_uploads").update({"unmatched_count": len(rows)}).eq("id", upload_id).execute()
    return [UnmatchedRowOut(**row) for row in rows]


def resolve(db, customer_id: str, upload_id: str, pos_name: str,
            catalog_product_id: str | None) -> None:
    _get_upload(db, customer_id, upload_id)
    if catalog_product_id:
        mapping.save_alias(db, customer_id, pos_name, catalog_product_id)


def apply(db, customer_id: str, upload_id: str) -> ApplyResultOut:
    upload = _get_upload(db, customer_id, upload_id)
    if upload["status"] == "applied":
        raise Conflict("That upload has already been applied.")

    column_map = upload.get("column_mapping") or {}
    if not all(column_map.get(f) for f in ("product", "quantity", "date")):
        raise ValidationFailed("Match all three columns before applying.")

    result = applier.apply(db, customer_id, upload, _rows_for(upload_id), column_map)
    _pending.pop(upload_id, None)
    return ApplyResultOut(**result)
