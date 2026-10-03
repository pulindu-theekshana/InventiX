"""
Forecast recalculation

Purpose : Weekly. Would retrain or refresh stored ML predictions. Does nothing while the model is cheap enough to compute on request.
Spec    : Section 14
Look here when : Predictions never update.
"""

import logging

from ..ml import storage

log = logging.getLogger(__name__)


def run() -> None:
    """
    Spec 14 and 7.2. Registered from the start so the schedule is real.

    The model now exists (ml/forecast.py), so this no longer waits on a phase. It
    is still a no-op, for a different and smaller reason: the model is a weighted
    mean over at most ninety days of one shop's sales rows, which the reports feed
    computes on request in a few milliseconds. Storing that would add a table and
    a staleness question to save nothing.

    Spec 7.2's requirement -- that opening the Reports screen must never trigger
    training -- is still met, because there is no training to trigger. The job
    stays wired because the thing that changes it is a model that is slow enough
    to notice: a weekday effect, or the learned festival uplift in
    ml/seasonal_uplift.py, which does need fitting against past festivals. When
    one of those lands, only ml/storage.py and this file change.
    """
    if not storage.is_worth_storing():
        log.info("forecast_recalc: nothing to store, the model is computed on request (spec 7.2)")
        return

    written = storage.refresh_all()
    log.info("forecast_recalc: stored %d prediction(s)", written)
