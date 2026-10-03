"""
Try the demand forecast

Purpose : Reads the forecast endpoint as a real shop, so the model can be seen against real sales rather than trusted from unit tests. Also proves the shop can now read its own till sales at all.
Spec    : Section 7.2
Look here when : The forecast is empty, or a run-out date looks wrong.

Run from backend/, with the backend already running:
    .venv\\Scripts\\python.exe scripts\\try_forecast.py shop@email.lk thepassword

Changes nothing. Reads only.
"""

import sys

import httpx

sys.path.insert(0, ".")

from app.config import settings

API = "http://127.0.0.1:8000"


def main(email: str, password: str) -> None:
    auth = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.supabase_anon_key},
        json={"email": email, "password": password},
        timeout=30,
    )
    if auth.status_code != 200:
        print("Could not sign in:", auth.text[:200])
        return
    head = {"Authorization": f"Bearer {auth.json()['access_token']}"}

    # 1. The thing migration 0032 fixes. Before it, a shop reading its own
    #    sales_records through its own token saw only uploaded rows, never till
    #    ones -- so this count is the test of the policy, not of the forecast.
    rows = httpx.get(
        f"{settings.supabase_url}/rest/v1/sales_records",
        params={"select": "source"},
        headers={**head, "apikey": settings.supabase_anon_key},
        timeout=30,
    )
    if rows.status_code != 200:
        print("Could not read sales_records:", rows.text[:200])
        return
    sources: dict[str, int] = {}
    for row in rows.json():
        sources[row["source"]] = sources.get(row["source"], 0) + 1
    print(f"sales_records this shop can read: {len(rows.json())} {sources}")
    if not sources.get("pos"):
        print("  !! no till sales visible -- migration 0032 has not been run")

    # 2. Sections, which used to be marked available from an applied upload and
    #    are now marked from the rows the reports actually read.
    sections = httpx.get(f"{API}/customer/reports", headers=head, timeout=30).json()
    print("\nsections:")
    for section in sections:
        print(f"  [{'x' if section['available'] else ' '}] {section['title']}")

    # 3. The model.
    out = httpx.get(f"{API}/customer/reports/forecast", headers=head, timeout=60)
    if out.status_code != 200:
        print("\nforecast failed:", out.status_code, out.text[:300])
        return
    report = out.json()

    print(f"\nforecast as at {report['generated_on']}")
    print(f"  history   : {report['days_counted']} days ({report['weeks_counted']} weeks)")
    print(f"  confidence: {report['confidence']}", end="")
    print(f", {report['weeks_until_good']} more weeks until it is good"
          if report["weeks_until_good"] else " -- enough history")

    if not report["has_enough"]:
        print(f"  declined to answer: needs {report['min_days_needed']} days of sales")
        return

    print(f"\n  {'product':<28}{'/day':>7}{'held':>7}{'cover':>8}{'runs out':>12}  trend")
    for p in report["products"]:
        cover = f"{p['days_of_cover']}d" if p["days_of_cover"] is not None else "-"
        print(
            f"  {p['name'][:27]:<28}{p['units_per_day']:>7}{p['quantity_on_hand']:>7}"
            f"{cover:>8}{p['runs_out_on'] or '-':>12}  {p['trend']}"
            + ("  URGENT" if p["is_urgent"] else "")
        )

    wrong = [p for p in report["products"] if p["threshold_looks_wrong"]]
    if wrong:
        print("\n  low-stock levels the sales disagree with:")
        for p in wrong:
            print(f"    {p['name'][:30]:<32} set {p['low_threshold']:>4}  "
                  f"suggested {p['suggested_threshold']}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
