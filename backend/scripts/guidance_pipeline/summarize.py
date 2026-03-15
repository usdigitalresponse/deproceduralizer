"""Summarize guidance documents using Haiku batch API.

Single-phase summarization (no hierarchy) with cited regulation summaries
as context. Extracts structured metadata for each guidance document:
summary, document_purpose, keywords, applies_to, target_audience,
audience_direction, audience_expertise, audience_explanation,
is_application, has_form, and has_incorporation_by_reference.
"""

import json
import time
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from lib.batch import BatchManager, format_batch_request
from lib.db import get_db_connection
from scripts.research_pipeline.context.guidance_context import (
    fetch_cited_document_summaries,
    build_guidance_batch_context,
)

BATCH_MODEL = "claude-haiku-4-5-20251001"
MAX_CONTENT_CHARS = 80_000  # Truncate very long docs

# Document purpose categories (replaces section_type for guidance)
DocumentPurpose = Literal[
    "policy_directive",    # Establishes or changes policy
    "informational",       # Communicates information, no new policy
    "procedural",          # Step-by-step instructions or processes
    "compliance",          # Compliance requirements or interpretations
    "advisory",            # Non-binding recommendations
    "legal_interpretation",  # Formal or informal legal opinion / statutory analysis
    "application_form",    # Application or form instructions
    "reference",           # Reference material, compendium, manual
    "other",
]

# Audience direction: who is this aimed at?
AudienceDirection = Literal["public", "government", "both"]

# Audience expertise level
AudienceExpertise = Literal["lay", "specialized", "mixed"]

# Target audience controlled vocabulary (expanded from original 5)
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


class GuidanceSummaryResponse(BaseModel):
    """Structured response for guidance document summarization."""

    summary: str = Field(
        ...,
        description=(
            "3-5 sentence summary (80-120 words). START with the action/effect "
            "(e.g., 'Directs...', 'Informs...', 'Establishes...'), not 'This document'."
        ),
    )
    document_purpose: DocumentPurpose = Field(
        ...,
        description=(
            "Primary purpose: policy_directive, informational, procedural, "
            "compliance, advisory, legal_interpretation, application_form, reference, other."
        ),
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="3-5 searchable terms covering key concepts, programs, or subjects.",
    )
    applies_to: list[str] = Field(
        default_factory=list,
        description=(
            "Who must comply or is affected: e.g., 'child care providers', "
            "'local districts', 'day care centers', 'parents'."
        ),
    )
    target_audience: list[TargetAudience] = Field(
        default_factory=list,
        description=(
            "1-3 tags for the PRIMARY audience. Pick the most specific tag that fits. "
            "Only use 4+ tags if the document genuinely addresses multiple distinct groups. "
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
            "'public' = ALL tags are public-facing (families, providers, general_public, etc.); "
            "'government' = ALL tags are government (government_internal, local_district_staff); "
            "'both' = tags include BOTH government AND public-facing audiences. "
            "Use 'both' ONLY when the document explicitly addresses both groups."
        ),
    )
    audience_expertise: AudienceExpertise = Field(
        ...,
        description=(
            "Pick ONE level based on how the document is WRITTEN, not who reads it. "
            "'lay' = plain language, avoids jargon, explains terms; "
            "'specialized' = assumes domain knowledge, uses technical/legal terminology without explanation; "
            "'mixed' = ONLY if document has distinct sections written at different levels (e.g., a plain-language summary followed by technical appendix)."
        ),
    )
    audience_explanation: str = Field(
        ...,
        description=(
            "1-2 sentence explanation of who this document is for and why. "
            "E.g., 'Instructs local district commissioners on implementing new SNAP "
            "eligibility rules — primary audience is county DSS staff, secondary "
            "audience is SNAP applicants affected by the policy change.'"
        ),
    )
    is_application: bool = Field(
        default=False,
        description="True if the document is an application form or application process guide.",
    )
    has_form: bool = Field(
        default=False,
        description="True if the document references or contains a specific form.",
    )
    has_incorporation_by_reference: bool = Field(
        default=False,
        description="True if the document incorporates external non-governmental standards (ASTM, NFPA, etc.).",
    )

    @model_validator(mode="after")
    def check_audience_consistency(self) -> "GuidanceSummaryResponse":
        """Enforce tag mutual exclusion and direction/tag consistency."""
        tags = set(self.target_audience)
        gov_tags = tags & {"government_internal", "local_district_staff"}
        pub_tags = tags - {"government_internal", "local_district_staff"}

        # Tag overlap: childcare_providers and existing_providers are mutually exclusive
        if "childcare_providers" in tags and "existing_providers" in tags:
            raise ValueError(
                "childcare_providers and existing_providers are mutually exclusive — pick the more specific one"
            )

        # Tag overlap: general_public shouldn't appear alongside specific public tags
        if "general_public" in tags and (pub_tags - {"general_public"}):
            raise ValueError(
                "general_public should not appear alongside specific public tags like "
                f"{pub_tags - {'general_public'}} — pick the specific tags instead"
            )

        # Direction must match tags
        if self.audience_direction == "public" and gov_tags and not pub_tags:
            raise ValueError(
                f"direction='public' but all tags are government: {list(tags)}"
            )
        if self.audience_direction == "government" and pub_tags and not gov_tags:
            raise ValueError(
                f"direction='government' but all tags are public-facing: {list(tags)}"
            )

        return self


