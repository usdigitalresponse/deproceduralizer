#!/usr/bin/env python3
"""
Recover Tier 1 batch results from the Anthropic API and import to DB.

Use when the research pipeline crashes after Tier 1 batch completes but
before results are saved to the database.

Usage:
    cd backend
    python3 -m scripts.research_pipeline.recover_tier1_batch --batch-id msgbatch_XXX
    python3 -m scripts.research_pipeline.recover_tier1_batch --batch-id msgbatch_XXX --dry-run
"""

import argparse
import json
import sys
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

from lib.batch import BatchManager, parse_batch_result_tool_use
from scripts.research_pipeline.ids import parse_custom_id
from scripts.research_pipeline.models.llm_outputs import Tier1Output
from scripts.summarization.db_queries import get_connection

PIPELINE_VERSION = "v5"


def get_existing_tier1(state: str) -> set[tuple[int, str, str]]:
    """Get (document_id, issue_type, source_type) triples that already have Tier 1 results."""
    existing: set[tuple[int, str, str]] = set()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT document_id, guidance_document_id, issue_type
                   FROM compliance_issue_analyses
                   WHERE jurisdiction = %s AND tier1_completed_at IS NOT NULL""",
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
        description="Recover Tier 1 batch results and import to DB"
    )
    parser.add_argument("--batch-id", required=True, help="Anthropic batch ID")
    parser.add_argument("--state", default="NY", help="State code (default: NY)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without importing")
    args = parser.parse_args()

    state = args.state.upper()
    print(f"\n=== RECOVER TIER 1 BATCH: {args.batch_id} ===\n")

    # Step 1: Find what's already saved
    existing = get_existing_tier1(state)
    print(f"Existing Tier 1 results in DB: {len(existing)}")

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
            output = parse_batch_result_tool_use(result, Tier1Output)
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
        # Count classifications
        from collections import Counter
        classifications = Counter(r["output"].classification for r in parsed_results)
        print(f"\n[DRY RUN] Would import {len(parsed_results)} Tier 1 results:")
        for cls, cnt in classifications.most_common():
            print(f"  {cls}: {cnt}")
        return

    # Step 3: Import to DB
    print(f"Importing {len(parsed_results)} Tier 1 results...", flush=True)
    now = datetime.now()
    saved = 0

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

                # Determine ID column (partial unique indexes require WHERE clause)
                if source_type == "guidance":
                    id_col = "guidance_document_id"
                    on_conflict = "ON CONFLICT (guidance_document_id, issue_type) WHERE guidance_document_id IS NOT NULL"
                else:
                    id_col = "document_id"
                    on_conflict = "ON CONFLICT (document_id, issue_type) WHERE document_id IS NOT NULL"

                # Build tier1 data
                tier1_argument_framing = {
                    "best_argument_burdensome": output.best_argument_burdensome,
                    "best_argument_justified": output.best_argument_justified,
                    "best_argument_unrelated": output.best_argument_unrelated,
                }

                tier1_recommendations = {
                    "context_requests": [
                        {
                            "context_type": req.context_type,
                            "identifier": req.identifier,
                            "need_level": req.need_level,
                            "reason": req.reason,
                        }
                        for req in output.context_requests
                    ]
                }

                # Dismissed reasons
                dismissed_reasons = [d.model_dump(by_alias=True) for d in output.dismissed_matches]

                # Count matches from the output
                match_count = len(output.relevant_match_indices) + len(output.dismissed_matches)

                cur.execute(f"""
                    INSERT INTO compliance_issue_analyses (
                        {id_col}, issue_type, jurisdiction, grouped_match_count,
                        tier1_classification, tier1_confidence, tier1_reasoning,
                        tier1_dismissed_reasons,
                        tier1_batch_id, tier1_completed_at,
                        highest_tier_completed,
                        requirement_found,
                        pipeline_version,
                        tier1_argument_framing, tier1_recommendations,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                    )
                    {on_conflict} DO UPDATE SET
                        grouped_match_count = EXCLUDED.grouped_match_count,
                        tier1_classification = EXCLUDED.tier1_classification,
                        tier1_confidence = EXCLUDED.tier1_confidence,
                        tier1_reasoning = EXCLUDED.tier1_reasoning,
                        tier1_dismissed_reasons = EXCLUDED.tier1_dismissed_reasons,
                        tier1_batch_id = EXCLUDED.tier1_batch_id,
                        tier1_completed_at = EXCLUDED.tier1_completed_at,
                        highest_tier_completed = GREATEST(
                            COALESCE(compliance_issue_analyses.highest_tier_completed, 0), 1
                        ),
                        requirement_found = EXCLUDED.requirement_found,
                        tier1_argument_framing = EXCLUDED.tier1_argument_framing,
                        tier1_recommendations = EXCLUDED.tier1_recommendations,
                        updated_at = NOW()
                    RETURNING id
                """, (
                    document_id,
                    issue_type,
                    state,
                    match_count,
                    output.classification,
                    output.confidence,
                    output.reasoning,
                    json.dumps(dismissed_reasons),
                    args.batch_id,
                    now,
                    1,
                    output.classification != "all_false_positives",
                    PIPELINE_VERSION,
                    json.dumps(tier1_argument_framing),
                    json.dumps(tier1_recommendations),
                ))
                # Link analysis back to compliance_issues so the FK is set.
                # NOTE: tier1_relevant_match_ids, tier1_dismissed_match_ids,
                # and tier1_prompt_id cannot be populated from batch results
                # alone — they require the original regex match context that
                # is not preserved in the Anthropic batch response.
                analysis_row = cur.fetchone()
                if analysis_row:
                    saved += 1
                    if source_type == "guidance":
                        cur.execute(
                            """UPDATE compliance_issues SET analysis_id = %s
                               WHERE guidance_document_id = %s AND issue_type = %s
                                 AND analysis_id IS NULL""",
                            (analysis_row[0], document_id, issue_type),
                        )
                    else:
                        cur.execute(
                            """UPDATE compliance_issues SET analysis_id = %s
                               WHERE document_id = %s AND issue_type = %s
                                 AND analysis_id IS NULL""",
                            (analysis_row[0], document_id, issue_type),
                        )

            conn.commit()

    print(f"\nDone! Saved {saved}/{len(parsed_results)} Tier 1 results to database")
    print(f"\nNow run the pipeline to continue to Tier 2/3:")
    print(f"  cd backend && PYTHONUNBUFFERED=1 .venv/bin/python3 -m scripts.research_pipeline.cli \\")
    print(f"    --state ny --source guidance --all-issues --global-limit no-limit --max-tier 3 --execute")


if __name__ == "__main__":
    main()
