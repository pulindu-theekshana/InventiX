"""
Supplier orders endpoints

Purpose : HTTP layer for the permanent order record, including accept and reject.
Spec    : Section 10.2
Look here when : Confirm or Reject returns an error.
"""

from fastapi import APIRouter, status

from ....dependencies import SupplierDep
from . import service
from .schemas import RejectIn, SupplierOrderDetailOut, SupplierOrderSummaryOut

router = APIRouter(prefix="/supplier/orders", tags=["supplier: orders"])


@router.get("", response_model=list[SupplierOrderSummaryOut])
def list_orders(user: SupplierDep) -> list[SupplierOrderSummaryOut]:
    return service.list_orders(user.db, user.id)


@router.get("/{order_id}", response_model=SupplierOrderDetailOut)
def get_order(order_id: str, user: SupplierDep) -> SupplierOrderDetailOut:
    return service.get_order(user.db, user.id, order_id)


@router.post("/{order_id}/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_order(order_id: str, user: SupplierDep) -> None:
    service.confirm(user.db, user.id, order_id)


@router.post("/{order_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_order(order_id: str, body: RejectIn, user: SupplierDep) -> None:
    service.reject(user.db, user.id, order_id, body.reason)
