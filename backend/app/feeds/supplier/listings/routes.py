"""
Supplier stocks endpoints

Purpose : HTTP layer for the supplier Stocks feed, which is their own product listings.
Spec    : Section 10.1
Look here when : A listing endpoint fails.
"""

from fastapi import APIRouter, status

from ....dependencies import SupplierDep
from . import service
from .schemas import ListingIn, ListingOut, ListingPatch

router = APIRouter(prefix="/supplier/listings", tags=["supplier: listings"])


@router.get("", response_model=list[ListingOut])
async def list_listings(user: SupplierDep) -> list[ListingOut]:
    return service.list_all(user.db, user.id)


@router.get("/{listing_id}", response_model=ListingOut)
async def get_listing(listing_id: str, user: SupplierDep) -> ListingOut:
    return service.get_one(user.db, user.id, listing_id)


@router.post("", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
async def create_listing(body: ListingIn, user: SupplierDep) -> ListingOut:
    return service.create(user.db, user.id, body)


@router.patch("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_listing(listing_id: str, body: ListingPatch, user: SupplierDep) -> None:
    service.update(user.db, user.id, listing_id, body)
