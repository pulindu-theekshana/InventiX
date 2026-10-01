"""
Till rules

Purpose : The arithmetic and the refusals behind a sale at the counter: line totals, the receipt number format, and how much stock a sale may actually move.
Spec    : Section 6.6
Look here when : A bill's total disagrees with its lines, a receipt number is refused, or a sale moved the wrong quantity.
"""

import re
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
