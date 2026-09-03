"""
Reports models

Purpose : Response shapes for each report type.
Spec    : Section 7
Look here when : A chart on the phone cannot read the report data.
"""

from pydantic import BaseModel


class ReportSectionOut(BaseModel):
    """
    Metadata only. Spec 7 builds this feed last because a report needs history to
    report on, and there is none until the other feeds have been in use. The
    screens render each section with an empty state explaining what has to happen
    first, rather than a chart of nothing.
    """

    key: str
    title: str
    description: str
    icon: str
    # What has to exist before this section can say anything.
    requires: str
    available: bool = False
