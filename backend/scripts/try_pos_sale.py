"""
Try a till sale

Purpose : Signs in as a shop, sends one sale to the POS endpoint, then sends the same sale again, so the "a resent bill is stored once" guarantee can be seen rather than trusted.
Spec    : Section 6.6
Look here when : A POS sale needs testing and there is no till screen yet.

Run from backend/, with the backend already running:
    .venv\\Scripts\\python.exe scripts\\try_pos_sale.py shop@email.lk thepassword
"""

import sys
import uuid
from datetime import UTC, datetime

import httpx

sys.path.insert(0, ".")

from app.config import settings

API = "http://127.0.0.1:8000"


def main(email: str, password: str) -> None:
    # 1. Sign in through Supabase, exactly as the app does, to get a real token.
    auth = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.supabase_anon_key},
        json={"email": email, "password": password},
        timeout=30,
    )
    if auth.status_code != 200:
        print("Could not sign in:", auth.text[:200])
        return
    token = auth.json()["access_token"]
    head = {"Authorization": f"Bearer {token}"}

    # 2. Take a product this shop actually stocks.
    stocks = httpx.get(f"{API}/customer/stocks", headers=head, timeout=30).json()
    if not stocks:
        print("This shop has no products yet. Add one first.")
        return
    item = stocks[0]
    print(f"Selling 1 x {item['product']['name']} (stock now {item['quantity_on_hand']})")

    sale = {
        "client_sale_id": str(uuid.uuid4()),
        "receipt_no": f"T1-{datetime.now(UTC).strftime('%H%M%S')}",
        "device_id": "T1",
        "sold_at": datetime.now(UTC).isoformat(),
        "payment_method": "cash",
        "lines": [{
            "catalog_product_id": item["product"]["id"],
            "stock_item_id": item["id"],
            "quantity": 1,
            "unit_price": item.get("unit_price") or 100,
        }],
    }

    # 3. Send it twice. The second send is the point of this script.
    first = httpx.post(f"{API}/customer/pos/sales", headers=head, json=sale, timeout=30)
    second = httpx.post(f"{API}/customer/pos/sales", headers=head, json=sale, timeout=30)
    if first.status_code >= 400:
        print("Sale refused:", first.status_code, first.text[:300])
        return

    print("First  send ->", first.status_code, first.json()["id"], first.json()["receipt_no"])
    print("Second send ->", second.status_code, second.json()["id"])
    print("Same bill id both times:", first.json()["id"] == second.json()["id"])

    after = httpx.get(f"{API}/customer/stocks/{item['id']}", headers=head, timeout=30).json()
    print(f"Stock after: {after['quantity_on_hand']} (was {item['quantity_on_hand']})")

    day = httpx.get(f"{API}/customer/pos/summary", headers=head, timeout=30).json()
    print("Day so far:", day)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
    else:
        main(sys.argv[1], sys.argv[2])
