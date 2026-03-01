#!/usr/bin/env python3
"""
Recover completed batch results from the Anthropic API and import to DB.

Use when batch submissions succeeded but the pipeline stalled before
polling/processing/importing results. Pulls results directly from the API
for documents that are missing summaries.

Usage:
    cd backend
    python3 -m scripts.summarization.recover_batches --state NY
    python3 -m scripts.summarization.recover_batches --state NY --title 1
    python3 -m scripts.summarization.recover_batches --state NY --dry-run
"""

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from lib.batch import BatchManager
from scripts.summarization.db_queries import get_connection
from scripts.summarization.import_summaries import (
    batch_update_summaries,
    extract_summary_data,
)
from scripts.summarization.runner import _parse_tool_use_result


def get_unsummarized_doc_ids(state: str, title: int | None = None) -> set[int]:
    """Get IDs of documents missing summaries."""
    query = """
        SELECT id FROM regulatory_documents
        WHERE jurisdiction = %s AND exclude_from_analysis = false AND summary IS NULL
    """
    params = [state]
    if title:
        query += " AND nycrr_title = %s"
        params.append(title)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return {row[0] for row in cur.fetchall()}


def get_citation_map(doc_ids: list[int]) -> dict[int, str]:
    """Get citations for a list of document IDs."""
    if not doc_ids:
        return {}
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, citation FROM regulatory_documents WHERE id = ANY(%s)",
                [doc_ids],
            )
            return {row[0]: row[1] for row in cur.fetchall()}


def main():
    parser = argparse.ArgumentParser(
        description="Recover completed batch results and import to DB"
    )
    parser.add_argument("--state", required=True, help="State code (e.g., NY)")
    parser.add_argument("--title", type=int, help="Filter to specific NYCRR title")
    parser.add_argument("--dry-run", action="store_true", help="Preview without importing")
    parser.add_argument("--limit", type=int, default=100, help="Max batches to scan (default: 100)")
    args = parser.parse_args()

    state = args.state.upper()

    print(f"\n=== RECOVER BATCHES: {state}" + (f" Title {args.title}" if args.title else "") + " ===\n")

    # Step 1: Find unsummarized docs
    missing_ids = get_unsummarized_doc_ids(state, args.title)
    print(f"Documents missing summaries: {len(missing_ids)}")

    if not missing_ids:
        print("Nothing to recover!")
        return

    # Step 2: Scan completed batches from the API (with pagination)
    bm = BatchManager()
    print(f"Scanning batches from Anthropic API (limit={args.limit})...", flush=True)

    ended_batches = []
    page = bm.client.beta.messages.batches.list(limit=min(args.limit, 100))
    scanned = 0
    while True:
        for b in page.data:
            if b.processing_status == "ended" and b.request_counts.succeeded > 0:
                ended_batches.append(b)
            scanned += 1
            if scanned >= args.limit:
                break
        if scanned >= args.limit or not page.has_more:
            break
        page = page.get_next_page()
    print(f"Found {len(ended_batches)} completed batches with results (scanned {scanned})")

    # Step 3: Pull results for docs we need
    recovered = []
    batches_used = 0
    docs_found = set()

    for batch in ended_batches:
        if not missing_ids - docs_found:
            break  # All missing docs found

        batch_has_matches = False
        try:
            results_iter = bm.client.beta.messages.batches.results(batch.id)
        except Exception:
            continue  # Batch results expired or unavailable

        for result in results_iter:
            try:
                doc_id = int(result.custom_id.replace("doc_", ""))
            except (ValueError, AttributeError):
                continue

            if doc_id in missing_ids and doc_id not in docs_found:
                if result.result.type == "succeeded":
                    parsed = _parse_tool_use_result(result.result.message)
                    if parsed["summary"]:
                        recovered.append({
                            "document_id": doc_id,
                            **parsed,
                        })
                        docs_found.add(doc_id)
                        batch_has_matches = True

        if batch_has_matches:
            batches_used += 1
            remaining = len(missing_ids) - len(docs_found)
            print(f"  {batch.id}: found {len(docs_found)} docs so far ({remaining} remaining)", flush=True)

    print(f"\nRecovered {len(recovered)} results from {batches_used} batches")

    still_missing = missing_ids - docs_found
    if still_missing:
        print(f"Still missing: {len(still_missing)} docs (no completed batch results found)")

    if not recovered:
        print("Nothing to import.")
        return

    # Step 4: Import to DB
    if args.dry_run:
        print(f"\n[DRY RUN] Would import {len(recovered)} summaries:")
        for r in recovered[:5]:
            print(f"  doc {r['document_id']}: {r.get('section_type', '?')} - {r.get('summary', '')[:60]}...")
        if len(recovered) > 5:
            print(f"  ... and {len(recovered) - 5} more")
        return

    print(f"\nImporting {len(recovered)} summaries to database...", flush=True)
    updates = []
    for r in recovered:
        data = extract_summary_data(r)
        if data and data["summary"]:
            updates.append(data)

    if updates:
        with get_connection() as conn:
            updated = batch_update_summaries(conn, updates)
        print(f"Updated {updated} documents in database")
    else:
        print("No valid summaries to import")


if __name__ == "__main__":
    main()
