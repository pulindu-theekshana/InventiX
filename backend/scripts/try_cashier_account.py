"""
Try a cashier account

Purpose : Proves migration 0029 end to end: a cashier login can sell for its shop and is refused everywhere else. Creates a temporary cashier, signs in as them, sends one bill, then removes everything it made.
Spec    : Section 6.6 and 15.2
Look here when : A cashier cannot sign in, sees no products, or can reach a screen that is the owner's.

Run from backend/, with the backend already running:
    .venv\\Scripts\\python.exe scripts\\try_cashier_account.py
"""

import secrets
import sys
import uuid
from datetime import UTC, datetime

import httpx

sys.path.insert(0, ".")

from app.config import settings
from app.core.supabase import service_client
from app.feeds.customer.pos import service as pos
from app.feeds.customer.pos.schemas import CashierAccountIn

API = "http://127.0.0.1:8000"
# Unmistakable in a bill list, and removed again at the end either way.
DEVICE = "TEST"


def pick_shop(db) -> dict:
    """The shop with the most stock, so the till has something to sell."""
    shops = db.table("profiles").select("id, business_name").eq("role", "customer").execute().data
    best, best_n = None, -1
    for shop in shops:
        n = len(db.table("stock_items").select("id").eq("owner_id", shop["id"]).execute().data or [])
        if n > best_n:
            best, best_n = shop, n
    print(f"shop: {best['business_name']} ({best_n} stock items)")
    return best


def sign_in(email: str, password: str) -> str:
    r = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.supabase_anon_key},
        json={"email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def expect(label: str, got: int, want: int) -> bool:
    ok = got == want
    print(f"{'PASS' if ok else 'FAIL'}  {label}: {got} (wanted {want})")
    return ok


def main() -> None:
    db = service_client()
    shop = pick_shop(db)
    password = secrets.token_urlsafe(9)

    made = pos.create_cashier(shop["id"], CashierAccountIn(name="Zz Test Cashier", password=password))
    print("login:", made.login_email)
    sale_id = None
    moved: list[tuple[str, int]] = []

    try:
        head = {"Authorization": f"Bearer {sign_in(made.login_email, password)}"}
        g = lambda path: httpx.get(f"{API}{path}", headers=head, timeout=30)

        ok = True
        stocks = g("/customer/stocks")
        ok &= expect("GET /customer/stocks", stocks.status_code, 200)
        items = stocks.json() if stocks.status_code == 200 else []
        print(f"      sees {len(items)} products")
        ok &= expect("GET /customer/pos/settings", g("/customer/pos/settings").status_code, 200)
        ok &= expect("GET /customer/pos/summary", g("/customer/pos/summary").status_code, 200)
        ok &= expect("GET /customer/pos/next-receipt", g("/customer/pos/next-receipt").status_code, 200)

        # The boundary: everything that is the owner's.
        ok &= expect("GET /customer/pos/cashiers (owner only)", g("/customer/pos/cashiers").status_code, 403)
        ok &= expect("GET /customer/reports", g("/customer/reports").status_code, 403)
        ok &= expect("GET /customer/delivery", g("/customer/delivery").status_code, 403)
        ok &= expect("GET /customer/suppliers", g("/customer/suppliers").status_code, 403)
        ok &= expect("GET /customer/stocks/summary", g("/customer/stocks/summary").status_code, 403)
        ok &= expect(
            "PUT /customer/pos/settings",
            httpx.put(f"{API}/customer/pos/settings", headers=head,
                      json={"owner_pin_hash": None, "discount_limit": 0,
                            "return_limit": 0, "cashiers": []}, timeout=30).status_code,
            403,
        )

        # One real bill, which is the only way to see cashier_id stamped and stock move under a
        # cashier's own token (apply_stock_adjustment compares against app_shop_id()).
        tracked = next((i for i in items if i.get("id") and i["quantity_on_hand"] > 0), None)
        if not tracked:
            print("SKIP  no tracked product with stock; sale not attempted")
        else:
            before = tracked["quantity_on_hand"]
            sale = httpx.post(f"{API}/customer/pos/sales", headers=head, timeout=30, json={
                "client_sale_id": str(uuid.uuid4()),
                "receipt_no": f"{DEVICE}-999001",
                "device_id": DEVICE,
                "sold_at": datetime.now(UTC).isoformat(),
                "payment_method": "cash",
                "discount": 0,
                "cashier_label": "Someone Else Entirely",
                "lines": [{
                    "catalog_product_id": tracked["product"]["id"],
                    "stock_item_id": tracked["id"],
                    "quantity": 1,
                    "unit_price": float(tracked.get("unit_price") or 100),
                }],
            })
            ok &= expect("POST /customer/pos/sales", sale.status_code, 201)
            if sale.status_code == 201:
                body = sale.json()
                sale_id = body["id"]
                row = db.table("pos_sales").select("cashier_id, cashier_label").eq(
                    "id", sale_id).single().execute().data
                stamped = row["cashier_id"] == made.id and row["cashier_label"] == "Zz Test Cashier"
                print(f"{'PASS' if stamped else 'FAIL'}  bill names the signed-in account, "
                      f"not the label sent: {row['cashier_label']!r}")
                ok &= stamped

                after = db.table("stock_items").select("quantity_on_hand").eq(
                    "id", tracked["id"]).single().execute().data["quantity_on_hand"]
                ok &= expect("stock moved for a cashier's sale", after, before - 1)
                if after != before:
                    moved.append((tracked["id"], before - after))

        print("\n" + ("ALL CHECKS PASSED" if ok else "SOMETHING FAILED -- read above"))

    finally:
        # Put the shop back exactly as it was: the bill, its lines, its sales history, the stock
        # it moved, the audit rows for that movement, and the login itself.
        if sale_id:
            db.table("sales_records").delete().eq("pos_sale_id", sale_id).execute()
            db.table("pos_sale_items").delete().eq("sale_id", sale_id).execute()
            db.table("stock_adjustments").delete().eq("source_id", sale_id).execute()
            db.table("pos_sales").delete().eq("id", sale_id).execute()
        for stock_item_id, qty in moved:
            current = db.table("stock_items").select("quantity_on_hand").eq(
                "id", stock_item_id).single().execute().data["quantity_on_hand"]
            db.table("stock_items").update({"quantity_on_hand": current + qty}).eq(
                "id", stock_item_id).execute()
        db.table("profiles").delete().eq("id", made.id).execute()
        db.auth.admin.delete_user(made.id)
        print("cleaned up: test bill, stock, and the test login are gone")


if __name__ == "__main__":
    main()
