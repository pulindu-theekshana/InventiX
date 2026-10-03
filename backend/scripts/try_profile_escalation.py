"""
Try to escalate a cashier account

Purpose : Checks what a cashier can do to their own profile row with their own token and no help from the app: move themselves to another shop, or undo their own removal. Both decide what every policy then lets them read.
Spec    : Section 15.1
Look here when : After touching profiles policies, or migration 0031.

Run from backend/:
    .venv\\Scripts\\python.exe scripts\\try_profile_escalation.py

Expected after migration 0031: both refused. Before it: both allowed, which is the hole.
"""

import secrets
import sys

import httpx

sys.path.insert(0, ".")

from app.config import settings
from app.core.supabase import service_client
from app.feeds.customer.pos import service as pos
from app.feeds.customer.pos.schemas import CashierAccountIn

REST = f"{settings.supabase_url}/rest/v1/profiles"


def sign_in(email: str, password: str) -> str:
    r = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.supabase_anon_key},
        json={"email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def patch(token: str, user_id: str, body: dict) -> httpx.Response:
    """Straight to PostgREST, as a person with the token would. The app never sends this."""
    return httpx.patch(
        REST,
        params={"id": f"eq.{user_id}"},
        headers={
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=body,
        timeout=30,
    )


def main() -> None:
    db = service_client()
    shops = db.table("profiles").select("id, business_name").eq("role", "customer").execute().data
    if len(shops) < 2:
        print("needs two shops to try moving between them")
        return
    mine, theirs = shops[0], shops[1]
    print(f"cashier of: {mine['business_name']}   target: {theirs['business_name']}")

    password = secrets.token_urlsafe(9)
    made = pos.create_cashier(mine["id"], CashierAccountIn(name="Zz Escalation Test", password=password))

    try:
        token = sign_in(made.login_email, password)

        moved = patch(token, made.id, {"employer_id": theirs["id"]})
        after = db.table("profiles").select("employer_id").eq("id", made.id).single().execute().data
        took = after["employer_id"] == theirs["id"]
        print(f"{'FAIL' if took else 'PASS'}  move to another shop: "
              f"HTTP {moved.status_code}, employer_id {'CHANGED' if took else 'unchanged'}")
        if took:
            db.table("profiles").update({"employer_id": mine["id"]}).eq("id", made.id).execute()

        db.table("profiles").update({"is_active": False}).eq("id", made.id).execute()
        revived = patch(token, made.id, {"is_active": True})
        state = db.table("profiles").select("is_active").eq("id", made.id).single().execute().data
        back = state["is_active"] is True
        print(f"{'FAIL' if back else 'PASS'}  undo their own removal: "
              f"HTTP {revived.status_code}, is_active {'TRUE again' if back else 'still false'}")

        # The one thing they should be able to change: their own name.
        renamed = patch(token, made.id, {"contact_person": "Zz Renamed"})
        ok = renamed.status_code in (200, 204)
        print(f"{'PASS' if ok else 'FAIL'}  change their own name: HTTP {renamed.status_code}")
    finally:
        db.table("profiles").delete().eq("id", made.id).execute()
        db.auth.admin.delete_user(made.id)
        print("cleaned up: the test login is gone")


if __name__ == "__main__":
    main()
