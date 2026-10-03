"""
Demand forecast model

Purpose : How fast each product actually sells, when it runs out, and how much of that to believe. Pure arithmetic over sales_records -- no database, no network, so it can be tested.
Spec    : Section 7.2
Look here when : A forecast is implausible, or a run-out date disagrees with the shelf.
"""

# Why there is no scikit-learn here.
#
# Spec 7.2 asks for a demand model, and the obvious reach is a regression or an
# ARIMA. Both would be worse. A shop reaches this screen with weeks of history,
# not years: fitting a trend and a weekly seasonality through thirty points
# produces a curve that explains the past beautifully and predicts noise. The
# honest model for this much data is a weighted average of what actually sold,
# and the weighting is the only cleverness -- last week matters more than the
# week before.
#
# What a bigger dataset would justify, in order: a weekday effect (a grocery
# shop's Sunday is not its Tuesday), then the learned festival uplift that
# ml/seasonal_uplift.py is reserved for, then a per-product model. None of them
# are worth their error bars yet, and the confidence tier below is what says so
# out loud rather than hiding it.
#
# ponytail: exponentially weighted mean, upgrade to a weekday-aware model when a
# shop has a few months and the weekday effect is measurable.

from dataclasses import dataclass
from datetime import date, timedelta

from ..domain import thresholds

# Spec 7.2's own bar for a forecast worth trusting. Not the bar for showing
# anything at all -- a shop with ten days of sales still wants to know what is
# about to run out, it just needs telling how rough the number is.
MIN_WEEKS_OF_HISTORY = 8

# Below this there is nothing to average. A single day of sales says what sold
# today, which the owner can already see.
MIN_DAYS_OF_HISTORY = 7

# How quickly older days stop counting. Fourteen days means a sale a fortnight
# ago carries half the weight of one today, so a product that has just started
# moving shows up as moving rather than being averaged away by the quiet weeks
# behind it.
HALF_LIFE_DAYS = 14

# A run-out further off than this is reported as "not soon" instead of a date.
# Claiming a product runs out in fourteen months is arithmetic, not a forecast.
MAX_USEFUL_COVER_DAYS = 90

ROUGH, FAIR, GOOD = "rough", "fair", "good"


@dataclass(frozen=True)
class ProductForecast:
    """One product's answer. Every field is optional-safe: a shop with no history gets zeros and a reason, not an exception."""

    catalog_product_id: str
    name: str
    units_per_day: float
    trend: str                      # "rising" | "steady" | "falling"
    days_counted: int
    days_selling: int
    units_sold: int
    quantity_on_hand: int | None
    days_of_cover: float | None
    runs_out_on: date | None
    suggested_threshold: int | None
    low_threshold: int | None

    @property
    def is_urgent(self) -> bool:
        """Runs out inside a week. What the screen sorts on."""
        return self.days_of_cover is not None and self.days_of_cover <= 7

    @property
    def threshold_looks_wrong(self) -> bool:
        """
        Whether the low-stock level the shop set is far enough from what the sales
        say to be worth mentioning.

        Half out either way, because a threshold is a rough instrument and
        flagging a ten percent difference would mark every product on the shelf.
        A product with no suggestion yet is never flagged -- there is nothing to
        compare it against.
        """
        if self.suggested_threshold is None or self.low_threshold is None:
            return False
        if self.low_threshold == 0:
            return self.suggested_threshold > 0
        ratio = self.suggested_threshold / self.low_threshold
        return ratio >= 1.5 or ratio <= 0.5


@dataclass(frozen=True)
class Forecast:
    """The whole shop's answer, with the honesty attached to it rather than to each row."""

    generated_on: date
    days_counted: int
    weeks_counted: int
    confidence: str                 # "rough" | "fair" | "good"
    weeks_until_good: int
    products: list[ProductForecast]


