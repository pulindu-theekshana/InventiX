"""
Test fixtures

Purpose : Shared fixtures. The domain tests need none of them, which is the point: domain/ has no database and no HTTP, so it can be tested with nothing running.
Spec    : -
Look here when : Tests cannot start.
"""

import sys
from pathlib import Path

import pytest

# So `from app.domain import ...` resolves when pytest is run from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def weights() -> dict[str, float]:
    """The spec 12.1 defaults, matching seeds/app_config.sql."""
    return {"quality": 40, "delivery": 30, "quantity": 20, "price": 10}


class FakeTable:
    """Minimal stand-in for a supabase table query, for config_store only."""

    def __init__(self, rows):
        self._rows = rows

    def select(self, *_):
        return self

    def execute(self):
        return type("Result", (), {"data": self._rows})()


class FakeDB:
    def __init__(self, rows=None):
        self._rows = rows or []

    def table(self, _name):
        return FakeTable(self._rows)


@pytest.fixture
def fake_db():
    return FakeDB
