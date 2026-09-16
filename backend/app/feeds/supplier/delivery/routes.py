"""
Supplier delivery endpoints

Purpose : HTTP layer for the in-flight working queue and stage advancement.
Spec    : Section 10.3
Look here when : A stage advance button returns an error.
"""

from fastapi import APIRouter, status

from ....dependencies import SupplierDep
from . import service
from .schemas import AdvanceIn, StageGroupOut

router = APIRouter(prefix="/supplier/delivery", tags=["supplier: delivery"])


@router.get("", response_model=list[StageGroupOut])
def get_queue(user: SupplierDep) -> list[StageGroupOut]:
    return service.queue(user.db, user.id)


@router.post("/{order_id}/advance", status_code=status.HTTP_204_NO_CONTENT)
def advance_stage(order_id: str, body: AdvanceIn, user: SupplierDep) -> None:
    service.advance(user.db, user.id, order_id, body.status)


@router.post("/{order_id}/delivered", status_code=status.HTTP_204_NO_CONTENT)
def mark_delivered(order_id: str, user: SupplierDep) -> None:
    """Records the claim and notifies. Does not complete the order (spec 11.3)."""
    service.mark_delivered(user.db, user.id, order_id)