def is_available() -> bool:
    """
    The model exists now, so this is no longer a phase gate.

    It stays because ml/storage.py and jobs/forecast_recalc.py both ask it, and
    because the question it answers is still a real one -- it is just answered by
    whether there is enough history, which needs the rows. See has_enough().
    """
    return True


def has_enough(rows: list[dict]) -> bool:
    """Whether a forecast can say anything at all. The Reports screen renders False as its empty state."""
    return days_counted(rows) >= MIN_DAYS_OF_HISTORY


def _dates(rows: list[dict]) -> list[date]:
    return sorted({date.fromisoformat(r["sale_date"]) for r in rows if r.get("sale_date")})


def days_counted(rows: list[dict]) -> int:
    """
    The span the shop has been selling over, first sale to last, inclusive.

    The span and not the count of days with a sale, because that is the
    denominator a rate needs. A shop open twenty days that sold rice on four of
    them sells rice slowly; dividing by four would call it a fast mover.
    """
    dates = _dates(rows)
    if not dates:
        return 0
    return (dates[-1] - dates[0]).days + 1


def weeks_of_history(rows: list[dict]) -> int:
    """Whole weeks of history. What the screen quotes when it explains what is missing."""
    return days_counted(rows) // 7


def confidence(rows: list[dict]) -> str:
    """
    How much to believe the number, in a word the owner already understands.

    Three tiers rather than a percentage: a confidence interval on thirty points
    would itself be a guess, and "fair" is both honest and actionable where
    "68% ± 12" is neither.
    """
    days = days_counted(rows)
    if days >= MIN_WEEKS_OF_HISTORY * 7:
        return GOOD
    if days >= 28:
        return FAIR
    return ROUGH


def _weighted_rate(daily: dict[date, int], last_day: date, span_days: int) -> float:
    """
    Units per day, counting recent days more heavily.

    Every day in the window contributes, including the ones with no sale -- those
    are the zeros that keep a slow mover slow. The weights are halved every
    HALF_LIFE_DAYS going back, and the result is divided by the total weight, so
    a flat seller comes out at exactly its flat rate and the weighting only bites
    when the pattern has changed.
    """
    if span_days <= 0:
        return 0.0

    total = 0.0
    weight_sum = 0.0
    for offset in range(span_days):
        day = last_day - timedelta(days=offset)
        weight = 0.5 ** (offset / HALF_LIFE_DAYS)
        total += daily.get(day, 0) * weight
        weight_sum += weight

    if weight_sum == 0:
        return 0.0
    # Negative is possible: migration 0027 lets a return be recorded as a negative
    # quantity. A product returned more than it sold has no demand to forecast.
    return max(total / weight_sum, 0.0)


def _trend(daily: dict[date, int], last_day: date, span_days: int) -> str:
    """
    Rising, steady or falling, by comparing the last seven days with the seven before.

    Needs a fortnight to say anything, and a tenth either way before it will --
    below that it would flip between rising and falling on one extra packet sold,
    which is noise with an arrow drawn on it.
    """
    if span_days < 14:
        return "steady"

    def total(start_offset: int) -> int:
        return sum(daily.get(last_day - timedelta(days=start_offset + i), 0) for i in range(7))

    recent, before = total(0), total(7)
    if before <= 0:
        return "rising" if recent > 0 else "steady"
    change = (recent - before) / before
    if change > 0.1:
        return "rising"
    if change < -0.1:
        return "falling"
    return "steady"


