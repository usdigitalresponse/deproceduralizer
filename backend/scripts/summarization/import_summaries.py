#!/usr/bin/env python3
"""
Import AI-generated summaries and metadata into the regulatory_documents table.

This script reads the processed batch results from summaries_staging and updates
the database with summary, section_type, keywords, applies_to, has_form, and has_ibr.

Usage:
    python3 import_summaries.py --state NJ [--dry-run] [--batch-size 500]
"""

import argparse
import json
import sys
import time
from pathlib import Path

import psycopg

from .db_queries import get_connection


def find_all_results_files(state: str, staging_dir: Path) -> list[Path]:
    """
    Find all results.json files for a state.

    Args:
        state: State code (e.g., 'NJ')
        staging_dir: Path to summaries_staging directory

    Returns:
        List of paths to results.json files
    """
    state_dir = staging_dir / state / "batch"
    if not state_dir.exists():
        raise FileNotFoundError(f"State batch directory not found: {state_dir}")

    results_files = list(state_dir.glob("*/results.json"))
    return sorted(results_files)


def load_results(results_file: Path) -> list[dict]:
    """Load and parse a results.json file."""
    with open(results_file, "r") as f:
        return json.load(f)


def extract_summary_data(result: dict) -> dict | None:
    """
    Extract summary metadata from a result entry.

    Returns:
        Dict with document_id and metadata fields, or None if missing required data
    """
    doc_id = result.get("document_id")
    if not doc_id:
        return None

    # Get fields - handle both old and new format
    summary = result.get("summary")
    section_type = result.get("section_type")
    keywords = result.get("keywords", [])
    applies_to = result.get("applies_to", [])
    has_form = result.get("has_form", False)

    # Handle field name difference: has_incorporation_by_reference -> has_ibr
    has_ibr = result.get("has_incorporation_by_reference", result.get("has_ibr", False))

    # Ensure arrays are lists
    if not isinstance(keywords, list):
        keywords = []
    if not isinstance(applies_to, list):
        applies_to = []

    return {
        "document_id": doc_id,
        "summary": summary,
        "section_type": section_type[:50] if section_type else section_type,
        "keywords": keywords,
        "applies_to": applies_to,
        "has_form": bool(has_form),
        "has_ibr": bool(has_ibr),
    }


def to_pg_array(arr: list) -> str:
    """Convert Python list to PostgreSQL array literal."""
    if not arr:
        return "{}"
    # Escape and quote each element
    escaped = []
    for item in arr:
        if item is None:
            escaped.append("NULL")
        else:
            # Escape backslashes and double quotes
            s = str(item).replace("\\", "\\\\").replace('"', '\\"')
            escaped.append(f'"{s}"')
    return "{" + ",".join(escaped) + "}"


def batch_update_summaries(
    conn: psycopg.Connection,
    updates: list[dict],
    dry_run: bool = False,
    max_retries: int = 5,
) -> int:
    """
    Batch update regulatory_documents with summary metadata.

    Args:
        conn: Database connection
        updates: List of dicts with document_id and metadata fields
        dry_run: If True, don't commit changes
        max_retries: Max retry attempts per chunk on deadlock

    Returns:
        Number of rows updated
    """
    if not updates:
        return 0

    # PostgreSQL has a 65535 parameter limit. With 7 params per row,
    # we can fit ~9000 rows per batch. Use 5000 for safety.
    CHUNK_SIZE = 5000
    total_updated = 0

    for i in range(0, len(updates), CHUNK_SIZE):
        chunk = updates[i:i + CHUNK_SIZE]

        placeholders = []
        params = []

        for u in chunk:
            placeholders.append("(%s, %s, %s, %s::text[], %s::text[], %s, %s)")
            params.extend([
                u["document_id"],
                u["summary"],
                u["section_type"],
                to_pg_array(u["keywords"]),
                to_pg_array(u["applies_to"]),
                u["has_form"],
                u["has_ibr"],
            ])

        query = f"""
            UPDATE regulatory_documents AS rd
            SET
                summary = v.summary,
                section_type = v.section_type,
                keywords = v.keywords,
                applies_to = v.applies_to,
                has_form = v.has_form,
                has_ibr = v.has_ibr
            FROM (VALUES {", ".join(placeholders)}) AS v(
                doc_id,
                summary,
                section_type,
                keywords,
                applies_to,
                has_form,
                has_ibr
            )
            WHERE rd.id = v.doc_id::bigint
        """

        for attempt in range(max_retries):
            try:
                conn.rollback()
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    total_updated += cur.rowcount
                if not dry_run:
                    conn.commit()
                break
            except psycopg.errors.DeadlockDetected:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt + time.time() % 1
                    print(f"  Deadlock on chunk {i // CHUNK_SIZE + 1}, retrying in {wait:.1f}s (attempt {attempt + 2}/{max_retries})")
                    time.sleep(wait)
                else:
                    raise

    return total_updated


