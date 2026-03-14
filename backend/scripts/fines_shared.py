"""Shared types, prompt builders, and DB helpers for fines enrichment scripts.

Centralizes code that was duplicated across enrich_fines_activity,
fix_fabricated_quotes, rerun_volume_v2, compare_volume_prompts, and
sample_volume_validation.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field

from lib.db import fetch_rows, chunked_update

# --- Shared type definitions ---

ActivityCategory = Literal[
    "hunting_fishing_wildlife",
    "business_licensing",
    "manufacturing_industrial",
    "healthcare_facility",
    "childcare_provider",
    "professional_licensing",
    "environmental_permit",
    "construction_building",
    "food_service",
    "transportation",
    "cannabis_alcohol",
    "real_estate_housing",
    "education",
    "financial_services",
    "social_services",
    "utilities_telecom",
    "other",
]

VolumeMagnitude = Literal[
    "tens", "hundreds", "thousands", "ten_thousands", "hundred_thousands"
]

VOLUME_BUCKETS = ["tens", "hundreds", "thousands", "ten_thousands", "hundred_thousands"]

VOLUME_ORDER = {
    "tens": 0, "hundreds": 1, "thousands": 2, "ten_thousands": 3, "hundred_thousands": 4,
}


class VolumeEstimate(BaseModel):
    """Volume estimate with reasoning."""
    estimated_annual_payers: Optional[VolumeMagnitude] = Field(
        None,
        description="Order-of-magnitude estimate of annual payers in NY state.",
    )
    volume_reasoning: Optional[str] = Field(
        None,
        description="1-2 sentences explaining the estimate.",
    )


# --- Fabrication detection ---

FABRICATION_PREFIXES = (
    "Establishes ", "This ", "Provides ", "Requires ",
    "Imposes ", "Specifies ", "Allows ",
)


def is_fabricated(quote: Optional[str]) -> bool:
    """Check if a quote looks fabricated (summary, not verbatim)."""
    if not quote:
        return False
    return quote.startswith(FABRICATION_PREFIXES)


# --- V2 volume prompt ---

SYSTEM_PROMPT_V2 = """You estimate how many entities ACTUALLY PAY a specific charge per year in New York State.

CRITICAL DISTINCTION — estimate differently based on charge type:

**FEES (application, renewal, licensing, registration):**
- Estimate how many actually FILE and PAY this specific fee annually.
- Many license types have very few holders. A "Wholesale Beer" license in NY has only
  ~200 holders, not thousands. A "Farm Distillery" license has ~80 holders.
- Sub-types and ancillary fees have FEWER payers than the main license.
- Municipal/county-level fees only apply to that locality, not statewide.

**FINES and PENALTIES (enforcement actions, violations):**
- Estimate how many are ACTUALLY FINED per year — NOT the regulated population.
- Only a small fraction of regulated entities receive fines in any given year.
- A regulation that covers 50,000 businesses might only fine 50-200 per year.
- Disqualification penalties, license revocations, and suspensions are rare events.

**GENUINELY HIGH-VOLUME charges — do NOT underestimate these:**
- Motor vehicle registration/use taxes: millions of vehicles registered in NY
- State/county tax penalties (sales tax, income tax): hundreds of thousands of filers
- Medicaid/Medicare copays and lab fees: millions of beneficiaries
- Universal filing requirements (UCC filings, tax returns): very high volume
- Parking violations in NYC/major cities: millions of tickets per year
- Student fees at large university systems (SUNY): hundreds of thousands of students
These charges legitimately reach "hundred_thousands" or higher. Do not downgrade them.

**COMMON OVERESTIMATION MISTAKES — avoid these:**
- Confusing the total regulated population with actual payers of THIS specific charge
- Assuming a sub-category fee (e.g., "Ancillary fee for Wholesale Beer Retail renewal")
  has as many payers as the main category
- Treating a county/city-specific fee as statewide (UNLESS it's a large county like
  Nassau, Suffolk, or Westchester — these can still be ten_thousands+)
- Estimating fine/penalty volume based on the number who COULD be fined rather than
  the number who ARE fined
- Treating one-time or rare fees (casino applications, nuclear facility permits) as
  if they were routine

Volume scale:
- "tens" = ~10-99/year (niche permits, rare enforcement, one-time fees)
- "hundreds" = ~100-999/year (specialized licenses, moderate enforcement)
- "thousands" = ~1,000-9,999/year (common license renewals, routine fees)
- "ten_thousands" = ~10,000-99,999/year (major license categories, common violations)
- "hundred_thousands" = ~100,000+/year (motor vehicle fees, tax penalties, universal filings)

