"""
Upload endpoints

Purpose : HTTP layer for the three upload steps.
Spec    : Section 6.6
Look here when : An upload step returns an error.
"""

from fastapi import APIRouter, File, UploadFile, status

from ....dependencies import CustomerDep
from . import service
from .schemas import (
    ApplyResultOut,
    ColumnMapping,
    ResolveUnmatchedIn,
    UnmatchedRowOut,
    UploadSessionOut,
)

router = APIRouter(prefix="/customer/uploads", tags=["customer: uploads"])


@router.post("", response_model=UploadSessionOut, status_code=status.HTTP_201_CREATED)
def start_upload(user: CustomerDep, file: UploadFile = File(...)) -> UploadSessionOut:  # noqa: B008 - FastAPI's documented idiom
    """
    Step one. Takes the actual file, not just its name: the backend hashes the
    contents to reject a duplicate, so it needs the contents (spec 15.4).
    """
    content = file.file.read()
    return service.start(user.db, user.id, file.filename or "upload.csv", content)


@router.post("/{upload_id}/mapping", status_code=status.HTTP_204_NO_CONTENT)
def save_mapping(upload_id: str, body: ColumnMapping, user: CustomerDep) -> None:
    """Step two. Remembered and pre-filled on the next upload."""
    service.save_mapping(user.db, user.id, upload_id, body)


@router.get("/{upload_id}/unmatched", response_model=list[UnmatchedRowOut])
def list_unmatched(upload_id: str, user: CustomerDep) -> list[UnmatchedRowOut]:
    return service.unmatched(user.db, user.id, upload_id)


@router.post("/{upload_id}/unmatched", status_code=status.HTTP_204_NO_CONTENT)
def resolve_unmatched(
    upload_id: str, body: ResolveUnmatchedIn, user: CustomerDep
) -> None:
    """Step three. The choice becomes an alias and is reused forever after."""
    service.resolve(user.db, user.id, upload_id, body.pos_product_name, body.catalog_product_id)


@router.post("/{upload_id}/apply", response_model=ApplyResultOut)
def apply_upload(upload_id: str, user: CustomerDep) -> ApplyResultOut:
    return service.apply(user.db, user.id, upload_id)
