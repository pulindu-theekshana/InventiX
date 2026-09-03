"""
Prediction storage

Purpose : Writes and reads stored predictions so screens never trigger training.
Spec    : Section 7.2
Look here when : A screen is slow because it is computing predictions live.
"""

# Spec 7.2: "Predictions are computed on a schedule and stored, not computed live
# on every screen open, so the mobile application only ever reads a stored
# result." This file is that boundary.
#
# ponytail: no ml_predictions table yet. Its shape depends on what the models in
# phase 10 actually output -- per product, per week, per shop, with a confidence
# or without -- and guessing that now would mean a migration to correct it later.
# jobs/forecast_recalc.py is already scheduled and calls refresh_all(), so the
# wiring exists and only this file changes.

import logging

log = logging.getLogger(__name__)


def refresh_all() -> int:
    """Recomputes and stores every prediction. Returns how many were written."""
    log.info("ml storage: nothing to refresh, models are phase 10 (spec 7.2)")
    return 0


def read(customer_id: str, kind: str) -> list[dict]:
    """
    What the Reports feed calls. Returns empty rather than raising, so a screen
    shows its empty state instead of an error.
    """
    return []
