"""
Upload pipeline tests

Purpose : Proves the parser handles real POS export quirks and that matching is exact. Run after changing the upload pipeline.
Spec    : Section 6.6
Look here when : After changing the upload pipeline.
"""

from datetime import date

import pytest

from app.core.exceptions import ValidationFailed
from app.feeds.customer.uploads import mapping, parser


class TestFileHash:
    """Spec 15.4: the hash is the only thing preventing a double decrement."""

    def test_same_contents_hash_the_same(self):
        assert parser.file_hash(b"a,b\n1,2") == parser.file_hash(b"a,b\n1,2")

    def test_different_contents_hash_differently(self):
        assert parser.file_hash(b"a,b\n1,2") != parser.file_hash(b"a,b\n1,3")

    def test_hash_is_over_contents_not_name(self):
        # Renaming a file must not make it look like a new report.
        content = b"Item Name,Qty Sold,Sale Date\nRice,5,01/09/2026"
        first = parser.parse(content, "september.csv")
        second = parser.parse(content, "september-copy.csv")
        assert first.file_hash == second.file_hash


class TestParsing:
    def test_reads_a_normal_csv(self):
        content = b"Item Name,Qty Sold,Sale Date\nRICE-NADU-5KG,12,01/09/2026\n"
        result = parser.parse(content, "sales.csv")
        assert result.columns == ["Item Name", "Qty Sold", "Sale Date"]
        assert len(result.rows) == 1

    def test_strips_whitespace_from_headers(self):
        result = parser.parse(b" Item Name , Qty \nRice,1\n", "sales.csv")
        assert result.columns == ["Item Name", "Qty"]

    def test_empty_file_is_refused(self):
        with pytest.raises(ValidationFailed):
            parser.parse(b"", "sales.csv")

    def test_unsupported_extension_is_refused(self):
        with pytest.raises(ValidationFailed):
            parser.parse(b"anything", "sales.pdf")

    def test_oversized_file_is_refused(self):
        with pytest.raises(ValidationFailed):
            parser.parse(b"x" * (parser.MAX_BYTES + 1), "sales.csv")


class TestQuantities:
    """A POS writes the same number four different ways."""

    @pytest.mark.parametrize("raw,expected", [
        ("12", 12), (12, 12), ("12.0", 12), (" 12 ", 12), ("1,200", 1200), (12.0, 12),
    ])
    def test_recognised_forms(self, raw, expected):
        assert parser.to_int(raw) == expected

    @pytest.mark.parametrize("raw", ["", "n/a", None, "twelve"])
    def test_unrecognised_returns_none_rather_than_guessing(self, raw):
        assert parser.to_int(raw) is None


class TestDates:
    def test_day_first_is_preferred(self):
        # The important one. 03/09 must be 3 September, not 9 March -- guessing
        # wrong does not fail, it silently files a month of sales under the wrong
        # dates and then trains the forecast on them.
        assert parser.to_date("03/09/2026") == date(2026, 9, 3)

    @pytest.mark.parametrize("raw,expected", [
        ("01/09/2026", date(2026, 9, 1)),
        ("01-09-2026", date(2026, 9, 1)),
        ("2026-09-01", date(2026, 9, 1)),
        ("01 Sep 2026", date(2026, 9, 1)),
    ])
    def test_recognised_formats(self, raw, expected):
        assert parser.to_date(raw) == expected

    @pytest.mark.parametrize("raw", ["", None, "not a date"])
    def test_unrecognised_returns_none(self, raw):
        assert parser.to_date(raw) is None


class TestColumnGuessing:
    def test_guesses_common_headers(self):
        guess = mapping.guess_mapping(["Item Name", "Qty Sold", "Sale Date", "Cashier"])
        assert guess == {"product": "Item Name", "quantity": "Qty Sold", "date": "Sale Date"}

    def test_unknown_headers_guess_nothing_rather_than_wrongly(self):
        guess = mapping.guess_mapping(["Col1", "Col2", "Col3"])
        assert guess == {"product": None, "quantity": None, "date": None}

    def test_never_assigns_one_column_to_two_fields(self):
        guess = mapping.guess_mapping(["Date"])
        assigned = [v for v in guess.values() if v]
        assert len(assigned) == len(set(assigned))


class TestAliasMatching:
    """
    Spec 5.9. Exact by design: a fuzzy match would occasionally decrement the
    wrong product, which is worse than asking once and remembering forever.
    """

    def test_exact_match_resolves(self):
        assert mapping.resolve({"RICE-NADU-5KG": "p1"}, "RICE-NADU-5KG") == "p1"

    def test_surrounding_whitespace_is_ignored(self):
        assert mapping.resolve({"RICE-NADU-5KG": "p1"}, "  RICE-NADU-5KG  ") == "p1"

    def test_near_miss_does_not_resolve(self):
        assert mapping.resolve({"RICE-NADU-5KG": "p1"}, "RICE NADU 5KG") is None

    def test_case_difference_does_not_resolve(self):
        assert mapping.resolve({"RICE-NADU-5KG": "p1"}, "rice-nadu-5kg") is None


class TestUnmatchedSummary:
    def test_counts_occurrences_and_sorts_by_them(self):
        rows = ([{"Item": "A"}] * 3) + ([{"Item": "B"}] * 7)
        result = mapping.unmatched_summary(rows, {}, "Item")
        assert [r["pos_product_name"] for r in result] == ["B", "A"]
        assert result[0]["occurrences"] == 7

    def test_already_mapped_names_are_excluded(self):
        rows = [{"Item": "KNOWN"}, {"Item": "UNKNOWN"}]
        result = mapping.unmatched_summary(rows, {"KNOWN": "p1"}, "Item")
        assert [r["pos_product_name"] for r in result] == ["UNKNOWN"]

    def test_blank_names_are_ignored(self):
        result = mapping.unmatched_summary([{"Item": ""}, {"Item": "  "}], {}, "Item")
        assert result == []