def format_eta(seconds: float) -> str:
    """Format seconds as human-readable time."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        return f"{seconds / 60:.1f}m"
    else:
        return f"{seconds / 3600:.1f}h"


def main():
    parser = argparse.ArgumentParser(
        description="Import AI-generated summaries into the database"
    )
    parser.add_argument(
        "--state",
        required=True,
        help="State code (e.g., NJ)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without committing",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Number of records per batch update (default: 500)",
    )
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=Path(__file__).parent.parent.parent / "summaries_staging",
        help="Path to summaries_staging directory",
    )

    args = parser.parse_args()
    state = args.state.upper()

    print(f"\n=== IMPORT SUMMARIES: {state} ===\n")

    # Find all results files
    try:
        results_files = find_all_results_files(state, args.staging_dir)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    print(f"Found {len(results_files)} results files")

    if not results_files:
        print("No results files to process")
        sys.exit(0)

    # Load all results
    print("Loading results...")
    all_updates = []
    files_loaded = 0

    for results_file in results_files:
        results = load_results(results_file)
        for result in results:
            data = extract_summary_data(result)
            if data and data["summary"]:  # Only include entries with summaries
                all_updates.append(data)
        files_loaded += 1
        if files_loaded % 10 == 0:
            print(f"  Loaded {files_loaded}/{len(results_files)} files ({len(all_updates)} records)")

    print(f"\nTotal records to update: {len(all_updates)}")

    if args.dry_run:
        print("\n[DRY RUN] Would update the following:")
        # Show sample
        for i, u in enumerate(all_updates[:5]):
            print(f"  - Doc {u['document_id']}: {u['section_type']} - {u['summary'][:60]}...")
        if len(all_updates) > 5:
            print(f"  ... and {len(all_updates) - 5} more")
        print("\n[DRY RUN] No changes made")
        sys.exit(0)

    # Process in batches
    total_updated = 0
    start_time = time.time()
    batch_count = (len(all_updates) + args.batch_size - 1) // args.batch_size

    print(f"\nProcessing in {batch_count} batches of {args.batch_size}...")

    with get_connection() as conn:
        for i in range(0, len(all_updates), args.batch_size):
            batch = all_updates[i:i + args.batch_size]
            batch_num = i // args.batch_size + 1

            updated = batch_update_summaries(conn, batch)
            total_updated += updated

            # Calculate ETA
            elapsed = time.time() - start_time
            rate = total_updated / elapsed if elapsed > 0 else 0
            remaining = len(all_updates) - total_updated
            eta = remaining / rate if rate > 0 else 0

            print(
                f"  Batch {batch_num}/{batch_count}: "
                f"{total_updated}/{len(all_updates)} "
                f"({100 * total_updated / len(all_updates):.1f}%) "
                f"ETA: {format_eta(eta)}"
            )

    elapsed = time.time() - start_time
    print(f"\n=== COMPLETE ===")
    print(f"Updated {total_updated} records in {elapsed:.1f}s")
    print(f"Rate: {total_updated / elapsed:.1f} records/sec")


if __name__ == "__main__":
    main()
