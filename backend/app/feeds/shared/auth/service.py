"""
Auth logic

Purpose : Reads and writes the profile row, which is the only part of authentication the backend owns. Sessions themselves go straight from the app to Supabase.
Spec    : Section 4.1 and 4.2
Look here when : A user has the wrong role, or role fields are missing after registration.
"""

from ....core.exceptions import Conflict, NotFound
from ....core.supabase import service_client
from .schemas import ProfileOut, ProfileSetupIn

COLUMNS = "id, role, business_name, contact_person, email, phone"


def create_profile(user_id: str, email: str, data: ProfileSetupIn) -> ProfileOut:
    """
    Spec 4.2 and 15.2. Two things make this endpoint meaningful rather than
    decorative:

    1. `id` comes from the verified token, never from the request. A client that
       could choose its own profile id could overwrite someone else's row.
    2. It runs with the service key, because policies/profiles.sql has no insert
       policy at all -- the client is refused outright. That absence is what
       forces registration through here, where the role is set once and cannot
       later be changed by the user.
    """
    db = service_client()

    existing = db.table("profiles").select("id").eq("id", user_id).execute()
    if existing.data:
        raise Conflict("This account already has a profile.")

    row = {
        "id": user_id,
        "email": email,
        "role": data.role,
        "business_name": data.business_name,
        "contact_person": data.contact_person,
        "phone": data.phone,
        "whatsapp_number": data.whatsapp_number,
        "address": data.address,
        "city": data.city,
        # Null rather than an empty list for customers, matching the check
        # constraint on the table.
        "delivery_areas": data.delivery_areas if data.role == "supplier" else None,
    }

    created = db.table("profiles").insert(row).execute()
    return ProfileOut(**{k: created.data[0][k] for k in ProfileOut.model_fields})


def get_profile(user_id: str) -> ProfileOut:
    result = (
        service_client()
        .table("profiles")
        .select(COLUMNS)
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise NotFound("We could not find your profile. Please finish registration.")
    return ProfileOut(**result.data)
