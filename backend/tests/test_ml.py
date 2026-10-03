"""
Forecast model

Purpose : The demand model in ml/forecast.py: the rate it reads from sales, when it refuses to answer, and the run-out date a shop orders against.
Spec    : Section 7.2
Look here when : A forecast number or a run-out date looks wrong.
"""

from datetime import date, timedelta

from app.ml import forecast


def sales(start: str, days: int, per_day: int, product: str = "p1") -> list[dict]:
    """A product selling at a flat rate, one row per day."""
    first = date.fromisoformat(start)
    return [
        {
            "catalog_product_id": product,
            "quantity_sold": per_day,
            "sale_date": str(first + timedelta(days=i)),
        }
        for i in range(days)
    ]


def shelf(on_hand: int = 100, name: str = "Rice 5kg", low: int = 10) -> dict:
    return {"p1": {"name": name, "quantity_on_hand": on_hand, "low_threshold": low}}


class TestHowMuchHistoryThereIs:
    def test_counts_the_span_not_the_days_that_had_a_sale(self):
        # Sold on two days three weeks apart: twenty-two days of history, not two.
        rows = [
            {"catalog_product_id": "p1", "quantity_sold": 5, "sale_date": "2026-09-01"},
            {"catalog_product_id": "p1", "quantity_sold": 5, "sale_date": "2026-09-22"},
        ]
        assert forecast.days_counted(rows) == 22
        assert forecast.weeks_of_history(rows) == 3

    def test_a_single_day_is_one_day(self):
        assert forecast.days_counted(sales("2026-09-01", 1, 5)) == 1

    def test_no_sales_at_all_is_no_history(self):
        assert forecast.days_counted([]) == 0
        assert forecast.weeks_of_history([]) == 0

    def test_ignores_a_row_with_no_date(self):
        assert forecast.days_counted([{"catalog_product_id": "p1", "quantity_sold": 5}]) == 0


class TestRefusingToAnswer:
    def test_a_week_is_the_least_it_will_speak_on(self):
        assert forecast.has_enough(sales("2026-09-01", 7, 5)) is True
        assert forecast.has_enough(sales("2026-09-01", 6, 5)) is False

    def test_predict_returns_nothing_rather_than_a_number_it_cannot_support(self):
        # The whole point: an owner orders against this, so silence beats a guess.
        assert forecast.predict(sales("2026-09-01", 3, 5)) is None
        assert forecast.predict([]) is None

    def test_predict_answers_once_there_is_enough(self):
        out = forecast.predict(sales("2026-09-01", 28, 10), weeks_ahead=1)
        assert out is not None
        # Ten a day, flat, so a week ahead is about seventy.
        assert out["units"]["p1"] == 70


class TestHowMuchToBelieveIt:
    def test_under_a_month_is_rough(self):
        assert forecast.confidence(sales("2026-09-01", 10, 5)) == forecast.ROUGH

    def test_a_month_is_fair(self):
        assert forecast.confidence(sales("2026-09-01", 28, 5)) == forecast.FAIR

    def test_eight_weeks_is_good_which_is_the_spec_bar(self):
        rows = sales("2026-09-01", forecast.MIN_WEEKS_OF_HISTORY * 7, 5)
        assert forecast.confidence(rows) == forecast.GOOD

    def test_says_how_many_weeks_are_still_missing(self):
        out = forecast.forecast(sales("2026-09-01", 14, 5), shelf())
        assert out.weeks_counted == 2
        assert out.weeks_until_good == forecast.MIN_WEEKS_OF_HISTORY - 2

    def test_never_asks_for_more_weeks_once_it_has_them(self):
        rows = sales("2026-09-01", 200, 5)
        assert forecast.forecast(rows, shelf()).weeks_until_good == 0


class TestTheRate:
    def test_a_flat_seller_reads_at_its_flat_rate(self):
        # The weighting must not distort a product that has not changed.
        out = forecast.forecast(sales("2026-09-01", 30, 4), shelf())
        assert out.products[0].units_per_day == 4.0

    def test_a_quiet_day_counts_as_a_zero_not_as_a_missing_day(self):
        # Ten units on day one, nothing for nine days. Averaging over the days that
        # had a sale would call this ten a day and reorder ten times too much.
        rows = [{"catalog_product_id": "p1", "quantity_sold": 10, "sale_date": "2026-09-01"},
                {"catalog_product_id": "p1", "quantity_sold": 0, "sale_date": "2026-09-10"}]
        assert forecast.forecast(rows, shelf()).products[0].units_per_day < 2.0

    def test_recent_weeks_weigh_more_than_old_ones(self):
        # Nothing for a fortnight, then five a day for a fortnight. A flat average
        # would say 2.5; this must read closer to what the product is doing now.
        quiet = [{"catalog_product_id": "p1", "quantity_sold": 0, "sale_date": str(date(2026, 9, 1) + timedelta(days=i))}
                 for i in range(14)]
        busy = sales("2026-09-15", 14, 5)
        rate = forecast.forecast(quiet + busy, shelf()).products[0].units_per_day
        assert 2.5 < rate < 5.0

    def test_a_product_returned_more_than_it_sold_has_no_demand(self):
        # Migration 0027 allows a negative quantity for a return. A negative rate
        # would produce a run-out date in the past.
        rows = sales("2026-09-01", 10, 1) + [
            {"catalog_product_id": "p1", "quantity_sold": -40, "sale_date": "2026-09-10"},
        ]
        assert forecast.forecast(rows, shelf()).products[0].units_per_day == 0.0

    def test_a_product_that_never_sold_is_still_listed(self):
        # Worst sellers are a report of their own; dropping it would hide it.
        out = forecast.forecast(sales("2026-09-01", 30, 5, product="other"), shelf())
        assert [p.catalog_product_id for p in out.products] == ["p1"]
        assert out.products[0].units_per_day == 0.0
        assert out.products[0].units_sold == 0

    def test_an_unmatched_upload_line_belongs_to_no_product(self):
        rows = sales("2026-09-01", 10, 5) + [
            {"catalog_product_id": None, "quantity_sold": 99, "sale_date": "2026-09-05"},
        ]
        assert forecast.forecast(rows, shelf()).products[0].units_sold == 50


