"""
File parsing

Purpose : Reads a CSV or Excel export into rows, whatever the POS produced. Owns every date and number format quirk so nothing downstream has to care.
Spec    : Section 6.6
Look here when : A valid file will not parse, or dates and numbers come out wrong.
"""

import hashlib
import io
from dataclasses import dataclass
from datetime import date, datetime

import pandas as pd

from ....core.exceptions import ValidationFailed

MAX_BYTES = 10 * 1024 * 1024

# Sri Lankan POS exports are overwhelmingly day-first. Trying month-first first
# would silently read 03/09 as 9 March and quietly move a month of sales.
DATE_FORMATS = (
    "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d/%m/%y", "%d-%m-%y",
    "%d %b %Y", "%d %B %Y",
)


@dataclass(frozen=True)
class ParsedFile:
    columns: list[str]
    rows: list[dict]
    file_hash: str


def file_hash(content: bytes) -> str:
    """
    Spec 15.4: the hash is what stops the same report being applied twice, and it
    is over the file contents rather than the name -- renaming a file must not
    make it look new.
    """
    return hashlib.sha256(content).hexdigest()


def parse(content: bytes, filename: str) -> ParsedFile:
    if not content:
        raise ValidationFailed("That file is empty.")
    if len(content) > MAX_BYTES:
        raise ValidationFailed("That file is too large. The limit is 10 MB.")

    lower = filename.lower()
    try:
        if lower.endswith((".xlsx", ".xls")):
            frame = pd.read_excel(io.BytesIO(content))
        elif lower.endswith((".csv", ".txt")):
            # POS exports are frequently Latin-1 or have a UTF-8 BOM.
            frame = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        else:
            raise ValidationFailed("Upload a CSV or Excel file exported from your POS.")
    except ValidationFailed:
        raise
    except UnicodeDecodeError:
        frame = pd.read_csv(io.BytesIO(content), encoding="latin-1")
    except Exception as exc:
        raise ValidationFailed(f"We could not read that file: {exc}") from exc

    if frame.empty:
        raise ValidationFailed("That file has no rows in it.")

    frame.columns = [str(c).strip() for c in frame.columns]
    return ParsedFile(
        columns=list(frame.columns),
        rows=frame.to_dict(orient="records"),
        file_hash=file_hash(content),
    )


def to_int(value) -> int | None:
    """
    Quantities arrive as "12", "12.0", " 12 " or "1,200" depending on the POS.
    Returns None rather than guessing when it is none of those.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None


def to_date(value) -> date | None:
    """
    Tries day-first formats before month-first, because a wrong guess here does
    not fail -- it silently files a month of sales under the wrong dates, which
    then trains the forecast.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()  # noqa: DTZ007 - a sale date carries no timezone
        except ValueError:
            continue
    return None
