#!/usr/bin/env python3
"""
Recover Tier 3 batch results from the Anthropic API and import to DB.

Use when the research pipeline crashes after Tier 3 batch completes but
before all results are saved to the database.

Usage:
    cd backend
    python3 -m scripts.research_pipeline.recover_tier3_batch --batch-id msgbatch_XXX
    python3 -m scripts.research_pipeline.recover_tier3_batch --batch-id msgbatch_XXX --dry-run
"""

import argparse
import json
import sys
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from lib.batch import BatchManager
from scripts.research_pipeline.ids import parse_custom_id
from scripts.research_pipeline.tiers.web_search import extract_web_search_response
from scripts.research_pipeline.tiers.tier3_runner import _parse_tier3_json_response
from scripts.research_pipeline.result_processor import check_verbatim
from scripts.summarization.db_queries import get_connection


def get_existing_tier3(state: str) -> set[tuple[int, str]]:
    """Get (document_id, issue_type) pairs that already have Tier 3 results."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT document_id, issue_type FROM compliance_issue_analyses
                   WHERE jurisdiction = %s AND tier3_completed_at IS NOT NULL""",
                [state],
            )
            return {(row[0], row[1]) for row in cur.fetchall()}


def get_document_content(doc_ids: list[int]) -> dict[int, str]:
    """Fetch document content for verbatim checking."""
    if not doc_ids:
        return {}
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, content FROM regulatory_documents WHERE id = ANY(%s)",
                [doc_ids],
            )
            return {row[0]: row[1] or "" for row in cur.fetchall()}


def main():
    parser = argparse.ArgumentParser(
        description="Recover Tier 3 batch results and import to DB"
    )
    parser.add_argument("--batch-id", required=True, help="Anthropic batch ID")
    parser.add_argument("--state", default="NY", help="State code (default: NY)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without importing")
    args = parser.parse_args()

    state = args.state.upper()
    print(f"\n=== RECOVER TIER 3 BATCH: {args.batch_id} ===\n")

    # Step 1: Find what's already saved
    existing = get_existing_tier3(state)
    print(f"Existing Tier 3 results in DB: {len(existing)}")

    # Step 2: Pull batch results
    bm = BatchManager()
    print(f"Pulling results from batch {args.batch_id}...", flush=True)

    parsed_results = []
    skipped = 0
    failed = 0

    for result in bm.client.beta.messages.batches.results(args.batch_id):
        custom_id = result.custom_id
        try:
            issue_type, document_id = parse_custom_id(custom_id)
        except ValueError:
            failed += 1
            continue

        # Skip if already saved
        if (document_id, issue_type) in existing:
            skipped += 1
            continue

        if result.result.type != "succeeded":
            failed += 1
            continue

        # Parse the web search response
        try:
            web_response = extract_web_search_response(result.result.message)
            output = _parse_tier3_json_response(
                web_response.text,
                web_response.citations,
                json_data=web_response.json_data,
            )
            if output is None:
                failed += 1
                print(f"  FAILED to parse: {custom_id}")
                continue

            parsed_results.append({
                "document_id": document_id,
                "issue_type": issue_type,
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
        print(f"\n[DRY RUN] Would import {len(parsed_results)} Tier 3 results:")
        for r in parsed_results[:10]:
            o = r["output"]
            print(f"  doc {r['document_id']} ({r['issue_type']}): {o.classification} (conf={o.confidence:.2f})")
        if len(parsed_results) > 10:
            print(f"  ... and {len(parsed_results) - 10} more")
        return

    # Step 3: Fetch document content for verbatim checking
    doc_ids = [r["document_id"] for r in parsed_results]
    print(f"Fetching document content for {len(doc_ids)} docs...", flush=True)
    content_map = get_document_content(doc_ids)

    # Step 4: Import to DB
    print(f"Importing {len(parsed_results)} Tier 3 results...", flush=True)
    now = datetime.now()
    saved = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
            for i, r in enumerate(parsed_results):
                if i % 10 == 0 and i > 0:
                    print(f"  Saved {i}/{len(parsed_results)}...", flush=True)
                    conn.commit()

                output = r["output"]
                document_id = r["document_id"]
                issue_type = r["issue_type"]
                content = content_map.get(document_id, "")

                # Recompute is_verbatim
                is_verbatim = True
                if output.verbatim_requirements:
                    is_verbatim, _ = check_verbatim(output.verbatim_requirements, content)

                # Serialize structured flags
                tier3_flags = {}
                if output.superseded_by_law:
                    tier3_flags["superseded_by_law"] = output.superseded_by_law.model_dump(by_alias=True)
                if output.federal_mandate_confirmed:
                    tier3_flags["federal_mandate_confirmed"] = output.federal_mandate_confirmed.model_dump(by_alias=True)
                if output.state_discretion_found:
                    tier3_flags["state_discretion_found"] = output.state_discretion_found.model_dump(by_alias=True)
                if output.modernized_alternative_found:
                    tier3_flags["modernized_alternative_found"] = output.modernized_alternative_found.model_dump(by_alias=True)
                if output.advocacy_for_change:
                    tier3_flags["advocacy_for_change"] = output.advocacy_for_change.model_dump(by_alias=True)
                tier3_flags["evidence_gap"] = output.evidence_gap

                cur.execute("""
                    UPDATE compliance_issue_analyses SET
                        tier3_classification = %s,
                        tier3_confidence = %s,
                        tier3_reasoning = %s,
                        tier3_severity_adjustment = %s,
                        tier3_severity_adjustment_reasoning = %s,
                        final_severity = %s,
                        verbatim_requirements = %s,
                        is_verbatim = %s,
                        argument_for_regulation = %s,
                        argument_against_regulation = %s,
                        web_search_summary = %s,
                        federal_mandate_found = %s,
                        state_has_discretion = %s,
                        tier3_flags = %s,
                        tier3_evidence_gap = %s,
                        easy_cleanup_candidate = %s,
                        cleanup_type = %s,
                        cleanup_evidence = %s,
                        cleanup_recommendation = %s,
                        cleanup_effort = %s,
                        tier3_completed_at = %s,
                        highest_tier_completed = GREATEST(
                            COALESCE(highest_tier_completed, 0), 3
                        ),
                        updated_at = NOW()
                    WHERE document_id = %s AND issue_type = %s
                """, (
                    output.classification,
                    output.confidence,
                    output.reasoning,
                    output.severity_adjustment,
                    output.severity_adjustment_reasoning,
                    output.final_severity,
                    output.verbatim_requirements,
                    is_verbatim,
                    output.argument_for_regulation,
                    output.argument_against_regulation,
                    output.web_search_summary,
                    output.federal_mandate_found,
                    output.state_has_discretion,
                    json.dumps(tier3_flags),
                    output.evidence_gap,
                    output.easy_cleanup_candidate,
                    output.cleanup_type,
                    output.cleanup_evidence,
                    output.cleanup_recommendation,
                    output.cleanup_effort,
                    now,
                    document_id,
                    issue_type,
                ))
                if cur.rowcount > 0:
                    saved += 1

            conn.commit()

    print(f"\nDone! Saved {saved}/{len(parsed_results)} Tier 3 results to database")


if __name__ == "__main__":
    main()
