"""
Ranking recalculation

Purpose : Daily. Recomputes and stores supplier scores so search does not compute them live.
Spec    : Section 14
Look here when : Rankings are stale after new ratings.
"""

import logging

from ..core.supabase import service_client

log = logging.getLogger(__name__)


def run() -> None:
    """
    Spec 14. The work is one call: recompute_supplier_ranking() aggregates every
    order and rating in the system, which belongs in the database rather than
    pulled into Python to be averaged.

    Spec 14 requires this to be precomputed precisely so a supplier search does
    not trigger that aggregate.
    """
    db = service_client()
    result = db.rpc("recompute_supplier_ranking", {}).execute()
    log.info("ranking_recalc: rewrote %s supplier row(s)", result.data)
