"""
Product matching

Purpose : Resolves a POS product name to a catalog product using this shop's saved aliases, and records new ones. Matching is exact by design.
Spec    : Section 6.6 and 5.9
Look here when : A product that was mapped before is unmatched again.
"""

from ....core.exceptions import NotFound

# Common header names, so the mapping screen opens with the right columns already
# chosen on a first upload rather than three empty dropdowns.
GUESSES = {
    "product": ("item name", "product", "product name", "description", "item", "particulars"),
    "quantity": ("qty sold", "quantity", "qty", "units", "sold", "quantity sold"),
    "date": ("sale date", "date", "invoice date", "txn date", "transaction date"),
}


def guess_mapping(columns: list[str]) -> dict[str, str | None]:
    """A starting point the owner corrects, not an answer. Never guesses twice."""
    lowered = {c.lower().strip(): c for c in columns}
    result: dict[str, str | None] = {}
    used: set[str] = set()
    for field, candidates in GUESSES.items():
        match = None
        for candidate in candidates:
            if candidate in lowered and lowered[candidate] not in used:
                match = lowered[candidate]
                break
        if match:
            used.add(match)
        result[field] = match
    return result


def load_aliases(db, customer_id: str) -> dict[str, str]:
    """
    Every alias this shop has ever confirmed. Loaded once per upload rather than
    queried per row -- a 250-line report would otherwise be 250 round trips.
    """
    rows = (
        db.table("pos_product_aliases")
        .select("pos_product_name, catalog_product_id")
        .eq("customer_id", customer_id).execute().data or []
    )
    return {r["pos_product_name"]: r["catalog_product_id"] for r in rows}


def resolve(aliases: dict[str, str], pos_name: str) -> str | None:
    """
    Exact match, deliberately.

    Fuzzy matching would occasionally map "RICE-NADU-5KG" to the wrong product,
    and a wrong match silently decrements the wrong stock item -- worse than
    asking the owner once and remembering the answer forever (spec 5.9).
    """
    return aliases.get((pos_name or "").strip())


def save_alias(db, customer_id: str, pos_name: str, catalog_product_id: str) -> None:
    """
    Written once and reused on every later upload, which is what makes the
    unmatched list shrink toward nothing over a few months.
    """
    exists = (
        db.table("product_catalog").select("id")
        .eq("id", catalog_product_id).eq("is_active", True).execute().data
    )
    if not exists:
        raise NotFound("We could not find that product in the catalog.")

    db.table("pos_product_aliases").upsert(
        {
            "customer_id": customer_id,
            "pos_product_name": pos_name.strip(),
            "catalog_product_id": catalog_product_id,
        },
        on_conflict="customer_id,pos_product_name",
    ).execute()


def unmatched_summary(rows: list[dict], aliases: dict[str, str],
                      product_column: str) -> list[dict]:
    """
    The names that resolved to nothing, with how often each appears so the owner
    can deal with the ones that matter first.
    """
    counts: dict[str, int] = {}
    for row in rows:
        name = str(row.get(product_column, "")).strip()
        if not name or resolve(aliases, name):
            continue
        counts[name] = counts.get(name, 0) + 1

    return [
        {"pos_product_name": name, "occurrences": n, "catalog_product_id": None}
        for name, n in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]
