"""
Till rules

Purpose : The arithmetic and refusals in domain/pos.py, plus the shape of a sale request.
Spec    : Section 6.6
Look here when : A bill total, a receipt number or a stock movement behaves unexpectedly.
"""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.domain import pos
from app.feeds.customer.pos.schemas import SaleIn


class TestReceiptNumber:
    @pytest.mark.parametrize("value", ["T1-000147", "A-0001", "TILL01-00000001"])
    def test_accepts_a_till_prefix_and_a_number(self, value):
        assert pos.is_valid_receipt_no(value)

    @pytest.mark.parametrize("value", ["000147", "T1 000147", "t1-000147", "T1-12", ""])
    def test_refuses_anything_else(self, value):
        assert not pos.is_valid_receipt_no(value)


class TestTotals:
    def test_a_line_is_quantity_times_price(self):
        assert pos.line_total(3, 250) == Decimal("750.00")

    def test_weight_is_rounded_to_cents_the_way_a_person_rounds(self):
        # 1.255 kg at 420.00 is 527.10, not 527.09.
        assert pos.line_total(1.255, 420) == Decimal("527.10")

    def test_a_bill_sums_its_lines(self):
        lines = [{"quantity": 2, "unit_price": 260}, {"quantity": 1, "unit_price": 1150}]
        assert pos.bill_total(lines) == Decimal("1670.00")

    def test_discount_comes_off_the_total(self):
        lines = [{"quantity": 2, "unit_price": 260}]
        assert pos.bill_total(lines, 20) == Decimal("500.00")

    def test_a_discount_bigger_than_the_bill_does_not_become_a_refund(self):
        assert pos.bill_total([{"quantity": 1, "unit_price": 100}], 500) == Decimal("0.00")


class TestStockMovement:
    def test_normal_sale_moves_what_was_sold(self):
        assert pos.stock_movement(3, 10) == 3

    def test_never_below_zero_when_the_count_was_wrong(self):
        # The shop thought it had 2 and sold 5. The bill keeps 5; stock stops at zero.
        assert pos.stock_movement(5, 2) == 2

    def test_a_product_not_tracked_in_stock_moves_nothing(self):
        assert pos.stock_movement(5, None) == 0

    def test_weight_rounds_to_whole_units(self):
        assert pos.stock_movement(1.6, 10) == 2
        assert pos.stock_movement(1.4, 10) == 1


class TestReturnable:
    def test_a_line_can_only_come_back_once(self):
        assert pos.returnable(3, 3) == Decimal(0)
        assert pos.returnable(3, 1) == Decimal(2)

    def test_over_returned_line_does_not_go_negative(self):
        assert pos.returnable(3, 5) == Decimal(0)


SALE = {
    "client_sale_id": "6f1e0e3a-0000-4000-8000-000000000001",
    "receipt_no": "T1-000147",
    "device_id": "T1",
    "sold_at": "2026-10-01T18:30:00Z",
    "lines": [{"catalog_product_id": "p1", "quantity": 2, "unit_price": 260}],
}


class TestSaleRequest:
    def test_a_normal_bill_is_accepted(self):
        assert SaleIn(**SALE).payment_method == "cash"

    def test_a_bill_with_no_lines_is_refused(self):
        with pytest.raises(ValidationError):
            SaleIn(**{**SALE, "lines": []})

    def test_a_bad_receipt_number_is_refused(self):
        with pytest.raises(ValidationError):
            SaleIn(**{**SALE, "receipt_no": "147"})

    def test_an_unknown_payment_method_is_refused(self):
        with pytest.raises(ValidationError):
            SaleIn(**{**SALE, "payment_method": "cheque"})

    def test_a_free_line_is_allowed_but_a_negative_one_is_not(self):
        SaleIn(**{**SALE, "lines": [{"catalog_product_id": "p1", "quantity": 1, "unit_price": 0}]})
        with pytest.raises(ValidationError):
            SaleIn(**{**SALE, "lines": [{"catalog_product_id": "p1", "quantity": 0, "unit_price": 10}]})
