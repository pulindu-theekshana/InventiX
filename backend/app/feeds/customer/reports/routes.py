"""
Reports endpoints

Purpose : HTTP layer for both the plain database reports and the stored machine learning predictions.
Spec    : Section 7
Look here when : A report endpoint fails.
"""

from fastapi import APIRouter

from ....dependencies import CustomerDep
from . import service
from .schemas import ReportSectionOut

router = APIRouter(prefix="/customer/reports", tags=["customer: reports"])


@router.get("", response_model=list[ReportSectionOut])
async def list_sections(user: CustomerDep) -> list[ReportSectionOut]:
    """
    Sections only, with no figures and no charts. Spec 7 builds this feed last,
    and the sections say what has to happen before each can show anything.
    """
    return service.list_sections(user.db, user.id)
