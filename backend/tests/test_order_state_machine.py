"""
Order state machine tests

Purpose : Proves every transition in spec 11.2 is allowed and everything else is refused. Run this before changing anything about order status.
Spec    : Section 11.2
Look here when : Before changing anything about order status.
"""

import pytest

from app.core.exceptions import Forbidden, InvalidTransition
from app.domain import order_state_machine as sm


class TestAllowedTransitions:
    """Spec 11.2, transcribed. If the spec changes, these change first."""

    @pytest.mark.parametrize(
        "current,target,actor",
        [
            ("requested", "confirmed", "supplier"),
            ("requested", "rejected", "supplier"),
            ("requested", "cancelled", "customer"),
            ("confirmed", "processing", "supplier"),
            ("confirmed", "cancelled", "customer"),
            ("processing", "put_to_delivery", "supplier"),
            ("put_to_delivery", "on_the_way", "supplier"),
            ("on_the_way", "purchased", "customer"),
        ],
    )
    def test_legal_transitions_pass(self, current, target, actor):
        sm.assert_transition(current, target, actor)


class TestRefusedTransitions:
    @pytest.mark.parametrize(
        "current,target",
        [
            ("requested", "processing"),        # skipping confirmation
            ("requested", "purchased"),         # skipping the entire pipeline
            ("confirmed", "on_the_way"),        # skipping two stages
            ("processing", "confirmed"),        # going backwards
            ("on_the_way", "processing"),       # going backwards
            ("purchased", "cancelled"),         # leaving a terminal state
            ("rejected", "confirmed"),
            ("cancelled", "requested"),
        ],
    )
    def test_illegal_transitions_raise(self, current, target):
        with pytest.raises(InvalidTransition):
            sm.assert_transition(current, target, "supplier")

    def test_unknown_status_is_refused(self):
        with pytest.raises(InvalidTransition):
            sm.assert_transition("requested", "shipped", "supplier")


class TestWhoMayAct:
    """Spec 10.4: the supplier cannot complete their own delivery."""

    def test_supplier_cannot_mark_purchased(self):
        with pytest.raises(Forbidden):
            sm.assert_transition("on_the_way", "purchased", "supplier")

    def test_customer_cannot_confirm_their_own_order(self):
        with pytest.raises(Forbidden):
            sm.assert_transition("requested", "confirmed", "customer")

    def test_customer_cannot_reject_their_own_order(self):
        with pytest.raises(Forbidden):
            sm.assert_transition("requested", "rejected", "customer")

    def test_supplier_cannot_cancel(self):
        with pytest.raises(Forbidden):
            sm.assert_transition("confirmed", "cancelled", "supplier")


class TestManualAdvance:
    """
    Spec 8.3: on a WhatsApp or email order the customer advances stages, because
    the supplier is not in the app. The transition must still be legal.
    """

    def test_customer_may_advance_a_supplier_stage_manually(self):
        sm.assert_transition("confirmed", "processing", "customer", manual=True)

    def test_manual_still_cannot_skip_a_stage(self):
        with pytest.raises(InvalidTransition):
            sm.assert_transition("confirmed", "on_the_way", "customer", manual=True)

    def test_manual_still_cannot_leave_a_terminal_state(self):
        with pytest.raises(InvalidTransition):
            sm.assert_transition("purchased", "processing", "customer", manual=True)


class TestHelpers:
    def test_terminal_states(self):
        assert sm.is_terminal("purchased")
        assert sm.is_terminal("rejected")
        assert sm.is_terminal("cancelled")
        assert not sm.is_terminal("on_the_way")

    def test_next_stage_stops_at_on_the_way(self):
        # Spec 11.3: marking delivered records a timestamp, it does not advance.
        assert sm.next_stage("confirmed") == "processing"
        assert sm.next_stage("put_to_delivery") == "on_the_way"
        assert sm.next_stage("on_the_way") is None

    def test_feed_groupings_cover_every_state_exactly_once(self):
        customer = set(sm.CUSTOMER_REQUESTED) | set(sm.CUSTOMER_CONFIRMED)
        # Spec 8.1: rejected and cancelled are shown on the history screen instead.
        assert customer == sm.ALL_STATES - {"rejected", "cancelled"}

        supplier = set(sm.SUPPLIER_PENDING) | set(sm.SUPPLIER_ACTIVE) | set(sm.SUPPLIER_HISTORY)
        assert supplier == sm.ALL_STATES