SYSTEM_PROMPT = """You are a guidance document analyzer for New York State agencies. For each guidance document, provide structured metadata.

These are sub-regulatory documents (ADMs, LCMs, INFs, GIS, DALs, directives, etc.) — they interpret, implement, or supplement regulations but do NOT have the force of law by themselves.

When summarizing:
- START with the action or effect, not "This document" or "This memo"
- Capture the PURPOSE, specific requirements/guidance, and who is affected
- Include specific dates, dollar amounts, or program names when present
- For form-only documents: describe what the form is for
- For superseded documents: note the supersession

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
- Tag legal_practitioners ONLY if the document discusses legal analysis, litigation, or statutory interpretation — not just because it cites regulations

## audience_direction: must be CONSISTENT with your tags

- "public" = use when ALL your target_audience tags are public-facing (families, providers, general_public, small_businesses, etc.)
- "government" = use when ALL your target_audience tags are government (government_internal, local_district_staff)
- "both" = use ONLY when your tags include at least one government tag AND at least one public-facing tag

IMPORTANT: If your audience_explanation describes a government audience, your direction MUST be "government" or "both", not "public".

## audience_expertise: commit to ONE level

Most government guidance documents ARE specialized — they assume regulatory familiarity. That's fine. Pick "specialized" confidently when the document uses technical or legal terminology without explaining it.

- "lay" = plain language throughout, terms are defined, written so a member of the public could understand
- "specialized" = assumes domain knowledge, uses jargon/regulatory references without explanation
- "mixed" = ONLY use when the document has clearly distinct sections at different levels (e.g., a plain-language cover letter with a technical attachment). Do NOT use "mixed" just because a specialized document mentions the public.

## audience_explanation

Write 1-2 sentences: WHO is this for and WHY. Your explanation must be consistent with your direction and tags. If you say "directed at county DSS staff", your direction must be "government" and your tags must include local_district_staff.

## document_purpose

- "policy_directive" = establishes or changes policy (ADMs typically)
- "informational" = communicates information without new policy (INFs typically)
- "procedural" = step-by-step instructions
- "compliance" = compliance requirements or regulatory interpretations
- "advisory" = non-binding recommendations or opinions
- "legal_interpretation" = formal or informal legal opinion, statutory analysis (AG opinions, counsel memos)
- "application_form" = application forms or application guides
- "reference" = reference material, manuals, compilations
- "other" = none of the above fit
"""


def _build_user_prompt(doc: dict, cited_context: str) -> str:
    """Build the per-document user prompt."""
    parts = []

    # Metadata header
    parts.append("=== DOCUMENT METADATA ===")
    if doc.get("canonical_ref"):
        parts.append(f"Reference: {doc['canonical_ref']}")
    parts.append(f"Title: {doc['title']}")
    parts.append(f"Agency: {doc['agency']}")
    if doc.get("doc_type"):
        parts.append(f"Document type: {doc['doc_type']}")
    if doc.get("domain"):
        parts.append(f"Domain: {doc['domain']}")
    if doc.get("date_published"):
        parts.append(f"Date published: {doc['date_published']}")
    if doc.get("distribution_to"):
        dist = doc["distribution_to"]
        if isinstance(dist, list):
            parts.append(f"Distribution to: {', '.join(dist)}")
        else:
            parts.append(f"Distribution to: {dist}")
    if doc.get("policy_category"):
        parts.append(f"Policy category: {doc['policy_category']}")

    # Cited regulation context
    if cited_context and cited_context != "(no cited regulations resolved)":
        parts.append("\n=== CITED REGULATIONS (summaries) ===")
        parts.append(cited_context)

    # Document content
    content = doc.get("content", "")
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS] + "\n\n[... content truncated ...]"

    parts.append("\n=== DOCUMENT CONTENT ===")
    parts.append(content)

    return "\n".join(parts)


