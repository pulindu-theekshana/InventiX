"""
Tunable configuration

Purpose : Reads ranking weights, unanswered-order timeout and auto-confirm delay from the app_config table so they can change without a release.
Spec    : Section 12.1 and 17
Look here when : A tuned value has no effect, or a timeout fires at the wrong time.
"""

import time
from typing import Any

# Defaults matching seeds/app_config.sql. Used only when the table cannot be
# reached, so a database blip degrades the ranking rather than stopping the app.
FALLBACK: dict[str, Any] = {
    "ranking_weight_quality": 40,
    "ranking_weight_delivery": 30,
    "ranking_weight_quantity": 20,
    "ranking_weight_price": 10,
    "new_supplier_min_orders": 3,
    "unanswered_order_hours": 24,
    "auto_confirm_days": 3,
    "auto_confirm_warning_days": 1,
    "stale_upload_days": 7,
    "rating_prompt_repeats": 2,
}

# Config changes rarely and is read on nearly every ranked search. Sixty seconds
# means a change is live within a minute without a query per request.
_TTL_SECONDS = 60
_cache: dict[str, Any] = {}
_loaded_at: float = 0.0


def _refresh(db) -> None:
    global _cache, _loaded_at
    try:
        rows = db.table("app_config").select("key, value").execute().data or []
        _cache = {row["key"]: row["value"] for row in rows}
    except Exception:  # noqa: BLE001 - any failure here must fall back, not propagate
        # Spec 12.1 wants these tunable, not fragile. Falling back is better than
        # a 500 on the Suppliers screen because one config row is missing.
        _cache = {}
    _loaded_at = time.monotonic()


def get(db, key: str, default: Any = None) -> Any:
    if time.monotonic() - _loaded_at > _TTL_SECONDS:
        _refresh(db)
    if key in _cache:
        return _cache[key]
    return FALLBACK.get(key, default)


def get_int(db, key: str, default: int | None = None) -> int:
    value = get(db, key, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(FALLBACK.get(key, default or 0))


def ranking_weights(db) -> dict[str, float]:
    """The four spec 12.1 weights, in the shape domain/ranking.py expects."""
    return {
        "quality": get_int(db, "ranking_weight_quality"),
        "delivery": get_int(db, "ranking_weight_delivery"),
        "quantity": get_int(db, "ranking_weight_quantity"),
        "price": get_int(db, "ranking_weight_price"),
    }


def invalidate() -> None:
    """Forces the next read to hit the table. Used by tests."""
    global _loaded_at
    _loaded_at = 0.0
