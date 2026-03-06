"""Centralized jurisdiction constants and helpers for the backend.

All jurisdiction-related constants should be imported from here to avoid
hardcoded jurisdiction lists scattered across scripts.
"""

import argparse
import logging
from typing import Literal

logger = logging.getLogger(__name__)

JurisdictionCode = Literal["NJ", "NY", "NYC"]

VALID_JURISDICTIONS: list[str] = ["NJ", "NY", "NYC"]
VALID_JURISDICTIONS_LOWER: list[str] = [j.lower() for j in VALID_JURISDICTIONS]

# Mapping from jurisdiction to the column prefix used in regulatory_documents
_JURISDICTION_PREFIX_MAP: dict[str, str] = {
    "NJ": "njac",
    "NYC": "rcny",
    "NY": "nycrr",
}


def jurisdiction_prefix(jurisdiction: str) -> str:
    """Return the DB column prefix for a jurisdiction (e.g. 'njac', 'nycrr', 'rcny').

    Used to build column names like f'{prefix}_title', f'{prefix}_section', etc.
    """
    return _JURISDICTION_PREFIX_MAP.get(jurisdiction.upper(), "nycrr")


def title_column_for_jurisdiction(jurisdiction: str) -> str:
    """Return the regulatory_documents title column name for a jurisdiction.

    Examples:
        title_column_for_jurisdiction("NJ")  -> "njac_title"
        title_column_for_jurisdiction("NY")  -> "nycrr_title"
        title_column_for_jurisdiction("NYC") -> "rcny_title"
    """
    return f"{jurisdiction_prefix(jurisdiction)}_title"


# Generic/umbrella names that are government branches, not actual agencies.
# When excluded, the LLM extracts the real agency from regulation text instead.
_EXCLUDED_AGENCY_NAMES = {
    "EXECUTIVE DEPARTMENT",
    "LEGISLATURE",
    "JUDICIAL",
}


def get_title_agency_map(jurisdiction: str) -> dict[str, str]:
    """Build a map from regulation title number to administering agency name.

    Looks at title-level documents in regulatory_documents whose names follow
    the 'tit. N - AGENCY NAME' pattern (all-caps agency names only).

    Args:
        jurisdiction: Jurisdiction code (NY, NJ, NYC)

    Returns:
        Dict mapping title number string -> agency name in title case
    """
    from lib.db import get_db_connection

    conn = get_db_connection()
    if not conn:
        logger.warning("get_title_agency_map: no DB connection, returning empty map for %s", jurisdiction)
        return {}

    prefix = jurisdiction_prefix(jurisdiction)
    try:
        rows = conn.execute(f"""
            SELECT DISTINCT {prefix}_title, title
            FROM regulatory_documents
            WHERE jurisdiction = %s AND hierarchy_level = 'title'
              AND title LIKE %s
        """, (jurisdiction.upper(), '%-%')).fetchall()
        conn.commit()
        conn.close()

        result = {}
        for num, title in rows:
            if num and title and ' - ' in title:
                agency = title.split(' - ', 1)[1].strip()
                # Only use entries that look like official agency names (ALL CAPS)
                if agency == agency.upper() and len(agency) > 5:
                    # Skip generic government branches that aren't real agencies
                    if agency in _EXCLUDED_AGENCY_NAMES:
                        continue
                    result[str(num)] = agency.title()
        return result
    except Exception as e:
        logger.error("Failed to load title→agency map for %s: %s", jurisdiction, e)
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
            conn.close()
        return {}


def agency_for_document(jurisdiction: str, title_num, title_agency_map: dict[str, str] | None = None) -> str | None:
    """Get the responsible agency for a document based on its title number.

    Args:
        jurisdiction: Jurisdiction code
        title_num: The document's title number (e.g., '18' for NYCRR Title 18)
        title_agency_map: Optional pre-built map (avoids repeated DB queries)

    Returns:
        Agency name string, or None if not determinable
    """
    if title_num is None:
        return None
    if title_agency_map is None:
        title_agency_map = get_title_agency_map(jurisdiction)
    return title_agency_map.get(str(title_num))


def jurisdiction_validator(value: str, *, allow_run_all: bool = False) -> str:
    """Validate a jurisdiction CLI argument (case-insensitive, returns lowercase).

    Args:
        value: Raw CLI input
        allow_run_all: If True, also accept 'dangerously-run-all'
    """
    normalized = value.lower()
    valid = VALID_JURISDICTIONS_LOWER + (["dangerously-run-all"] if allow_run_all else [])
    if normalized not in valid:
        raise argparse.ArgumentTypeError(
            f"Invalid jurisdiction '{value}'. Must be one of: {', '.join(valid)}"
        )
    return normalized
