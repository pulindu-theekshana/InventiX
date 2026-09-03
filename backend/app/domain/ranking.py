"""
Supplier ranking formula

Purpose : The weighted score: quality 40, delivery speed 30, quantity availability 20, price 10. Also the new-supplier neutral default and the rating-count weighting.
Spec    : Section 12
Look here when : Suppliers appear in the wrong order, or a new supplier is stuck at the bottom forever.
"""

from dataclasses import dataclass

# Spec 12.2. A supplier with no history scores this rather than zero. Zero would
# rank every new supplier last permanently, so they could never earn the first
# order that would give them a rating -- a real failure mode, not a hypothetical.
NEUTRAL = 0.6

# How many ratings before the average is trusted at face value. Below this the
# score is pulled toward NEUTRAL, so one five-star rating does not outrank fifty
# four-star ones (spec 12.2).
RATING_CONFIDENCE = 5


@dataclass(frozen=True)
class Candidate:
    """One supplier, as the ranking sees them for one particular order."""

    supplier_id: str
    average_rating: float | None
    rating_count: int
    measured_delivery_days: float | None
    completed_orders: int
    unit_price: float | None = None
    quantity_available: int | None = None


def quality_component(average_rating: float | None, rating_count: int) -> float:
    """
    Spec 12.1, 40 percent. Normalised to 0-1 and weighted by confidence.

    A supplier with one five-star rating scores 0.67, not 1.0, because a single
    opinion is not evidence. With fifty ratings the average is trusted almost
    entirely.
    """
    if average_rating is None or rating_count <= 0:
        return NEUTRAL
    normalised = (average_rating - 1) / 4.0
    confidence = rating_count / (rating_count + RATING_CONFIDENCE)
    return normalised * confidence + NEUTRAL * (1 - confidence)


def delivery_component(days: float | None, fastest: float | None, slowest: float | None) -> float:
    """
    Spec 12.1, 30 percent. Measured from requested_at to purchased_at across
    completed orders, compared against the other suppliers -- never the supplier's
    own stated lead_time_days, which is a claim rather than a measurement.
    """
    if days is None or fastest is None or slowest is None:
        return NEUTRAL
    if slowest <= fastest:
        return 1.0
    return max(0.0, min(1.0, 1.0 - (days - fastest) / (slowest - fastest)))


def availability_component(quantity_available: int | None, requested: int) -> float:
    """
    Spec 12.1, 20 percent. Whether they can meet what is being asked for, and by
    what margin. This is why a stored score can only ever be part of the answer:
    it depends on the order, so it cannot be precomputed.
    """
    if quantity_available is None or requested <= 0:
        return NEUTRAL
    if quantity_available < requested:
        return 0.0
    return min(1.0, 0.7 + 0.3 * min(1.0, (quantity_available - requested) / max(requested, 1)))


def price_component(unit_price: float | None, cheapest: float | None, dearest: float | None) -> float:
    """Spec 12.1, 10 percent. Against the other suppliers of the same product."""
    if unit_price is None or cheapest is None or dearest is None:
        return NEUTRAL
    if dearest <= cheapest:
        return 1.0
    return max(0.0, min(1.0, 1.0 - (unit_price - cheapest) / (dearest - cheapest)))


def is_new_supplier(completed_orders: int, minimum: int) -> bool:
    """
    Spec 12.2 says fewer than three; spec 9.2 says none at all. Three is used,
    because 12.2 is the section that explains the reasoning, and `minimum` comes
    from app_config so it can be retuned without a release. See D-008.
    """
    return completed_orders < minimum


def score(candidate: Candidate, weights: dict[str, float], *, requested_quantity: int = 0,
          fastest: float | None = None, slowest: float | None = None,
          cheapest: float | None = None, dearest: float | None = None) -> float:
    """
    The full spec 12.1 score out of 100, for one supplier against one order.

    The stored score in supplier_ranking is the quality and delivery halves only,
    renormalised -- availability and price need the order, so they are applied
    here at query time. That split is why a supplier can rank second for rice and
    fifth for sugar.
    """
    parts = {
        "quality": quality_component(candidate.average_rating, candidate.rating_count),
        "delivery": delivery_component(candidate.measured_delivery_days, fastest, slowest),
        "quantity": availability_component(candidate.quantity_available, requested_quantity),
        "price": price_component(candidate.unit_price, cheapest, dearest),
    }
    total_weight = sum(weights.values()) or 1
    return round(sum(parts[k] * weights.get(k, 0) for k in parts) / total_weight * 100, 2)


def rank(candidates: list[Candidate], weights: dict[str, float],
         requested_quantity: int = 0) -> list[tuple[Candidate, float]]:
    """
    Orders suppliers best first. Spec 9.3: those who cannot meet the quantity are
    still returned, marked rather than hidden, so the customer understands why
    they rank lower instead of wondering where they went.
    """
    if not candidates:
        return []

    delivery = [c.measured_delivery_days for c in candidates if c.measured_delivery_days is not None]
    prices = [c.unit_price for c in candidates if c.unit_price is not None]

    scored = [
        (
            c,
            score(
                c, weights,
                requested_quantity=requested_quantity,
                fastest=min(delivery) if delivery else None,
                slowest=max(delivery) if delivery else None,
                cheapest=min(prices) if prices else None,
                dearest=max(prices) if prices else None,
            ),
        )
        for c in candidates
    ]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)