def fetch_documents_to_summarize(
    agency: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """Fetch guidance documents that need summarization."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        conditions = [
            "content IS NOT NULL",
            "LENGTH(content) > 100",
            "summary IS NULL",
            "COALESCE(policy_category, '') NOT IN ('data_dump', 'non_policy')",
            "COALESCE(is_attachment, false) = false",
        ]
        params: list = []

        if agency:
            conditions.append("agency = %s")
            params.append(agency)

        where = " AND ".join(conditions)
        limit_clause = ""
        if limit:
            limit_clause = "LIMIT %s"
            params.append(limit)

        cur.execute(
            f"""
            SELECT id, canonical_ref, title, agency, doc_type, domain,
                   date_published, distribution_to, policy_category, content
            FROM guidance_documents
            WHERE {where}
            ORDER BY id
            {limit_clause}
            """,
            params,
        )

        docs = []
        for row in cur.fetchall():
            docs.append({
                "id": row[0],
                "canonical_ref": row[1],
                "title": row[2],
                "agency": row[3],
                "doc_type": row[4],
                "domain": row[5],
                "date_published": str(row[6]) if row[6] else None,
                "distribution_to": row[7],
                "policy_category": row[8],
                "content": row[9],
            })

        return docs
    finally:
        conn.close()


def prepare_batch(
    docs: list[dict],
    output_dir: Path,
) -> tuple[list[dict], Path]:
    """Prepare batch requests for guidance summarization.

    Returns (requests, batch_dir).
    """
    doc_ids = [d["id"] for d in docs]
    cited_summaries = fetch_cited_document_summaries(doc_ids)

    requests = []
    for doc in docs:
        doc_id = doc["id"]
        cited = cited_summaries.get(doc_id, [])
        cited_context = build_guidance_batch_context(doc_id, cited)

        user_prompt = _build_user_prompt(doc, cited_context)

        request = format_batch_request(
            custom_id=f"guidance_{doc_id}",
            prompt=user_prompt,
            response_format=GuidanceSummaryResponse,
            model=BATCH_MODEL,
            system=SYSTEM_PROMPT,
            max_tokens=64000,
        )
        requests.append(request)

    # Write requests to file
    batch_dir = output_dir / f"guidance_{time.strftime('%Y%m%d_%H%M%S')}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    requests_file = batch_dir / "requests.json"
    with open(requests_file, "w") as f:
        json.dump(requests, f)

    print(f"  Prepared {len(requests)} requests in {batch_dir}")
    return requests, batch_dir


def _update_doc_in_db(cur, doc_id: int, parsed: dict) -> None:
    """Write a single parsed result to the database."""
    # For guidance docs, section_type stores document purpose (e.g., 'policy directive',
    # 'informational letter'); for regulations, it stores structural type (e.g.,
    # 'requirements', 'procedures').
    cur.execute(
        """
        UPDATE guidance_documents SET
            summary = %s,
            section_type = %s,
            keywords = %s,
            applies_to = %s,
            has_form = %s,
            has_ibr = %s,
            target_audience = %s,
            is_application = %s,
            audience_direction = %s,
            audience_expertise = %s,
            audience_explanation = %s
        WHERE id = %s
        """,
        (
            parsed["summary"],
            parsed.get("document_purpose", "other"),
            parsed.get("keywords", []),
            parsed.get("applies_to", []),
            parsed.get("has_form", False),
            parsed.get("has_incorporation_by_reference", False),
            parsed.get("target_audience", []),
            parsed.get("is_application", False),
            parsed.get("audience_direction"),
            parsed.get("audience_expertise"),
            parsed.get("audience_explanation"),
            doc_id,
        ),
    )


def import_results(results_file: Path, dry_run: bool = True) -> int:
    """Import summarization results into guidance_documents.

    Validates each result against the Pydantic model. Results that fail
    validation are collected and returned as doc IDs for escalation.

    Args:
        results_file: Path to results JSON from batch processing.
        dry_run: If True, report stats without writing to DB.

    Returns:
        Number of documents updated.
    """
    with open(results_file) as f:
        results = json.load(f)

    print(f"  Loaded {len(results)} results from {results_file}")

    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        updated = 0
        errors = 0
        validation_failures: list[int] = []

        for result in results:
            custom_id = result.get("custom_id", "")
            doc_id = int(custom_id.replace("guidance_", ""))

            # Parse the response
            response = result.get("result", {})
            message = response.get("message", {})

            # Extract tool_use result
            parsed = _parse_tool_use(message)
            if not parsed.get("summary"):
                errors += 1
                if errors <= 5:
                    print(f"    WARNING: No summary for doc {doc_id}")
                continue

            # Track validation failures for escalation
            if parsed.get("_validation_error"):
                validation_failures.append(doc_id)
                if len(validation_failures) <= 5:
                    print(f"    VALIDATION: doc {doc_id}: {parsed['_validation_error']}")

            if dry_run:
                if updated < 5:
                    vflag = " [VALIDATION FAILED]" if parsed.get("_validation_error") else ""
                    print(f"    [{doc_id}]{vflag} {parsed['summary'][:80]}...")
                    print(f"      purpose={parsed.get('document_purpose')} audience={parsed.get('target_audience')}")
                updated += 1
                continue

            _update_doc_in_db(cur, doc_id, parsed)
            updated += 1

            if updated % 100 == 0:
                conn.commit()
                print(f"    Updated {updated}...")

        conn.commit()
        cur.close()

        if dry_run:
            print(f"\n  [DRY RUN] Would update {updated} docs ({errors} errors, {len(validation_failures)} validation failures)")
        else:
            print(f"\n  Updated {updated} docs ({errors} errors, {len(validation_failures)} validation failures)")

        if validation_failures:
            print(f"  Validation failure doc IDs: {validation_failures[:20]}{'...' if len(validation_failures) > 20 else ''}")

        return updated
    finally:
        conn.close()


ESCALATION_MODEL = "claude-sonnet-4-5-20241022"


def escalate_validation_failures(
    doc_ids: list[int],
    dry_run: bool = True,
) -> int:
    """Re-run validation-failed docs with Sonnet via realtime API.

    Called after import_results when batch Haiku results have tag/direction
    rule violations.
    """
    if not doc_ids:
        return 0

    from lib.llm import get_anthropic_client, call_llm_parse

    print(f"\n  Escalating {len(doc_ids)} validation failures to {ESCALATION_MODEL}...")

    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        # Fetch doc content for re-processing
        cur.execute(
            """
            SELECT id, canonical_ref, title, agency, doc_type, domain,
                   date_published, distribution_to, policy_category, content
            FROM guidance_documents
            WHERE id = ANY(%s)
            """,
            (doc_ids,),
        )
        docs = []
        for row in cur.fetchall():
            docs.append({
                "id": row[0], "canonical_ref": row[1], "title": row[2],
                "agency": row[3], "doc_type": row[4], "domain": row[5],
                "date_published": str(row[6]) if row[6] else None,
                "distribution_to": row[7], "policy_category": row[8],
                "content": row[9],
            })

        cited_summaries = fetch_cited_document_summaries([d["id"] for d in docs])
        client = get_anthropic_client()
        fixed = 0
        still_failed = 0

        for i, doc in enumerate(docs):
            doc_id = doc["id"]
            cited = cited_summaries.get(doc_id, [])
            cited_context = build_guidance_batch_context(doc_id, cited)
            user_prompt = _build_user_prompt(doc, cited_context)

            if len(user_prompt) > 80_000:
                user_prompt = user_prompt[:80_000] + "\n\n[... truncated ...]"

            parsed = call_llm_parse(
                client=client,
                prompt=user_prompt,
                response_format=GuidanceSummaryResponse,
                model=ESCALATION_MODEL,
                system=SYSTEM_PROMPT,
                max_tokens=64000,
                max_retries=2,
            )

            if parsed is None:
                still_failed += 1
                print(f"    [{i+1}/{len(docs)}] doc {doc_id}: Sonnet also failed")
                continue

            result = parsed.model_dump()
            result["has_incorporation_by_reference"] = result.pop("has_incorporation_by_reference", False)

            if not dry_run:
                _update_doc_in_db(cur, doc_id, result)
                if fixed % 20 == 0 and fixed > 0:
                    conn.commit()

            fixed += 1
            print(f"    [{i+1}/{len(docs)}] doc {doc_id}: fixed ✓")

        conn.commit()
        cur.close()

        if dry_run:
            print(f"\n  [DRY RUN] Would fix {fixed}/{len(docs)} docs ({still_failed} still failed)")
        else:
            print(f"\n  Fixed {fixed}/{len(docs)} docs ({still_failed} still failed)")

        return fixed
    finally:
        conn.close()


def _parse_tool_use(message: dict) -> dict:
    """Extract and validate structured fields from a batch API tool_use response.

    Returns a dict with parsed fields. If the model_validator fails (tag rule
    violations), sets '_validation_error' key so callers can escalate.
    """
    content = message.get("content", [])
    for block in content:
        if block.get("type") == "tool_use":
            input_data = block.get("input", {})
            try:
                validated = GuidanceSummaryResponse.model_validate(input_data)
                result = validated.model_dump()
                # Remap field name for DB compatibility
                result["has_incorporation_by_reference"] = result.pop("has_incorporation_by_reference", False)
                return result
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("Pydantic validation failed: %s", e)
                # Extract raw fields but mark as validation failure
                result = {}
                result["summary"] = input_data.get("summary", "")
                result["document_purpose"] = input_data.get("document_purpose", "other")
                result["keywords"] = input_data.get("keywords", [])
                result["applies_to"] = input_data.get("applies_to", [])
                valid_audiences = set(GuidanceSummaryResponse.model_fields["target_audience"].annotation.__args__[0].__args__)
                raw_audience = input_data.get("target_audience", [])
                result["target_audience"] = [a for a in raw_audience if a in valid_audiences]
                result["audience_direction"] = input_data.get("audience_direction")
                result["audience_expertise"] = input_data.get("audience_expertise")
                result["audience_explanation"] = input_data.get("audience_explanation")
                result["is_application"] = input_data.get("is_application", False)
                result["has_form"] = input_data.get("has_form", False)
                result["has_incorporation_by_reference"] = input_data.get("has_incorporation_by_reference", False)
                result["_validation_error"] = str(e)
                return result
    return {}


def run_summarization(
    agency: Optional[str] = None,
    limit: Optional[int] = None,
    dry_run: bool = True,
    output_dir: Optional[Path] = None,
) -> None:
    """Run the full guidance summarization pipeline.

    Fetches docs, prepares batch, submits, polls, processes results, imports.
    """
    if output_dir is None:
        output_dir = Path(__file__).parent.parent.parent / "summaries_staging" / "guidance"

    print("Fetching documents to summarize...")
    docs = fetch_documents_to_summarize(agency=agency, limit=limit)
    print(f"  Found {len(docs)} documents needing summarization")

    if not docs:
        print("  Nothing to summarize.")
        return

    # Show distribution
    from collections import Counter
    by_agency = Counter(d["agency"] for d in docs)
    print("\n  By agency:")
    for ag, cnt in sorted(by_agency.items(), key=lambda x: -x[1])[:10]:
        print(f"    {ag}: {cnt}")

    by_type = Counter(d["doc_type"] for d in docs)
    print("\n  By doc_type:")
    for dt, cnt in sorted(by_type.items(), key=lambda x: -x[1])[:10]:
        print(f"    {dt}: {cnt}")

    if dry_run:
        print(f"\n  [DRY RUN] Would submit {len(docs)} documents for summarization")
        print(f"  Estimated cost: ~${len(docs) * 0.0005:.2f} (Haiku batch)")
        return

    # Prepare and submit batch
    print("\nPreparing batch requests...")
    requests, batch_dir = prepare_batch(docs, output_dir)

    print("\nSubmitting batch to API...")
    manager = BatchManager(batches_dir=batch_dir)
    batch_id = manager.submit_batch(requests)
    print(f"  Batch submitted: {batch_id}")
    print(f"  Requests: {len(requests)}")

    # Poll until complete
    print("\nPolling for results...")
    manager.poll_until_complete(batch_id)

    # Process results
    results_file = batch_dir / "results.json"
    if results_file.exists():
        print("\nImporting results...")
        import_results(results_file, dry_run=False)
    else:
        print(f"\n  WARNING: No results file at {results_file}")
        print("  Check batch status manually.")
