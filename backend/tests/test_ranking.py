"""
Ranking tests

Purpose : Proves the weighted formula, the rating-count weighting and the new-supplier neutral default. Run before tuning weights.
Spec    : Section 12
Look here when : Before tuning weights.
"""

from app.domain.ranking import (
    NEUTRAL,
    Candidate,
    availability_component,
    delivery_component,
    is_new_supplier,
    price_component,
    quality_component,
    rank,
)


def supplier(**kw) -> Candidate:
    base = dict(  # noqa: C408 - keyword form reads better for a fixture
        supplier_id="s", average_rating=4.0, rating_count=10,
        measured_delivery_days=3.0, completed_orders=10,
        unit_price=100.0, quantity_available=100,
    )
    base.update(kw)
    return Candidate(**base)


class TestTheNewSupplierProblem:
    """
    Spec 12.2. This is the section the whole file exists for: treating a missing
    rating as zero ranks new suppliers last forever, so they can never earn the
    first order that would give them a rating.
    """

    def test_unrated_supplier_scores_neutral_not_zero(self):
        assert quality_component(None, 0) == NEUTRAL
        assert quality_component(None, 0) > 0

    def test_unmeasured_delivery_scores_neutral_not_zero(self):
        assert delivery_component(None, 1.0, 10.0) == NEUTRAL

    def test_new_supplier_beats_a_genuinely_bad_one(self):
        # A one-star supplier with a track record must rank below an unknown one,
        # or the ranking rewards being bad for long enough to be measured.
        new = quality_component(None, 0)
        bad = quality_component(1.0, 40)
        assert new > bad

    def test_threshold_comes_from_config(self):
        assert is_new_supplier(2, minimum=3)
        assert not is_new_supplier(3, minimum=3)


class TestRatingConfidence:
    """Spec 12.2: one five-star rating must not outrank fifty four-star ones."""

    def test_many_good_ratings_beat_one_perfect_rating(self):
        one_perfect = quality_component(5.0, 1)
        fifty_good = quality_component(4.0, 50)
        assert fifty_good > one_perfect

    def test_confidence_grows_with_count(self):
        assert quality_component(5.0, 50) > quality_component(5.0, 5)
        assert quality_component(5.0, 5) > quality_component(5.0, 1)

    def test_a_perfect_average_never_exceeds_one(self):
        assert quality_component(5.0, 10_000) <= 1.0

    def test_a_worst_average_never_goes_below_zero(self):
        assert quality_component(1.0, 10_000) >= 0.0


class TestAvailability:
    """Spec 9.3: cannot meet the quantity is scored zero, not hidden."""

    def test_cannot_meet_quantity_scores_zero(self):
        assert availability_component(30, 100) == 0.0

    def test_exactly_enough_still_scores(self):
        assert availability_component(100, 100) > 0

    def test_plenty_spare_scores_higher_than_exactly_enough(self):
        assert availability_component(500, 100) > availability_component(100, 100)


class TestPrice:
    def test_cheapest_wins(self):
        assert price_component(100, 100, 200) > price_component(200, 100, 200)

    def test_identical_prices_do_not_divide_by_zero(self):
        assert price_component(100, 100, 100) == 1.0


class TestRanking:
    def test_better_supplier_ranks_first(self, weights):
        good = supplier(supplier_id="good", average_rating=4.8, measured_delivery_days=2.0)
        poor = supplier(supplier_id="poor", average_rating=2.5, measured_delivery_days=9.0)
        ordered = rank([poor, good], weights, requested_quantity=10)
        assert ordered[0][0].supplier_id == "good"

    def test_who_cannot_supply_ranks_lower_but_is_still_returned(self, weights):
        # Spec 9.3: shown but marked, never dropped.
        able = supplier(supplier_id="able", quantity_available=500)
        unable = supplier(supplier_id="unable", quantity_available=5)
        ordered = rank([unable, able], weights, requested_quantity=100)
        assert [c.supplier_id for c, _ in ordered] == ["able", "unable"]
        assert len(ordered) == 2

    def test_scores_are_out_of_one_hundred(self, weights):
        ordered = rank([supplier()], weights, requested_quantity=10)
        assert 0 <= ordered[0][1] <= 100

    def test_empty_input_is_not_an_error(self, weights):
        assert rank([], weights) == []

    def test_quality_outweighs_price(self, weights):
        # Spec 12.1 weights quality at 40 and price at 10, so a much better rated
        # supplier must win despite being the more expensive one.
        dearer_better = supplier(supplier_id="better", average_rating=5.0, unit_price=200.0)
        cheaper_worse = supplier(supplier_id="worse", average_rating=2.0, unit_price=100.0)
        ordered = rank([cheaper_worse, dearer_better], weights, requested_quantity=10)
        assert ordered[0][0].supplier_id == "better"
