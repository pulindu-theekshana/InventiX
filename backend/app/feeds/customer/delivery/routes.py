"""
Customer delivery endpoints

Purpose : HTTP layer for the customer Delivery feed and its actions.
Spec    : Section 8
Look here when : A delivery endpoint fails or an action button does nothing.
"""

from fastapi import APIRouter, status

from ....dependencies import CustomerDep
from . import service
from .schemas import AdvanceStageIn, OrderDetailOut, OrderSummaryOut, RateSupplierIn

router = APIRouter(prefix="/customer/delivery", tags=["customer: delivery"])


@router.get("", response_model=list[OrderSummaryOut])
def list_orders(user: CustomerDep) -> list[OrderSummaryOut]:
    """
    Every order, in any state. The app splits them into Requested and Confirmed
    (spec 8.1) and keeps rejected and cancelled on its history screen.
    """
    return service.list_orders(user.db, user.id)


@router.get("/{order_id}", response_model=OrderDetailOut)
def get_order(order_id: str, user: CustomerDep) -> OrderDetailOut:
    return service.get_order(user.db, user.id, order_id)


@router.post("/{order_id}/confirm-receipt", status_code=status.HTTP_204_NO_CONTENT)
def confirm_receipt(order_id: str, user: CustomerDep) -> None:
    service.confirm_receipt(user.db, user.id, order_id)


@router.post("/{order_id}/rating", status_code=status.HTTP_204_NO_CONTENT)
def rate_supplier(order_id: str, body: RateSupplierIn, user: CustomerDep) -> None:
    """Spec 12.3. One per order, and only once the order is complete."""
    service.rate(user.db, user.id, user.business_name, order_id, body.quality_score, body.comment)


@router.post("/{order_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
def cancel_order(order_id: str, user: CustomerDep) -> None:
    service.cancel(user.db, user.id, order_id)


@router.post("/{order_id}/advance", status_code=status.HTTP_204_NO_CONTENT)
def advance_stage(order_id: str, body: AdvanceStageIn, user: CustomerDep) -> None:
    service.advance(user.db, user.id, order_id, body.status)
