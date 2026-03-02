"""
db_writer.py - Write extracted cross-references to database

USAGE:
    python run_extraction.py --state NY --limit 500 --output db

This module handles persisting extraction results to the cross_references table.
It uses a delete-then-insert strategy for each source document to ensure clean
re-runs (idempotent behavior).

PERFORMANCE: Uses batch INSERT operations to minimize database round-trips.
For 1000 documents with 5 refs each, this reduces queries from ~7000 to ~10.
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

import psycopg
from psycopg import sql
from dotenv import load_dotenv

# Load environment
load_dotenv()
if not os.getenv("DATABASE_URL"):
    load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")


def write_to_database(
    results: List[Any],  # List[DocumentExtractionResult]
    jurisdiction: str,
    dry_run: bool = False
) -> Dict[str, int]:
    """
    Write extraction results to the cross_references table.

    Uses a clean-slate approach: for each source document, deletes existing
    cross-references before inserting new ones. This ensures idempotent re-runs.

    OPTIMIZED: Uses batch operations to minimize database round-trips.

    Args:
        results: List of DocumentExtractionResult objects from extraction
        jurisdiction: Jurisdiction code ('NY', 'NJ', or 'NYC')
        dry_run: If True, don't actually write to database (just report stats)

    Returns:
        Dict with stats: {inserted, docs_updated, skipped, errors}
    """
    stats = {
        'inserted': 0,
        'docs_updated': 0,
        'docs_skipped': 0,
        'errors': 0,
        'duration_seconds': 0,
    }

    # Filter to only documents with references
    docs_with_refs = [r for r in results if r.total_count > 0]

    if not docs_with_refs:
        print("  No documents with references to save.")
        return stats

    total_refs = sum(r.total_count for r in docs_with_refs)
    print(f"\n[DB] Writing {len(docs_with_refs)} documents to database...")
    print(f"     Total references: {total_refs}")

    if dry_run:
        print("     (DRY RUN - no changes will be made)")
        stats['docs_updated'] = len(docs_with_refs)
        stats['inserted'] = total_refs
        return stats

    start_time = time.time()

    try:
        conn = psycopg.connect(os.getenv("DATABASE_URL"))
        cur = conn.cursor()

        # STEP 1: Batch DELETE - collect all source document IDs
        source_doc_ids = [r.source_document_id for r in docs_with_refs]
        print(f"     Step 1/3: Deleting existing refs for {len(source_doc_ids)} documents...")
        cur.execute(
            "DELETE FROM cross_references WHERE source_document_id = ANY(%s)",
            (source_doc_ids,)
        )
        deleted_count = cur.rowcount
        print(f"              Deleted {deleted_count} existing references")

        # STEP 2: Batch INSERT - collect all references into tuples
        print(f"     Step 2/3: Preparing {total_refs} references for batch insert...")
        all_refs: List[Tuple] = []
        for doc_result in docs_with_refs:
            for ref in doc_result.references:
                all_refs.append((
                    doc_result.source_document_id,
                    ref.ref_type.value,
                    ref.raw_text,
                    ref.normalized_citation,
                    ref.start_offset,
                    ref.end_offset,
                    ref.context_before,
                    ref.context_after,
                    json.dumps(ref.components) if ref.components else None,
                    ref.target_document_id,
                    ref.is_resolved,
                    _get_resolution_notes(ref) if not ref.is_resolved else None,
                    jurisdiction.upper(),
                ))

        # Use executemany for batch insert (psycopg 3 handles this efficiently)
        if all_refs:
            print(f"              Inserting {len(all_refs)} references...")
            cur.executemany(
                """
                INSERT INTO cross_references
                (source_document_id, ref_type, raw_text, normalized_citation,
                 start_offset, end_offset, context_before, context_after,
                 components, target_document_id, is_resolved, resolution_notes, jurisdiction)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                all_refs
            )
            stats['inserted'] = len(all_refs)

        # STEP 3: Batch UPDATE cross_reference_counts
        print(f"     Step 3/3: Updating cross_reference_count for {len(docs_with_refs)} documents...")
        update_data = [(len(r.references), r.source_document_id) for r in docs_with_refs]
        cur.executemany(
            """
            UPDATE regulatory_documents
            SET cross_reference_count = %s
            WHERE id = %s
            """,
            update_data
        )
        stats['docs_updated'] = len(docs_with_refs)

        conn.commit()
        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n[DB] Database error: {e}")
        stats['errors'] += 1
        try:
            conn.rollback()
            conn.close()
        except Exception:
            pass

    stats['duration_seconds'] = round(time.time() - start_time, 1)

    print(f"\n[DB] Complete:")
    print(f"     {stats['inserted']} references inserted")
    print(f"     {stats['docs_updated']} documents updated")
    if stats['errors'] > 0:
        print(f"     {stats['errors']} errors")
    print(f"     Duration: {stats['duration_seconds']}s")

    return stats


