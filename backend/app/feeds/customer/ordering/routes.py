"""
Restock popup endpoints

Purpose : HTTP layer for generating a restock message, validating it, and sending it on a chosen channel.
Spec    : Section 6.5
Look here when : The popup cannot load, or Send returns an error.
"""

from typing import Annotated

from fastapi import APIRouter, Header, status

from ....core.exceptions import ValidationFailed
from ....dependencies import CustomerDep
from . import service
from .schemas import GenerateMessageIn, GenerateMessageOut, SendOrderIn, SendOrderOut

router = APIRouter(prefix="/customer/ordering", tags=["customer: ordering"])


def _customer(user) -> dict:
    return {"id": user.id, "business_name": user.business_name, "address": None}


@router.post("/message", response_model=GenerateMessageOut)
async def generate_message(body: GenerateMessageIn, user: CustomerDep) -> GenerateMessageOut:
    return service.generate_message(user.db, _customer(user), body.supplier_id, body.lines)


@router.post("/send", response_model=SendOrderOut, status_code=status.HTTP_201_CREATED)
async def send_order(
    body: SendOrderIn,
    user: CustomerDep,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> SendOrderOut:
    """
    Spec 15.4 makes the key required, not optional. Without one a retry creates a
    second order, so refusing is safer than accepting and hoping.
    """
    if not idempotency_key:
        raise ValidationFailed("This request is missing its Idempotency-Key header.")
    return service.send(user.db, _customer(user), body, idempotency_key)
