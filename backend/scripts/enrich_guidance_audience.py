"""Backfill audience classification for guidance documents that already have summaries.

Classifies: audience_direction, audience_expertise, audience_explanation, target_audience.
Uses the same categories and prompt validated in the 500-record sample (issue #281).

Usage:
    cd backend
    python3 -m scripts.enrich_guidance_audience --dry-run
    python3 -m scripts.enrich_guidance_audience --execute --batch
"""

import argparse
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from lib.db import fetch_rows, chunked_update
from lib.enrichment import EnrichmentRunner

# --- Types from summarize.py ---

AudienceDirection = Literal["public", "government", "both"]
AudienceExpertise = Literal["lay", "specialized", "mixed"]
TargetAudience = Literal[
    "families",
    "prospective_providers",
    "existing_providers",
    "government_internal",
    "local_district_staff",
    "general_public",
    "healthcare_providers",
    "childcare_providers",
    "legal_practitioners",
    "licensed_professionals",
    "small_businesses",
    "nonprofits",
    "educators",
]

GOV_TAGS = {"government_internal", "local_district_staff"}
PUBLIC_TAGS = {
    "families", "prospective_providers", "existing_providers",
    "general_public", "healthcare_providers", "childcare_providers",
    "legal_practitioners", "licensed_professionals", "small_businesses",
    "nonprofits", "educators",
}


class AudienceClassification(BaseModel):
    """LLM output for guidance audience classification — matches #281 sample schema."""
    target_audience: list[TargetAudience] = Field(
        default_factory=list,
        description=(
            "1-3 tags for the PRIMARY audience. Pick the most specific tag that fits. "
            "Choose from: families, prospective_providers, existing_providers, "
            "government_internal, local_district_staff, general_public, "
            "healthcare_providers, childcare_providers, legal_practitioners, "
            "licensed_professionals, small_businesses, nonprofits, educators."
        ),
    )
    audience_direction: AudienceDirection = Field(
        ...,
        description=(
            "MUST be consistent with target_audience tags. "
            "'public' = ALL tags are public-facing; "
            "'government' = ALL tags are government; "
            "'both' = tags include BOTH government AND public-facing audiences."
        ),
    )
    audience_expertise: AudienceExpertise = Field(
        ...,
        description=(
            "'lay' = plain language throughout; "
            "'specialized' = assumes domain knowledge, uses jargon; "
            "'mixed' = ONLY if document has distinct sections at different levels."
        ),
    )
    audience_explanation: str = Field(
        ...,
        description="1-2 sentences: WHO is this for and WHY.",
    )

    @model_validator(mode='after')
    def validate_direction_consistency(self) -> 'AudienceClassification':
        """Auto-fix direction/tag inconsistencies."""
        tags = set(self.target_audience)
        gov_tags = tags & GOV_TAGS
        pub_tags = tags & PUBLIC_TAGS

        if gov_tags and pub_tags:
            self.audience_direction = "both"
        elif gov_tags and not pub_tags:
            self.audience_direction = "government"
        elif pub_tags and not gov_tags:
            self.audience_direction = "public"
        return self