class TestWhenItRunsOut:
    def test_turns_a_rate_and_a_shelf_into_a_date(self):
        out = forecast.forecast(sales("2026-09-01", 30, 5), shelf(on_hand=50),
                                today=date(2026, 10, 1))
        product = out.products[0]
        assert product.days_of_cover == 10.0
        assert product.runs_out_on == date(2026, 10, 11)

    def test_a_product_going_nowhere_gets_no_date(self):
        out = forecast.forecast([], {"p1": {"name": "Rice", "quantity_on_hand": 50}})
        assert out.products[0].days_of_cover is None
        assert out.products[0].runs_out_on is None

    def test_a_year_of_cover_is_not_reported_as_a_date(self):
        out = forecast.forecast(sales("2026-09-01", 30, 1), shelf(on_hand=5000))
        assert out.products[0].days_of_cover == 5000.0
        # Arithmetic, not a forecast -- so the number is given and the date is not.
        assert out.products[0].runs_out_on is None

    def test_running_out_this_week_is_urgent(self):
        out = forecast.forecast(sales("2026-09-01", 30, 10), shelf(on_hand=30))
        assert out.products[0].is_urgent is True

    def test_a_month_of_cover_is_not_urgent(self):
        out = forecast.forecast(sales("2026-09-01", 30, 1), shelf(on_hand=30))
        assert out.products[0].is_urgent is False

    def test_the_soonest_to_run_out_comes_first(self):
        rows = sales("2026-09-01", 30, 10, product="fast") + sales("2026-09-01", 30, 1, product="slow")
        products = {
            "slow": {"name": "Slow", "quantity_on_hand": 100},
            "fast": {"name": "Fast", "quantity_on_hand": 20},
            "dead": {"name": "Dead", "quantity_on_hand": 5},
        }
        out = forecast.forecast(rows, products)
        # Dead last: a product that cannot run out is not a reorder decision.
        assert [p.catalog_product_id for p in out.products] == ["fast", "slow", "dead"]

    def test_a_shop_closed_for_a_week_is_not_a_week_of_no_demand(self):
        # The window ends at the last sale, not at today. Measuring to today would
        # dilute every rate by however long ago the shop last billed anything.
        rows = sales("2026-09-01", 30, 5)
        to_last_sale = forecast.forecast(rows, shelf(), today=date(2026, 9, 30))
        a_week_later = forecast.forecast(rows, shelf(), today=date(2026, 10, 7))
        assert to_last_sale.products[0].units_per_day == a_week_later.products[0].units_per_day


class TestTheDirection:
    def test_a_product_picking_up_is_rising(self):
        rows = sales("2026-09-01", 7, 2) + sales("2026-09-08", 7, 10)
        assert forecast.forecast(rows, shelf()).products[0].trend == "rising"

    def test_a_product_dropping_off_is_falling(self):
        rows = sales("2026-09-01", 7, 10) + sales("2026-09-08", 7, 2)
        assert forecast.forecast(rows, shelf()).products[0].trend == "falling"

    def test_a_flat_product_is_steady(self):
        assert forecast.forecast(sales("2026-09-01", 20, 5), shelf()).products[0].trend == "steady"

    def test_one_extra_packet_does_not_count_as_a_direction(self):
        # A tenth either way before it will speak, or the arrow flips on noise.
        rows = sales("2026-09-01", 7, 10) + sales("2026-09-08", 7, 10)
        rows[-1]["quantity_sold"] = 11
        assert forecast.forecast(rows, shelf()).products[0].trend == "steady"

    def test_under_a_fortnight_it_will_not_guess_a_direction(self):
        rows = sales("2026-09-01", 4, 1) + sales("2026-09-05", 4, 20)
        assert forecast.forecast(rows, shelf()).products[0].trend == "steady"


class TestTheSuggestedThreshold:
    def test_covers_a_week_plus_the_supplier_s_wait(self):
        # Five a day, and a supplier that takes three days: twelve days of cover.
        out = forecast.forecast(sales("2026-09-01", 30, 5), shelf(), lead_times={"p1": 3})
        assert out.products[0].suggested_threshold == 5 * (7 + 3)

    def test_says_nothing_before_a_fortnight_of_history(self):
        # domain/thresholds owns that rule; this only has to not invent its own.
        out = forecast.forecast(sales("2026-09-01", 10, 5), shelf())
        assert out.products[0].suggested_threshold is None
