"""
Stock rule tests

Purpose : Proves the three-way classification, the low-stock boundary and the adjustment guard. Run after touching anything that changes quantity.
Spec    : Section 6.6
Look here when : After touching anything that changes quantity.
"""

import pytest

from app.core.exceptions import ValidationFailed
from app.domain import stock


class TestDamageDirection:
    """
    Spec 6.6. "Damage" and a positive number contradict each other, and the screen used
    to accept it -- entering 6 damaged packets added six units to the shelf.
    """

    def test_positive_damage_is_refused(self):
        with pytest.raises(ValidationFailed, match="only reduce"):
            stock.validate_adjustment(20, 6, "damage")

    def test_negative_damage_is_fine(self):
        assert stock.validate_adjustment(20, -6, "damage") == 14

    def test_other_reasons_may_still_add(self):
        assert stock.validate_adjustment(20, 6, "correction") == 26


class TestClassify:
    """
    Spec 6.2 defines exactly three states, and this function is their only
    definition. The pie chart and both list sections read it, so if it is wrong
    they are wrong together -- which is the point.
    """

    def test_above_threshold_is_in_stock(self):
        assert stock.classify(100, 20, False) == stock.IN_STOCK

    def test_at_threshold_is_low_not_in_stock(self):
        # Spec 5.4 says "at or below", so equality is low. Off-by-one here means
        # an item never becomes low and the whole application never triggers.
        assert stock.classify(20, 20, False) == stock.LOW_STOCK

    def test_below_threshold_is_low(self):
        assert stock.classify(5, 20, False) == stock.LOW_STOCK

    def test_low_with_open_order_is_restock_requested(self):
        # Spec 6.4: this is what stops the same product being ordered twice.
        assert stock.classify(5, 20, True) == stock.RESTOCK_REQUESTED

    def test_healthy_stock_ignores_the_flag(self):
        # A stale flag on a restocked item must not hide it from In stock.
        assert stock.classify(100, 20, True) == stock.IN_STOCK

    def test_zero_threshold_means_only_zero_is_low(self):
        assert stock.classify(1, 0, False) == stock.IN_STOCK
        assert stock.classify(0, 0, False) == stock.LOW_STOCK


class TestUrgency:
    """Spec 6.4 sorts Low stock by proportion, not by absolute shortfall."""

    def test_proportionally_worse_is_more_urgent(self):
        # 2 of 10 is worse than 40 of 50, even though 40 is the bigger number.
        assert stock.urgency(2, 10) > stock.urgency(40, 50)

    def test_at_threshold_is_zero_urgency(self):
        assert stock.urgency(20, 20) == 0.0

    def test_empty_shelf_is_maximum_urgency(self):
        assert stock.urgency(0, 20) == 1.0

    def test_zero_threshold_does_not_divide_by_zero(self):
        assert stock.urgency(0, 0) == 0.0


class TestSuggestedQuantity:
    def test_clears_the_threshold_with_headroom(self):
        # Ordering only back to the threshold puts it straight back into Low stock.
        assert stock.suggested_order_quantity(5, 20) == 35

    def test_never_suggests_zero(self):
        assert stock.suggested_order_quantity(100, 20) == 1


class TestValidateAdjustment:
    def test_normal_reduction(self):
        assert stock.validate_adjustment(100, -15, "sales_upload") == 85

    def test_normal_increase(self):
        assert stock.validate_adjustment(100, 40, "order_received") == 140

    def test_cannot_go_below_zero(self):
        with pytest.raises(ValidationFailed) as e:
            stock.validate_adjustment(10, -50, "damage")
        # The message must name the numbers; a constraint violation cannot.
        assert "10" in str(e.value)

    def test_exactly_zero_is_allowed(self):
        assert stock.validate_adjustment(10, -10, "damage") == 0

    def test_zero_change_is_refused(self):
        with pytest.raises(ValidationFailed):
            stock.validate_adjustment(100, 0, "manual")

    def test_unknown_reason_is_refused(self):
        with pytest.raises(ValidationFailed):
            stock.validate_adjustment(100, -5, "shrinkage")

    def test_reason_sets_match_the_database_constraint(self):
        # stock_adjustments has a check constraint on exactly these five.
        assert stock.ALL_REASONS == {
            "sales_upload", "manual", "order_received", "damage", "correction",
        }
