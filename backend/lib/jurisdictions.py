"""Centralized jurisdiction constants and helpers for the backend.

All jurisdiction-related constants should be imported from here to avoid
hardcoded jurisdiction lists scattered across scripts.
"""

import argparse
from typing import Literal

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
