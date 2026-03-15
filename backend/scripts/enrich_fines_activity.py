"""Classify fines_fees_penalties by activity category, estimate volume, and justify.

Uses the same categories and prompt validated in the 500-record sample (issue #282).

Usage:
    cd backend
    python3 -m scripts.enrich_fines_activity --dry-run
    python3 -m scripts.enrich_fines_activity --execute --batch
    python3 -m scripts.enrich_fines_activity --backfill-quotes --execute --batch
    python3 -m scripts.enrich_fines_activity --rerun-fabricated --execute --batch
"""

import argparse
from typing import Optional

from pydantic import BaseModel, Field

from lib.enrichment import EnrichmentRunner
from scripts.fines_shared import (
    ActivityCategory,
    FABRICATION_PREFIXES,
    VolumeMagnitude,
    build_fines_prompt,
    fetch_fines_with_context,
    write_fines_results,
)


class ActivityClassification(BaseModel):
    """LLM output for fines activity categorization — matches #282 sample schema."""
    activity_category: Optional[ActivityCategory] = Field(
        None,
        description="Domain/activity category this charge relates to.",
    )
    estimated_annual_payers: Optional[VolumeMagnitude] = Field(
        None,
        description="Order-of-magnitude estimate of annual payers in NY state.",
    )
    volume_reasoning: Optional[str] = Field(
        None,
        description="1 sentence explaining how the volume estimate was derived.",
    )
    justification: Optional[str] = Field(
        None,
        max_length=1000,
        description="What this charge funds and whether cost-recovery vs revenue-generating. MUST include at least one verbatim quote from the regulation text.",
    )
    justification_quote: Optional[str] = Field(
        None,
        description="Exact verbatim quote from the regulation text that explains why this charge exists or what it funds. "
        "Copy word-for-word from the text provided. If no justification language exists in the text "
        "(e.g., it is just a fee schedule with no rationale), set this to null.",
    )


# System prompt from the validated #282 sample
SYSTEM_PROMPT = """You enrich existing fines/fees/penalties records with additional classification fields.

For each record, you will receive:
- penalty_type, amount, who_pays, responsible_agency, violation_description, context
- Additional context when available: regulation part name, title/agency name, who the regulation applies to, document summary

For each record, provide:

1. activity_category: Classify the domain. Must be exactly one of:
   hunting_fishing_wildlife, business_licensing, manufacturing_industrial,
   healthcare_facility, childcare_provider, professional_licensing,
   environmental_permit, construction_building, food_service,
   transportation, cannabis_alcohol, real_estate_housing,
   education, financial_services, social_services, utilities_telecom, other

2. estimated_annual_payers: Order-of-magnitude estimate of how many distinct entities
   ACTUALLY PAY this specific charge per year in New York State.
   For fees (application, renewal, licensing): estimate how many actually file and pay annually.
   For fines/penalties: estimate how many are actually fined per year — NOT the total
   regulated population, but the number who actually incur the penalty.
   - "tens" = ~10-99 (e.g., nuclear facility fines, rare forfeiture actions)
   - "hundreds" = ~100-999 (e.g., hospital fines, niche license applications)
   - "thousands" = ~1,000-9,999 (e.g., liquor license renewals, day care permit fees)
   - "ten_thousands" = ~10,000-99,999 (e.g., all restaurants statewide paying annual fees)
   - "hundred_thousands" = ~100,000+ (e.g., motor vehicle registration fees)
   Use the "applies_to" field (when available) to help estimate the regulated population,
   then adjust for actual payment rates.
   Set to null if you cannot reasonably estimate.

3. volume_reasoning: 1 sentence explaining how you arrived at the volume estimate.
   For example: "~15,000 liquor licensees in NY, all pay annual renewal" or
   "Only a small fraction of the ~5,000 nursing homes get fined annually."

4. justification: 1-2 sentences on what this charge funds/accomplishes and whether it
   appears to be cost-recovery (covers inspection/processing costs) vs revenue-generating
   (exceeds likely administrative costs). If the regulation states a justification, include it.

5. justification_quote: An exact verbatim quote from the regulation text that explains
   why this charge exists or what it funds. Copy word-for-word from the text provided.
   This should be the most relevant sentence or clause explaining the purpose of the charge.
   If the regulation text contains NO justification language (e.g., it is just a fee
   schedule, rate table, or penalty amount with no rationale), set this to null.
   Do NOT fabricate a summary — only provide an actual quote from the text."""


def fetch_unclassified(limit: int = 0) -> list[dict]:
    """Fetch fines records that need activity categorization."""
    return fetch_fines_with_context("f.activity_category IS NULL", limit)


def fetch_missing_quotes(limit: int = 0) -> list[dict]:
    """Fetch fines records that have activity_category but missing justification_quote."""
    return fetch_fines_with_context(
        "f.activity_category IS NOT NULL AND f.justification_quote IS NULL",
        limit,
    )


def fetch_fabricated_quotes(limit: int = 0) -> list[dict]:
    """Fetch fines records where justification_quote looks fabricated (not verbatim)."""
    like_clauses = " OR ".join(
        f"f.justification_quote LIKE '{prefix}%'" for prefix in FABRICATION_PREFIXES
    )
    return fetch_fines_with_context(
        f"f.justification_quote IS NOT NULL AND ({like_clauses}) "
        "AND (f.document_id IS NOT NULL OR f.guidance_document_id IS NOT NULL)",
        limit,
    )


def main():
    parser = argparse.ArgumentParser(description="Classify fines by activity category (#282)")
    parser.add_argument("--execute", action="store_true", help="Write results to DB")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--batch", action="store_true", help="Use batch API (recommended)")
    parser.add_argument("--limit", type=int, default=0, help="Max records (0=all)")
    parser.add_argument(
        "--backfill-quotes", action="store_true",
        help="Re-run on records that have activity_category but missing justification_quote",
    )
    parser.add_argument(
        "--rerun-fabricated", action="store_true",
        help="Re-run on records with fabricated quotes (starts with 'Establishes'/'This') using full doc text",
    )
    parser.add_argument(
        "--resume-batch", nargs="+", metavar="BATCH_ID",
        help="Resume from completed Anthropic batch IDs (skip fetch/submit, just download and write)",
    )
    args = parser.parse_args()

    if args.rerun_fabricated:
        fetch_fn = fetch_fabricated_quotes
        name = "fines_activity_rerun"
    elif args.backfill_quotes:
        fetch_fn = fetch_missing_quotes
        name = "fines_activity_quotes"
    else:
        fetch_fn = fetch_unclassified
        name = "fines_activity"

    runner = EnrichmentRunner(
        name=name,
        response_model=ActivityClassification,
        system_prompt=SYSTEM_PROMPT,
        build_prompt=build_fines_prompt,
        fetch_rows=fetch_fn,
        write_result=lambda row_id, parsed: (
            parsed.activity_category,
            parsed.estimated_annual_payers,
            parsed.justification,
            parsed.justification_quote,
            row_id,
        ),
        write_batch=write_fines_results,
    )

    runner.run(execute=args.execute, batch=args.batch, limit=args.limit,
               resume_batch_ids=args.resume_batch)


if __name__ == "__main__":
    main()
