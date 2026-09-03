"""
Job scheduler

Purpose : Registers every scheduled job and its frequency in one place. Started from main.py.
Spec    : Section 14
Look here when : A background job never runs, or runs at the wrong time.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..config import settings
from . import (
    auto_confirm,
    forecast_recalc,
    ranking_recalc,
    seasonal_warnings,
    stale_stock,
    unanswered_orders,
)

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None

# Spec 14, one row per job. Times are deliberately spread rather than all at
# midnight: they read the same tables, and the ranking recompute is the heaviest.
JOBS = [
    ("unanswered_orders", unanswered_orders.run, IntervalTrigger(hours=1)),
    ("auto_confirm", auto_confirm.run, CronTrigger(hour=2, minute=0)),
    ("seasonal_warnings", seasonal_warnings.run, CronTrigger(hour=6, minute=0)),
    ("stale_stock", stale_stock.run, CronTrigger(hour=7, minute=0)),
    ("ranking_recalc", ranking_recalc.run, CronTrigger(hour=3, minute=0)),
    ("forecast_recalc", forecast_recalc.run, CronTrigger(day_of_week="sun", hour=4)),
]


def start() -> None:
    global _scheduler
    if not settings.database_configured:
        # Every job reads the database. Running them without one would be six
        # identical errors an hour drowning out anything real in the log.
        log.warning("scheduler not started: Supabase is not configured")
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Colombo")
    for name, func, trigger in JOBS:
        _scheduler.add_job(
            func, trigger, id=name, name=name,
            # If the server was down when a job was due, run it once on restart
            # rather than skipping the day entirely.
            misfire_grace_time=3600,
            coalesce=True,
            max_instances=1,
        )
    _scheduler.start()
    log.info("scheduler started with %d jobs", len(JOBS))


def shutdown() -> None:
    if _scheduler:
        _scheduler.shutdown(wait=False)


def run_now(job_id: str) -> None:
    """Runs one job immediately. For testing a job without waiting for its hour."""
    for name, func, _ in JOBS:
        if name == job_id:
            func()
            return
    raise KeyError(f"no job called {job_id}")
