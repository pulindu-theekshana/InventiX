"""
Forecast recalculation

Purpose : Weekly. Retrains or refreshes ML predictions and stores results.
Spec    : Section 14
Look here when : Predictions never update.
"""

import logging

from ..ml import forecast, storage

log = logging.getLogger(__name__)


def run() -> None:
    """
    Spec 14 and 7.2. Registered from the start so the schedule is real, but the
    models are phase 10 and there is no sales history to train on yet -- so this
    logs what it would do and returns.

    The reason it is scheduled at all rather than computed on demand: spec 7.2
    requires predictions to be stored, so opening the Reports screen never
    triggers training.
    """
    if not forecast.is_available():
        log.info("forecast_recalc: skipped, models are phase 10 (spec 7.2)")
        return

    written = storage.refresh_all()
    log.info("forecast_recalc: stored %d prediction(s)", written)