def forecast(
    rows: list[dict],
    products: dict[str, dict],
    lead_times: dict[str, int] | None = None,
    today: date | None = None,
) -> Forecast:
    """
    The whole model.

    `rows` are sales_records rows: catalog_product_id, quantity_sold, sale_date.
    `products` maps catalog_product_id to what the shelf knows -- name,
    quantity_on_hand, low_threshold. `lead_times` is days per product, from what
    the preferred supplier has actually taken, so a reorder point covers the wait.

    Products with no sales are included with a rate of zero. A product that has
    not sold in a month is exactly what the "worst sellers" half of spec 7.1 is
    for, and dropping it here would hide it.
    """
    today = today or date.today()
    lead_times = lead_times or {}

    span = days_counted(rows)
    dates = _dates(rows)
    # Measured to the last sale, not to today: a shop closed for a week should not
    # have that week counted as seven days of zero demand for everything.
    last_day = dates[-1] if dates else today

    per_product: dict[str, dict[date, int]] = {}
    for row in rows:
        product_id = row.get("catalog_product_id")
        if not product_id or not row.get("sale_date"):
            # An unmatched upload line has no product (migration 0009). It counts
            # towards the upload's row count, not towards any product's demand.
            continue
        day = date.fromisoformat(row["sale_date"])
        daily_for_product = per_product.setdefault(product_id, {})
        daily_for_product[day] = daily_for_product.get(day, 0) + row.get("quantity_sold", 0)

    out: list[ProductForecast] = []
    for product_id, shelf in products.items():
        daily = per_product.get(product_id, {})
        rate = _weighted_rate(daily, last_day, span)
        on_hand = shelf.get("quantity_on_hand")
        units_sold = sum(daily.values())
        days_selling = sum(1 for qty in daily.values() if qty > 0)

        cover: float | None = None
        runs_out: date | None = None
        if on_hand is not None and rate > 0:
            cover = round(on_hand / rate, 1)
            if cover <= MAX_USEFUL_COVER_DAYS:
                runs_out = today + timedelta(days=int(cover))

        out.append(ProductForecast(
            catalog_product_id=product_id,
            name=shelf.get("name", ""),
            units_per_day=round(rate, 2),
            trend=_trend(daily, last_day, span),
            days_counted=span,
            days_selling=days_selling,
            units_sold=units_sold,
            quantity_on_hand=on_hand,
            days_of_cover=cover,
            runs_out_on=runs_out,
            # The simple average, deliberately: spec 6.7's rule is the one the
            # Stocks screen already offers, and a second opinion that differed
            # would leave the owner choosing between two numbers from one app.
            suggested_threshold=thresholds.suggest_from_velocity(
                units_sold, span, lead_times.get(product_id, 0),
            ),
            low_threshold=shelf.get("low_threshold"),
        ))

    # Soonest to run out first, and never a product that cannot run out at all.
    out.sort(key=lambda p: (p.days_of_cover is None, p.days_of_cover or 0.0))

    weeks = span // 7
    return Forecast(
        generated_on=today,
        days_counted=span,
        weeks_counted=weeks,
        confidence=confidence(rows),
        weeks_until_good=max(0, MIN_WEEKS_OF_HISTORY - weeks),
        products=out,
    )


def predict(sales_rows: list[dict], weeks_ahead: int = 4) -> dict | None:
    """
    Total units expected over the coming weeks, per product. The shape
    jobs/forecast_recalc.py stores when storing becomes worth doing.

    Returns None below MIN_DAYS_OF_HISTORY, which the Reports screen renders as
    "not enough data yet" with what is still needed -- a fabricated forecast is
    worse than none, because a shop owner would order against it.
    """
    if not has_enough(sales_rows):
        return None

    span = days_counted(sales_rows)
    dates = _dates(sales_rows)
    last_day = dates[-1]

    per_product: dict[str, dict[date, int]] = {}
    for row in sales_rows:
        product_id = row.get("catalog_product_id")
        if not product_id or not row.get("sale_date"):
            continue
        day = date.fromisoformat(row["sale_date"])
        daily_for_product = per_product.setdefault(product_id, {})
        daily_for_product[day] = daily_for_product.get(day, 0) + row.get("quantity_sold", 0)

    return {
        "weeks_ahead": weeks_ahead,
        "confidence": confidence(sales_rows),
        "units": {
            product_id: round(_weighted_rate(daily, last_day, span) * 7 * weeks_ahead)
            for product_id, daily in per_product.items()
        },
    }
