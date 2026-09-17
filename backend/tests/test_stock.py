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


class _Recorder:
    """Chainable stand-in for the supabase client that records writes. Every query finds `found`."""

    def __init__(self, found=None):
        self.found, self.calls, self._pending = found, [], None

    def table(self, name):
        self._pending = name
        return self

    def rpc(self, name, params):
        self.calls.append(("rpc", name, params))
        return self

    def insert(self, row):
        self.calls.append(("insert", self._pending, row))
        return self

    def update(self, patch):
        self.calls.append(("update", self._pending, patch))
        return self

    def __getattr__(self, _):  # select, eq, maybe_single ...
        return lambda *a, **k: self

    def execute(self):
        last = self.calls[-1][0] if self.calls else None
        data = [{"id": "new-row"}] if last == "insert" else self.found
        return type("Result", (), {"data": data})()


NEW_LINE = {"stock_item_id": None, "catalog_product_id": "p1", "quantity_requested": 24}


class TestReceive:
    """A product ordered new gets its stock row on arrival, not on order."""

    def test_new_product_creates_the_row_then_tops_it_up(self):
        db = _Recorder(found=None)
        stock.receive(db, "shop", "supplier", "order", dict(NEW_LINE))
        insert = next(c for c in db.calls if c[0] == "insert")
        assert insert[2] == {"owner_id": "shop", "catalog_product_id": "p1",
                             "preferred_supplier_id": "supplier"}
        rpc = next(c for c in db.calls if c[0] == "rpc")
        assert rpc[2]["p_stock_item_id"] == "new-row"
        assert rpc[2]["p_change"] == 24

    def test_existing_row_is_reused_not_duplicated(self):
        db = _Recorder(found={"id": "held"})
        stock.receive(db, "shop", "supplier", "order", dict(NEW_LINE))
        assert not any(c[0] == "insert" for c in db.calls)
        assert next(c for c in db.calls if c[0] == "rpc")[2]["p_stock_item_id"] == "held"