SYSTEM_PROMPT = """You classify the audience of New York State guidance documents.

These are sub-regulatory documents (ADMs, LCMs, INFs, GIS, DALs, directives, etc.) — they interpret, implement, or supplement regulations but do NOT have the force of law.

You will receive: the document's agency, type, title, summary, applies_to, and a content excerpt.

## target_audience: pick 1-3 tags (rarely 4+)

Choose the MOST SPECIFIC tag that fits. Prefer specific over general. Only tag audiences the document DIRECTLY addresses, not everyone who might find it useful.

- "families" = parents/public seeking childcare or social services
- "prospective_providers" = people looking to start offering regulated services
- "existing_providers" = current licensed/registered providers
- "government_internal" = central agency staff (NOT local districts)
- "local_district_staff" = county/local district workers (DSS, health depts)
- "general_public" = broad audience not fitting ANY specific category above — use sparingly
- "healthcare_providers" = doctors, nurses, hospitals, clinics
- "childcare_providers" = day care centers, family day care, group homes (use INSTEAD of existing_providers when the domain is childcare)
- "legal_practitioners" = attorneys, compliance officers
- "licensed_professionals" = people holding professional licenses (non-healthcare, non-legal)
- "small_businesses" = small business owners affected by regulations
- "nonprofits" = nonprofit organizations
- "educators" = teachers, school administrators, training program operators

Tag selection rules:
- Do NOT tag both childcare_providers and existing_providers for the same doc — pick the more specific one
- Do NOT tag general_public alongside specific public tags (families, small_businesses, etc.)
- Tag legal_practitioners ONLY if the document discusses legal analysis, litigation, or statutory interpretation

## audience_direction: must be CONSISTENT with your tags

- "public" = ALL your target_audience tags are public-facing
- "government" = ALL your target_audience tags are government
- "both" = tags include at least one government tag AND at least one public-facing tag

## audience_expertise: commit to ONE level

- "lay" = plain language throughout, terms are defined
- "specialized" = assumes domain knowledge, uses jargon without explanation
- "mixed" = ONLY use when document has clearly distinct sections at different levels

## audience_explanation

Write 1-2 sentences: WHO is this for and WHY. Must be consistent with direction and tags."""


def fetch_unclassified(limit: int = 0) -> list[dict]:
    """Fetch guidance docs with summaries but no audience classification."""
    query = """
        SELECT id, agency, doc_type, title, summary, applies_to,
               distribution_to, policy_category,
               LEFT(content, 2000) as content_excerpt
        FROM guidance_documents
        WHERE summary IS NOT NULL
          AND audience_direction IS NULL
        ORDER BY random()
    """
    if limit > 0:
        query += f" LIMIT {limit}"
    return fetch_rows(query)


def build_prompt(record: dict) -> str:
    """Build the user prompt for a single guidance document."""
    parts = []
    if record.get('agency'):
        parts.append(f"agency: {record['agency']}")
    if record.get('doc_type'):
        parts.append(f"doc_type: {record['doc_type']}")
    if record.get('title'):
        parts.append(f"title: {record['title'][:200]}")
    if record.get('distribution_to'):
        parts.append(f"distribution_to: {record['distribution_to'][:200]}")
    if record.get('summary'):
        parts.append(f"summary: {record['summary'][:500]}")
    if record.get('applies_to'):
        applies = record['applies_to']
        if isinstance(applies, list):
            applies = ', '.join(applies)
        parts.append(f"applies_to: {str(applies)[:300]}")
    if record.get('content_excerpt'):
        parts.append(f"content_excerpt: {record['content_excerpt'][:1500]}")
    return "\n".join(parts)


def write_results(results: list[tuple]) -> int:
    """Write audience classifications back to DB."""
    return chunked_update(
        """UPDATE guidance_documents
           SET target_audience = %s,
               audience_direction = %s,
               audience_expertise = %s,
               audience_explanation = %s
           WHERE id = %s""",
        results,
        label="audience classifications",
    )


def main():
    parser = argparse.ArgumentParser(description="Classify guidance doc audiences (#281)")
    parser.add_argument("--execute", action="store_true", help="Write results to DB")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--batch", action="store_true", help="Use batch API (recommended)")
    parser.add_argument("--limit", type=int, default=0, help="Max records (0=all)")
    parser.add_argument(
        "--resume-batch", nargs="+", metavar="BATCH_ID",
        help="Resume from completed Anthropic batch IDs (skip fetch/submit, just download and write)",
    )
    args = parser.parse_args()

    runner = EnrichmentRunner(
        name="guidance_audience",
        response_model=AudienceClassification,
        system_prompt=SYSTEM_PROMPT,
        build_prompt=build_prompt,
        fetch_rows=fetch_unclassified,
        write_result=lambda row_id, parsed: (
            parsed.target_audience,
            parsed.audience_direction,
            parsed.audience_expertise,
            parsed.audience_explanation,
            row_id,
        ),
        write_batch=write_results,
    )
    runner.run(execute=args.execute, batch=args.batch, limit=args.limit,
               resume_batch_ids=args.resume_batch)


if __name__ == "__main__":
    main()
