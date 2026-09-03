"""
Auth request and response models

Purpose : Registration and profile shapes.
Spec    : Section 4.1
Look here when : Registration rejects a valid form.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProfileSetupIn(BaseModel):
    """
    Spec 4.1 steps 5 and 6. The role travels in the body but is written by the
    backend against the caller's own id -- see service.create_profile for why that
    is not the same as trusting it.
    """

    role: Literal["customer", "supplier"]
    business_name: str = Field(min_length=1, max_length=200)
    contact_person: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=40)
    whatsapp_number: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    delivery_areas: list[str] | None = None

    @field_validator("delivery_areas")
    @classmethod
    def areas_are_supplier_only(cls, v, info):
        # The database has the same check. Catching it here produces a message a
        # person can act on rather than a constraint violation.
        if v and info.data.get("role") == "customer":
            raise ValueError("Delivery areas are for supplier accounts only.")
        return v


class ProfileOut(BaseModel):
    """What the app stores as AuthProfile. Mirrors frontend/src/types/api.ts."""

    id: str
    role: str
    business_name: str
    contact_person: str
    email: str
    phone: str