When uncertain between two adjacent buckets, estimate the LOWER one. But do not
systematically underestimate — use the right bucket for the charge.
Set to null only if truly unknowable."""


# --- Shared prompt builder ---

def build_fines_prompt(
    record: dict,
    include_activity_category: bool = False,
) -> str:
    """Build the user prompt for a fines record, including regulatory context.

    Args:
        record: DB row dict with fines + joined regulatory/guidance fields.
        include_activity_category: If True, include activity_category in prompt
            (used by volume estimation scripts).
    """
    parts = []
    if record.get('penalty_type'):
        parts.append(f"penalty_type: {record['penalty_type']}")
    if record.get('amount'):
        parts.append(f"amount: {record['amount']}")
    if record.get('per_unit'):
        parts.append(f"per_unit: {record['per_unit']}")
    if record.get('who_pays'):
        parts.append(f"who_pays: {record['who_pays'][:100]}")
    if record.get('responsible_agency'):
        parts.append(f"responsible_agency: {record['responsible_agency']}")
    if record.get('violation_description'):
        parts.append(f"violation_description: {record['violation_description'][:300]}")
    if include_activity_category and record.get('activity_category'):
        parts.append(f"activity_category: {record['activity_category']}")

    # Regulatory context
    if record.get('nycrr_part_name'):
        parts.append(f"regulation_part: {record['nycrr_part_name']}")
    if record.get('nycrr_title_name'):
        parts.append(f"regulation_agency: {record['nycrr_title_name']}")
    if record.get('applies_to'):
        applies = record['applies_to']
        if isinstance(applies, list):
            applies = ', '.join(applies)
        parts.append(f"applies_to: {applies}")
    if record.get('doc_summary'):
        parts.append(f"doc_summary: {record['doc_summary'][:300]}")

    # Guidance context
    if record.get('guidance_agency'):
        parts.append(f"guidance_agency: {record['guidance_agency']}")
    if record.get('guidance_summary'):
        parts.append(f"guidance_summary: {record['guidance_summary'][:300]}")

    # Full document text (preferred) or guidance content or context snippet
    doc_content = record.get('doc_content') or ''
    guidance_content = record.get('guidance_content') or ''
    ctx = record.get('context') or ''
    if doc_content:
        parts.append(f"regulation_text: {doc_content[:8000]}")
    elif guidance_content:
        parts.append(f"guidance_text: {guidance_content[:8000]}")
    elif ctx:
        parts.append(f"context: {ctx[:500]}")

    return "\n".join(parts)


# --- Shared DB helpers ---

_FINES_SELECT = """
    SELECT f.id, f.who_pays, f.violation_description, f.penalty_type,
           f.responsible_agency, f.amount, f.amount_min, f.amount_max,
           f.per_unit, f.context, f.activity_category,
           f.estimated_annual_payers, f.justification,
           rd.nycrr_part_name, rd.nycrr_title_name, rd.applies_to,
           rd.summary as doc_summary, rd.content as doc_content,
           gd.agency as guidance_agency, gd.summary as guidance_summary,
           gd.content as guidance_content
    FROM fines_fees_penalties f
    LEFT JOIN regulatory_documents rd ON f.document_id = rd.id
    LEFT JOIN guidance_documents gd ON f.guidance_document_id = gd.id
"""


def fetch_fines_with_context(
    where_clause: str,
    limit: int = 0,
    paginate: bool = False,
    page_size: int = 2000,
) -> list[dict]:
    """Fetch fines records with regulatory + guidance context.

    Args:
        where_clause: SQL WHERE clause (without 'WHERE' keyword).
        limit: Max rows to return (0 = all).
        paginate: If True, fetch in pages to avoid Neon timeouts on large
            result sets with big text columns.
        page_size: Rows per page when paginating.
    """
    if paginate:
        return _fetch_paginated(where_clause, limit, page_size)
    return _fetch_single(where_clause, limit)


def _fetch_single(where_clause: str, limit: int) -> list[dict]:
    """Fetch all rows in a single query."""
    query = f"{_FINES_SELECT} WHERE {where_clause} ORDER BY f.id"
    if limit > 0:
        query += f" LIMIT {limit}"
    return fetch_rows(query)


def _fetch_paginated(where_clause: str, limit: int, page_size: int) -> list[dict]:
    """Fetch rows in pages using keyset pagination to avoid Neon timeouts."""
    all_rows = []
    last_id = 0

    while True:
        query = f"{_FINES_SELECT} WHERE ({where_clause}) AND f.id > %s ORDER BY f.id LIMIT %s"
        page = fetch_rows(query, (last_id, page_size))

        if not page:
            break

        all_rows.extend(page)
        last_id = page[-1]['id']
        print(f"  Fetched {len(all_rows)} rows so far (last_id={last_id})...")

        if limit > 0 and len(all_rows) >= limit:
            all_rows = all_rows[:limit]
            break

    return all_rows


def write_fines_results(results: list[tuple]) -> int:
    """Write activity classification results back to fines_fees_penalties.

    Each tuple: (activity_category, estimated_annual_payers,
                 justification, justification_quote, record_id)
    """
    return chunked_update(
        """UPDATE fines_fees_penalties
           SET activity_category = %s,
               estimated_annual_payers = %s,
               justification = %s,
               justification_quote = %s
           WHERE id = %s""",
        results,
        label="fines classifications",
    )
