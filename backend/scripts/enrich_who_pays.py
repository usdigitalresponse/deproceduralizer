"""Normalize fines_fees_penalties.who_pays via LLM multiclass classification.

Reads records with unclassified who_pays, classifies each into one of 15
normalized categories, and writes results back to the DB.

Usage:
    cd backend
    python3 -m scripts.enrich_who_pays --dry-run        # preview without DB writes
    python3 -m scripts.enrich_who_pays --execute         # run and write to DB
    python3 -m scripts.enrich_who_pays --execute --batch # use batch API (cheaper)
"""

import argparse
from typing import Literal

from pydantic import BaseModel, Field

from lib.db import fetch_rows, chunked_update
from lib.enrichment import EnrichmentRunner

# --- Categories ---

WhoPaysCategory = Literal[
    "licensed_or_permitted",
    "applicant",
    "individual_or_household",
    "vehicle_or_vessel_operator",
    "business_or_corporation",
    "insurance_or_financial",
    "service_provider_or_operator",
    "healthcare_or_care_facility",
    "violator_or_respondent",
    "property_owner",
    "government_entity",
    "employer_or_employee",
    "student_or_educational",
    "taxpayer",
    "other",
]

CATEGORY_DESCRIPTIONS = {
    "licensed_or_permitted": "Holds a license, permit, certificate, or registration (e.g., licensee, permittee, registrant, certified professional)",
    "applicant": "Applying for a license, permit, benefit, or service (e.g., applicant, petitioner)",
    "individual_or_household": "General individual, person, resident, household member, or benefit recipient (e.g., any person, SNAP recipient, household member, inmate)",
    "vehicle_or_vessel_operator": "Operates or owns a vehicle, vessel, or aircraft (e.g., driver, vehicle owner, vessel operator, pilot)",
    "business_or_corporation": "Business entity, corporation, manufacturer, dealer, distributor, or retailer",
    "insurance_or_financial": "Insurance, banking, or financial entity (e.g., insurer, policyholder, broker-dealer, lender, trust)",
    "service_provider_or_operator": "Provides services or operates a facility/program (e.g., provider, operator, contractor, sponsor)",
    "healthcare_or_care_facility": "Healthcare provider, medical facility, childcare/daycare, or care facility operator",
    "violator_or_respondent": "Person or entity cited/charged for a regulatory violation (e.g., respondent in enforcement action, violator, defendant). NOT for parties in fee disputes or administrative hearings.",
    "property_owner": "Owns or manages real property (e.g., owner, landlord, homeowner, tenant)",
    "government_entity": "Government body, agency, municipality, or public authority",
    "employer_or_employee": "In an employment relationship (e.g., employer, employee, worker)",
    "student_or_educational": "Student, school, educational institution, or university",
    "taxpayer": "Taxpayer or tax-related entity (e.g., taxpayer, tax preparer)",
    "other": "Does not fit any of the above categories",
}


class WhoPaysClassification(BaseModel):
    """LLM output for who_pays normalization."""
    category: WhoPaysCategory = Field(
        ...,
        description="The normalized category for who pays this fine/fee/penalty.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence in the classification (0.0-1.0).",
    )


SYSTEM_PROMPT = """You classify who pays a regulatory fine, fee, or penalty into a normalized category.

Categories:
{categories}

Rules:
- Choose the MOST SPECIFIC category that fits. E.g., "licensed physician" → licensed_or_permitted, not healthcare_or_care_facility.
- When who_pays lists MULTIPLE entity types (e.g., "charitable organization, professional fund raiser, or professional solicitor"), classify based on the FIRST/primary entity listed.
- Generic "person" or "any person" → individual_or_household, UNLESS the who_pays text itself contains words like "violating", "respondent", or "defendant".
- violator_or_respondent is ONLY for enforcement contexts: someone cited, fined, or charged for a violation. Parties to a dispute resolution, fee proceeding, or administrative hearing are NOT violators — classify by their actual role instead.
- "carrier" is ambiguous: insurance/health plan carrier → insurance_or_financial; freight/transportation carrier → business_or_corporation. Use the violation_description and responsible_agency to disambiguate.
- If the who_pays text describes someone applying for something, use "applicant" even if they're also a licensee.
- Use "other" only when no category fits at all.
- ALWAYS use the violation_description, penalty_type, and responsible_agency as context — these resolve most ambiguity.
""".format(
    categories="\n".join(
        f"- {cat}: {desc}" for cat, desc in CATEGORY_DESCRIPTIONS.items()
    )
)


def fetch_unclassified(limit: int = 0) -> list[dict]:
    """Fetch fines records that need who_pays normalization."""
    query = """
        SELECT id, who_pays, violation_description, penalty_type, responsible_agency
        FROM fines_fees_penalties
        WHERE who_pays IS NOT NULL
          AND who_pays != ''
          AND who_pays_normalized IS NULL
        ORDER BY id
    """
    if limit > 0:
        query += f" LIMIT {limit}"
    return fetch_rows(query)


def build_prompt(record: dict) -> str:
    """Build the user prompt for a single record."""
    parts = [f"who_pays: {record['who_pays']}"]
    if record.get('violation_description'):
        parts.append(f"violation_description: {record['violation_description'][:200]}")
    if record.get('penalty_type'):
        parts.append(f"penalty_type: {record['penalty_type']}")
    if record.get('responsible_agency'):
        parts.append(f"responsible_agency: {record['responsible_agency']}")
    return "\n".join(parts)


def write_results(results: list[tuple[int, str]]) -> int:
    """Write normalized categories back to DB."""
    return chunked_update(
        "UPDATE fines_fees_penalties SET who_pays_normalized = %s WHERE id = %s",
        results,
        label="who_pays classifications",
    )


def main():
    parser = argparse.ArgumentParser(description="Normalize who_pays field in fines_fees_penalties")
    parser.add_argument("--execute", action="store_true", help="Write results to DB (default: dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes (default)")
    parser.add_argument("--batch", action="store_true", help="Use batch API instead of realtime")
    parser.add_argument("--limit", type=int, default=0, help="Max records to process (0=all)")
    args = parser.parse_args()

    runner = EnrichmentRunner(
        name="who_pays_normalized",
        response_model=WhoPaysClassification,
        system_prompt=SYSTEM_PROMPT,
        build_prompt=build_prompt,
        fetch_rows=fetch_unclassified,
        write_result=lambda row_id, parsed: (parsed.category, row_id),
        write_batch=write_results,
    )
    runner.run(execute=args.execute, batch=args.batch, limit=args.limit)


if __name__ == "__main__":
    main()
