"""
Till rules

Purpose : The arithmetic and the refusals behind a sale at the counter: line totals, the receipt number format, and how much stock a sale may actually move.
Spec    : Section 6.6
Look here when : A bill's total disagrees with its lines, a receipt number is refused, or a sale moved the wrong quantity.
"""

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

# 'T1-000147'. The prefix is the till, because a laptop that is offline cannot ask the server
# for the next number, and two tills would otherwise both pick 000147 on the same day.
RECEIPT_PATTERN = re.compile(r"^[A-Z0-9]{1,6}-\d{4,8}$")

CASH = "cash"
PAYMENT_METHODS = ("cash", "card", "other")


def is_valid_receipt_no(value: str) -> bool:
    return bool(RECEIPT_PATTERN.match(value.strip()))


def money(value: Decimal | float) -> Decimal:
    """Two decimal places, rounded the way a person rounds, so a bill adds up on paper."""
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def line_total(quantity: Decimal | float, unit_price: Decimal | float) -> Decimal:
    return money(Decimal(str(quantity)) * Decimal(str(unit_price)))


def bill_total(lines: list[dict], discount: Decimal | float = 0) -> Decimal:
    """
    The total the customer pays. Computed here rather than trusted from the till: the till is
    a client like any other, and a client that can name its own total can under-report takings.
    """
    gross = sum((line_total(line["quantity"], line["unit_price"]) for line in lines), Decimal(0))
    net = gross - money(discount)
    # A discount larger than the bill is a mistake, not a refund.
    return money(max(net, Decimal(0)))


def whole_units(quantity: Decimal | float) -> int:
    """
    Stock and sales history count in whole units; a till sells 1.255 kg. Rounded, not truncated,
    because truncating would quietly lose a little stock on every weighed sale.
    """
    return int(Decimal(str(quantity)).to_integral_value(rounding=ROUND_HALF_UP))


def stock_movement(quantity: Decimal | float, quantity_on_hand: int | None) -> int:
    """
    How far stock may fall for one sold line, as a whole number of units.

    Never below zero, for the same reason the sales upload clamps (uploads/applier.py): a shop
    that miscounted still sold the item, and refusing the sale at the counter -- or storing a
    negative quantity -- would both be worse than recording what is certain. The bill keeps the
    real quantity; only the stock movement is clamped.

    A product the shop does not track has no quantity_on_hand, so nothing moves.
    """
    if quantity_on_hand is None:
        return 0
    return max(0, min(whole_units(quantity), quantity_on_hand))


def returnable(sold: Decimal | float, already_returned: Decimal | float) -> Decimal:
    """What is left to return on a line. Spec 6.6: a line cannot come back twice."""
    return max(Decimal(str(sold)) - Decimal(str(already_returned)), Decimal(0))


# ---------------------------------------------------------------------------
# What the owner reads
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CashierTotals:
    """One person's share of a period."""

    cashier_id: str | None
    cashier: str | None
    bills: int
    sales_total: Decimal
    discounts_total: Decimal
    returns_total: Decimal


@dataclass(frozen=True)
class TillEvent:
    """A bill the owner might want to ask about, and why it is on the list."""

    receipt_no: str
    kind: str
    sold_at: str
    cashier_id: str | None
    cashier: str | None
    total: Decimal
    discount: Decimal
    above_limit: bool
    priced_at_till: bool


@dataclass(frozen=True)
class TillSummary:
    bills: int
    sales_total: Decimal
    returns_total: Decimal
    discounts_total: Decimal
    by_cashier: list[CashierTotals]
    events: list[TillEvent]


# A month of a small shop is hundreds of bills; the list the owner reads is not meant to be all
# of them. The cap is what keeps "one query, grouped in memory" an honest design.
MAX_EVENTS = 200


def summarise_till(
    rows: list[dict],
    discount_limit: float | Decimal = 0,
    return_limit: float | Decimal = 0,
    max_events: int = MAX_EVENTS,
) -> TillSummary:
    """
    Turns a period's bills into what the owner's till view shows: takings per person, and the
    bills worth a second look.

    Pure on purpose. This is the arithmetic an owner reads when deciding whether someone is being
    careless or dishonest, so it is the last place to rely on "it looked right when I tried it" --
    it belongs with bill_total and stock_movement, where a test can reach it without a database.

    Each row is one `pos_sales` row: kind, receipt_no, sold_at, total, discount, cashier_id,
    cashier_label, and its `pos_sale_items` (only `price_from_till` is read).
    """
    discount_cap = money(discount_limit)
    return_cap = money(return_limit)

    people: dict[tuple[str | None, str | None], dict] = {}
    events: list[TillEvent] = []
    bills = 0
    sales = returns = discounts = Decimal("0.00")

    for row in rows:
        total = money(row.get("total") or 0)
        discount = money(row.get("discount") or 0)
        key = (row.get("cashier_id"), row.get("cashier_label"))
        person = people.setdefault(
            key,
            {"bills": 0, "sales": Decimal("0.00"), "discounts": Decimal("0.00"),
             "returns": Decimal("0.00")},
        )

        if row.get("kind") == "sale":
            bills += 1
            sales += total
            discounts += discount
            person["bills"] += 1
            person["sales"] += total
            person["discounts"] += discount
            # A discount of nothing is not a discount, whatever the limit is set to.
            over = discount > 0 and discount > discount_cap
        else:
            returns += total
            person["returns"] += total
            over = total > return_cap

        priced_at_till = any(
            item.get("price_from_till") for item in (row.get("pos_sale_items") or [])
        )

        # Every return, every discount, and every bill priced at the counter. A return of nothing
        # unusual still belongs here: it is the other way money leaves the drawer, and the owner
        # is the one who decides what is odd.
        if (row.get("kind") == "return" or discount > 0 or priced_at_till) and len(events) < max_events:
            events.append(TillEvent(
                receipt_no=row.get("receipt_no", ""),
                kind=row.get("kind", "sale"),
                sold_at=row.get("sold_at", ""),
                cashier_id=row.get("cashier_id"),
                cashier=row.get("cashier_label"),
                total=total,
                discount=discount,
                above_limit=over,
                priced_at_till=priced_at_till,
            ))

    by_cashier = sorted(
        (
            CashierTotals(
                cashier_id=key[0],
                cashier=key[1],
                bills=value["bills"],
                sales_total=value["sales"],
                discounts_total=value["discounts"],
                returns_total=value["returns"],
            )
            for key, value in people.items()
        ),
        key=lambda c: -c.sales_total,
    )

    return TillSummary(
        bills=bills,
        sales_total=sales,
        returns_total=returns,
        discounts_total=discounts,
        by_cashier=by_cashier,
        events=events,
    )
