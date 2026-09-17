"""
Message builder tests

Purpose : Proves the generated restock message contains every product, the right quantities and the right total. Run after changing message wording.
Spec    : Section 6.5
Look here when : After changing message wording.
"""

from datetime import date

from app.domain.message_builder import MessageLine, build, was_edited


def line(**kw) -> MessageLine:
    base = dict(  # noqa: C408 - keyword form reads better for a fixture
        name="Highland Milk Powder", pack_size="400 g",
                quantity_requested=60, current_quantity=12, unit_price=1180.0)
    base.update(kw)
    return MessageLine(**base)


class TestContents:
    """Spec 6.5 lists what the message must include."""

    def test_names_both_parties(self):
        msg = build(shop_name="Wasantha Kade", supplier_name="Lanka Traders", lines=[line()])
        assert "Wasantha Kade" in msg
        assert "Lanka Traders" in msg

    def test_includes_every_product(self):
        msg = build(
            shop_name="Shop", supplier_name="Supplier",
            lines=[line(name="Rice"), line(name="Sugar"), line(name="Dhal")],
        )
        # A missing product is the failure this test exists to catch: the order
        # would be created for three items and the supplier told about two.
        for name in ("Rice", "Sugar", "Dhal"):
            assert name in msg

    def test_includes_quantities_and_current_stock(self):
        msg = build(shop_name="Shop", supplier_name="Supplier",
                    lines=[line(quantity_requested=60, current_quantity=12)])
        assert "60" in msg
        assert "12" in msg

    def test_total_is_quantity_times_price(self):
        msg = build(shop_name="Shop", supplier_name="Supplier",
                    lines=[line(quantity_requested=10, unit_price=1000.0)])
        assert "10,000.00" in msg

    def test_total_sums_across_lines(self):
        msg = build(
            shop_name="Shop", supplier_name="Supplier",
            lines=[line(quantity_requested=10, unit_price=1000.0),
                   line(name="Sugar", quantity_requested=5, unit_price=200.0)],
        )
        assert "11,000.00" in msg

    def test_no_total_when_prices_are_unknown(self):
        msg = build(shop_name="Shop", supplier_name="Supplier",
                    lines=[line(unit_price=None)])
        assert "Estimated total" not in msg

    def test_optional_fields_appear_when_given(self):
        msg = build(
            shop_name="Shop", supplier_name="Supplier", lines=[line()],
            delivery_address="No 44, Horowpathana Road",
            requested_delivery_date=date(2026, 9, 8),
            notes="Please call before delivery.",
        )
        assert "Horowpathana" in msg
        assert "08 September 2026" in msg
        assert "Special note:\nPlease call before delivery." in msg

    def test_optional_fields_are_absent_when_not_given(self):
        msg = build(shop_name="Shop", supplier_name="Supplier", lines=[line()])
        assert "Preferred delivery" not in msg
        assert "Special note" not in msg
        assert "Delivery address" not in msg

    def test_accepts_an_iso_date_string(self):
        msg = build(shop_name="Shop", supplier_name="Supplier", lines=[line()],
                    requested_delivery_date="2026-09-08")
        assert "08 September 2026" in msg


class TestGrammar:
    def test_singular_for_one_product(self):
        msg = build(shop_name="Shop", supplier_name="Supplier", lines=[line()])
        assert "item has fallen" in msg

    def test_plural_for_several(self):
        msg = build(shop_name="Shop", supplier_name="Supplier", lines=[line(), line(name="Sugar")])
        assert "items have fallen" in msg

    def test_first_order_is_not_called_a_reorder(self):
        msg = build(shop_name="Shop", supplier_name="Supplier",
                    lines=[line(current_quantity=None)], first_order=True)
        assert "first order from Shop" in msg
        assert "reorder" not in msg
        assert "fallen below" not in msg
        assert "Current stock" not in msg


class TestEditDetection:
    """
    Spec 6.5 compares against the generated text rather than setting a flag on
    every keystroke, so a customer who types the original back is not warned
    about losing an edit they no longer have.
    """

    def test_unchanged_is_not_an_edit(self):
        generated = build(shop_name="Shop", supplier_name="Supplier", lines=[line()])
        assert not was_edited(generated, generated)

    def test_whitespace_only_change_is_not_an_edit(self):
        generated = build(shop_name="Shop", supplier_name="Supplier", lines=[line()])
        assert not was_edited("  " + generated + "\n\n", generated)

    def test_real_change_is_an_edit(self):
        generated = build(shop_name="Shop", supplier_name="Supplier", lines=[line()])
        assert was_edited(generated + "\n\nPlease hurry.", generated)