def _get_resolution_notes(ref: Any) -> str:
    """
    Generate resolution notes for unresolved references.

    Explains why the reference couldn't be resolved, which is useful
    for debugging and improving resolution logic.
    """
    ref_type = ref.ref_type.value

    if ref_type == 'same_section':
        # Same-section refs are "resolved" to themselves (no target_document_id needed)
        return None

    if ref_type in ('nycrr', 'njac'):
        return f"Target section not found in database: {ref.normalized_citation}"

    if ref_type == 'ny_short_form':
        scope = ref.components.get('scope', 'unknown')
        return f"Short-form reference could not be resolved (scope: {scope})"

    return "Unknown reference type or resolution failure"


def get_cross_reference_stats(jurisdiction: str = None) -> Dict[str, Any]:
    """
    Get statistics about cross-references in the database.

    Args:
        jurisdiction: Optional jurisdiction filter ('NY', 'NJ', or 'NYC')

    Returns:
        Dict with stats: total, resolved, unresolved, by_type
    """
    conn = psycopg.connect(os.getenv("DATABASE_URL"))

    state_filter = "WHERE jurisdiction = %s" if jurisdiction else ""
    params = (jurisdiction.upper(),) if jurisdiction else ()

    # Total counts
    total = conn.execute(
        f"SELECT COUNT(*) FROM cross_references {state_filter}",
        params
    ).fetchone()[0]

    resolved = conn.execute(
        f"SELECT COUNT(*) FROM cross_references {state_filter} "
        f"{'AND' if jurisdiction else 'WHERE'} is_resolved = TRUE",
        params
    ).fetchone()[0]

    # By type
    by_type_query = f"""
        SELECT ref_type, COUNT(*), SUM(CASE WHEN is_resolved THEN 1 ELSE 0 END)
        FROM cross_references
        {state_filter}
        GROUP BY ref_type
        ORDER BY COUNT(*) DESC
    """
    by_type = conn.execute(by_type_query, params).fetchall()

    conn.close()

    return {
        'total': total,
        'resolved': resolved,
        'unresolved': total - resolved,
        'resolution_rate': f"{resolved / total * 100:.1f}%" if total > 0 else "N/A",
        'by_type': {
            row[0]: {'count': row[1], 'resolved': row[2]}
            for row in by_type
        }
    }


# =============================================================================
# CLI for testing
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Cross-reference database utilities")
    parser.add_argument("--stats", action="store_true", help="Show database stats")
    from lib.jurisdictions import VALID_JURISDICTIONS
    parser.add_argument("--state", choices=VALID_JURISDICTIONS, help="Filter by state")

    args = parser.parse_args()

    if args.stats:
        stats = get_cross_reference_stats(args.state)
        print("\n" + "=" * 50)
        print(f"CROSS-REFERENCE DATABASE STATS")
        if args.state:
            print(f"(Filtered to {args.state})")
        print("=" * 50)
        print(f"\nTotal references: {stats['total']}")
        print(f"Resolved: {stats['resolved']} ({stats['resolution_rate']})")
        print(f"Unresolved: {stats['unresolved']}")
        print(f"\nBy type:")
        for ref_type, counts in stats['by_type'].items():
            pct = counts['resolved'] / counts['count'] * 100 if counts['count'] > 0 else 0
            print(f"  {ref_type}: {counts['count']} ({counts['resolved']} resolved, {pct:.1f}%)")
