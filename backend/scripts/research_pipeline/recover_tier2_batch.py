#!/usr/bin/env python3
"""
Recover Tier 2 batch results from the Anthropic API and import to DB.

Use when the research pipeline crashes after Tier 2 batch completes but
before results are saved to the database. Tier 1 rows must already exist
(run recover_tier1_batch.py first if needed).

Usage:
    cd backend
    python3 -m scripts.research_pipeline.recover_tier2_batch --batch-id msgbatch_XXX --dry-run
    python3 -m scripts.research_pipeline.recover_tier2_batch --batch-id msgbatch_XXX
"""

import argparse
import json
import sys
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

from lib.batch import BatchManager, parse_batch_result_tool_use
from scripts.research_pipeline.ids import parse_custom_id
from scripts.research_pipeline.models.llm_outputs import Tier2Output
from scripts.summarization.db_queries import get_connection

PIPELINE_VERSION = "v5"


def get_existing_tier2(state: str) -> set[tuple[int, str, str]]:
    """Get (document_id, issue_type, source_type) triples that already have Tier 2 results."""
    existing: set[tuple[int, str, str]] = set()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT document_id, guidance_document_id, issue_type
                   FROM compliance_issue_analyses
                   WHERE jurisdiction = %s AND tier2_completed_at IS NOT NULL""",
                [state],
            )
            for row in cur.fetchall():
                doc_id, guidance_id, issue_type = row
                if doc_id is not None:
                    existing.add((doc_id, issue_type, "regulation"))
                if guidance_id is not None:
                    existing.add((guidance_id, issue_type, "guidance"))
    return existing


def main():
    parser = argparse.ArgumentParser(
        description="Recover Tier 2 batch results and import to DB"
    )
    parser.add_argument("--batch-id", required=True, help="Anthropic batch ID")
    parser.add_argument("--state", default="NY", help="State code (default: NY)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without importing")
    args = parser.parse_args()

    state = args.state.upper()
    print(f"\n=== RECOVER TIER 2 BATCH: {args.batch_id} ===\n")

    # Step 1: Find what's already saved
    existing = get_existing_tier2(state)
    print(f"Existing Tier 2 results in DB: {len(existing)}")

    # Step 2: Pull batch results
    bm = BatchManager()

    status = bm.get_batch_status(args.batch_id)
    print(f"Batch status: {status['status']}")
    print(f"  Succeeded: {status['succeeded']}, Errored: {status['errored']}")

    if status['status'] != 'ended':
        print(f"Batch not complete yet. Current status: {status['status']}")
        sys.exit(1)

    print(f"Pulling results from batch {args.batch_id}...", flush=True)

    parsed_results = []
    skipped = 0
    failed = 0

    for result in bm.client.beta.messages.batches.results(args.batch_id):
        custom_id = result.custom_id
        try:
            issue_type, document_id, source_type = parse_custom_id(custom_id)
        except ValueError as e:
            print(f"  SKIPPED: Cannot parse custom_id '{custom_id}': {e}")
            failed += 1
            continue

        # Skip if already saved
        if (document_id, issue_type, source_type) in existing:
            skipped += 1
            continue

        if result.result.type != "succeeded":
            failed += 1
            continue

        try:
            output = parse_batch_result_tool_use(result, Tier2Output)
            if output is None:
                failed += 1
                continue

            parsed_results.append({
                "document_id": document_id,
                "issue_type": issue_type,
                "source_type": source_type,
                "output": output,
            })
        except Exception as e:
            failed += 1
            print(f"  FAILED: {custom_id} - {e}")
            continue

    print(f"\nResults: {len(parsed_results)} to import, {skipped} already saved, {failed} failed")

    if not parsed_results:
        print("Nothing to import.")
        return

    if args.dry_run:
        from collections import Counter
        classifications = Counter(r["output"].classification for r in parsed_results)
        print(f"\n[DRY RUN] Would import {len(parsed_results)} Tier 2 results:")
        for cls, cnt in classifications.most_common():
            print(f"  {cls}: {cnt}")
        return

    # Step 3: Import to DB
    print(f"Importing {len(parsed_results)} Tier 2 results...", flush=True)
    now = datetime.now()
    saved = 0
    no_match = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
            for i, r in enumerate(parsed_results):
                if i % 50 == 0 and i > 0:
                    print(f"  Saved {i}/{len(parsed_results)}...", flush=True)
                    conn.commit()

                output = r["output"]
                document_id = r["document_id"]
                issue_type = r["issue_type"]
                source_type = r["source_type"]

                # Determine FK column and WHERE clause
                if source_type == "guidance":
                    id_col = "guidance_document_id"
                else:
                    id_col = "document_id"

                # Compute derived fields
                requirement_found = output.classification in ('burdensome', 'justified')
                is_justified = output.classification == 'justified'

                # Build context_used from LLM output only (no registry in recovery)
                context_used = []
                if output.context_used:
                    context_used = [
                        c.model_dump(by_alias=True, exclude_none=True)
                        for c in output.context_used
                    ]

                full_text_requests = [
                    r.model_dump(by_alias=True)
                    for r in output.full_text_requests
                ]

                cur.execute(f"""
                    UPDATE compliance_issue_analyses SET
                        tier2_classification = %s,
                        tier2_confidence = %s,
                        tier2_reasoning = %s,
                        verbatim_requirements = %s,
                        severity = %s,
                        severity_baseline = %s,
                        severity_calculation = %s,
                        argument_for_regulation = %s,
                        argument_against_regulation = %s,
                        context_used = %s,
                        tier2_full_text_requests = %s,
                        needs_web_search = %s,
                        web_search_topics = %s,
                        potentially_controversial = %s,
                        federal_mandate_suspected = %s,
                        cites_federal_statute = %s,
                        federal_citation = %s,
                        claims_no_alternative = %s,
                        ambiguity_type = %s,
                        tier2_batch_id = %s,
                        tier2_completed_at = %s,
                        -- NOTE: is_verbatim cannot be checked without original
                        -- document content; defaulting to True.
                        is_verbatim = TRUE,
                        -- Recovery defaults: first run, no re-runs
                        tier2_rerun_count = 0,
                        tier2_context_requests_made = NULL,
                        tier2_forced_classification = NULL,
                        -- V5.2: Web search disambiguation
                        program_context = %s,
                        not_to_confuse_with = %s,
                        search_scope_guidance = %s,
                        -- Affected population
                        primary_affected_population = %s,
                        -- Report utility
                        report_serves_public = %s,
                        report_duplicates_existing = %s,
                        report_frequency_excessive = %s,
                        -- Inline derived fields
                        requirement_found = %s,
                        is_justified = %s,
                        final_severity = %s,
                        -- NOTE: tier2_prompt_id unavailable from batch results
                        classification_tier = 2,
                        highest_tier_completed = GREATEST(
                            COALESCE(highest_tier_completed, 0), 2
                        ),
                        updated_at = NOW()
                    WHERE {id_col} = %s AND issue_type = %s
                """, (
                    output.classification,
                    output.confidence,
                    output.reasoning,
                    output.verbatim_requirements,
                    output.severity,
                    output.severity_baseline,
                    output.severity_calculation,
                    output.argument_for_regulation,
                    output.argument_against_regulation,
                    json.dumps(context_used),
                    json.dumps(full_text_requests),
                    output.needs_web_search,
                    output.web_search_topics,
                    output.potentially_controversial,
                    output.federal_mandate_suspected,
                    output.cites_federal_statute,
                    output.federal_citation,
                    output.claims_no_alternative,
                    output.ambiguity_type,
                    args.batch_id,
                    now,
                    # V5.2 fields
                    getattr(output, 'program_context', None),
                    getattr(output, 'not_to_confuse_with', None) or [],
                    getattr(output, 'search_scope_guidance', None),
                    # Affected population
                    getattr(output, 'primary_affected_population', None),
                    # Report utility
                    getattr(output, 'report_serves_public', None),
                    getattr(output, 'report_duplicates_existing', None),
                    getattr(output, 'report_frequency_excessive', None),
                    # Derived fields
                    requirement_found,
                    is_justified,
                    output.severity,  # final_severity = tier2 severity before tier3
                    # WHERE clause
                    document_id,
                    issue_type,
                ))

                if cur.rowcount == 0:
                    no_match += 1
                    if no_match <= 5:
                        print(f"  WARNING: No Tier 1 row for {source_type} doc_id={document_id}, issue_type={issue_type}")
                else:
                    saved += 1

            conn.commit()

    print(f"\nDone! Saved {saved}/{len(parsed_results)} Tier 2 results to database")
    if no_match > 0:
        print(f"  {no_match} results had no matching Tier 1 row (run recover_tier1_batch.py first)")

    if saved > 0:
        print(f"\nTo continue to Tier 3 for analyses that need web search:")
        print(f"  cd backend && PYTHONUNBUFFERED=1 .venv/bin/python3 -m scripts.research_pipeline.cli \\")
        print(f"    --state {state.lower()} --source guidance --all-issues --global-limit no-limit --tier3-only --execute")


if __name__ == "__main__":
    main()
