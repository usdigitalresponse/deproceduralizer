#!/usr/bin/env python3
"""
One-time backfill script to fix unlinked definitions (scope_document_id IS NULL).

Root causes addressed:
1. Scraper bug: 3 NY top-level docs (Title 6, 9, 99) have hierarchy_level='subpart'
   instead of 'title' due to breadcrumb parsing
2. LLM gap: definitions have scope phrase but no scope_level
3. Narrow inference: parent-section inference was limited to 'definition' titled docs

Usage:
    # Preview what would change (dry run)
    python fix_unlinked_definitions.py --dry-run

    # Apply fixes
    python fix_unlinked_definitions.py --execute

    # Fix only a specific state
    python fix_unlinked_definitions.py --execute --state NY
"""

import argparse
import sys
import time

# Add parent to path for imports
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent.parent))

from lib.db import get_db_connection
from scripts.batch_definitions import (
    infer_scope_level_from_phrase,
    infer_scope_from_parent_section,
    populate_scope_document_ids,
)


def report_unlinked_counts(conn, label: str = "Current"):
    """Report unlinked definition counts by state and scope_level."""
    print(f"\n{'=' * 60}")
    print(f"  {label} Unlinked Definition Counts")
    print(f"{'=' * 60}")

    # By state
    rows = conn.execute("""
        SELECT rd.state,
               COUNT(*) as total,
               COUNT(*) - COUNT(d.scope_document_id) as unlinked,
               COUNT(d.scope_document_id) as linked
        FROM definitions d
        JOIN regulatory_documents rd ON d.document_id = rd.id
        GROUP BY rd.state
        ORDER BY rd.state
    """).fetchall()

    print(f"\n  {'State':<8} {'Total':>8} {'Linked':>8} {'Unlinked':>8} {'% Linked':>10}")
    print(f"  {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*10}")
    for state, total, unlinked, linked in rows:
        pct = (linked / total * 100) if total > 0 else 0
        print(f"  {state:<8} {total:>8} {linked:>8} {unlinked:>8} {pct:>9.1f}%")

    # Unlinked breakdown by scope_level
    rows = conn.execute("""
        SELECT rd.state,
               COALESCE(d.scope_level, '(null)') as scope_level,
               COUNT(*) as unlinked
        FROM definitions d
        JOIN regulatory_documents rd ON d.document_id = rd.id
        WHERE d.scope_document_id IS NULL
        GROUP BY rd.state, d.scope_level
        ORDER BY rd.state, unlinked DESC
    """).fetchall()

    if rows:
        print(f"\n  Unlinked by scope_level:")
        print(f"  {'State':<8} {'scope_level':<15} {'Count':>8}")
        print(f"  {'-'*8} {'-'*15} {'-'*8}")
        for state, scope_level, count in rows:
            print(f"  {state:<8} {scope_level:<15} {count:>8}")

    print()


def fix_mislabeled_hierarchy_levels(conn, dry_run: bool = True) -> int:
    """
    Fix the 3 NY top-level documents (Title 6, 9, 99) that have
    hierarchy_level='subpart' instead of 'title' due to the breadcrumb
    parsing bug.
    """
    # Find top-level NYCRR docs mislabeled as 'subpart' due to breadcrumb bug.
    # These have numeric Title IDs (Title-6, Title-9, Title-99) stored in nycrr_subpart,
    # and either have no parent or no ancestor at the 'title' level.
    # Excludes alphabetic subdivisions like "Title-A", "Title-H", "Title-BrandIng"
    # which are legitimate subparts within parts.
    rows = conn.execute("""
        SELECT id, title, nycrr_title, nycrr_subpart, hierarchy_level
        FROM regulatory_documents
        WHERE state = 'NY'
          AND hierarchy_level = 'subpart'
          AND nycrr_subpart ~ '^Title-[0-9]+$'
          AND parent_id IS NULL
        ORDER BY id
    """).fetchall()

    if not rows:
        print("  No mislabeled hierarchy_level documents found")
        return 0

    print(f"  Found {len(rows)} mislabeled documents:")
    for doc_id, title, nycrr_title, nycrr_subpart, level in rows:
        print(f"    [{doc_id}] Title {nycrr_title} (subpart={nycrr_subpart}) — {title[:50]}")

    if dry_run:
        print(f"  Would fix {len(rows)} documents (hierarchy_level: subpart → title)")
        return 0

    updated = 0
    for doc_id, title, nycrr_title, nycrr_subpart, level in rows:
        conn.execute("""
            UPDATE regulatory_documents
            SET hierarchy_level = 'title',
                nycrr_subpart = NULL,
                nycrr_subpart_name = NULL
            WHERE id = %s
        """, (doc_id,))
        updated += 1

    conn.commit()
    print(f"  Fixed {updated} documents (hierarchy_level: subpart → title)")
    return updated


def main():
    parser = argparse.ArgumentParser(
        description='Fix unlinked definitions (scope_document_id IS NULL)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--execute', action='store_true',
                        help='Apply fixes (default is dry-run)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be fixed without applying (default)')
    parser.add_argument('--state', choices=['NY', 'NJ', 'NYC'],
                        help='Only fix definitions for a specific state')

    args = parser.parse_args()
    dry_run = not args.execute

    if dry_run:
        print("DRY RUN — no changes will be made. Use --execute to apply.")
    else:
        print("EXECUTING — changes will be applied to the database.")
    print()

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        sys.exit(1)

    # Report before counts
    report_unlinked_counts(conn, "BEFORE")

    start_time = time.time()

    # Step 1: Fix mislabeled hierarchy_level docs
    print("=" * 60)
    print("  Step 1: Fix mislabeled hierarchy_level documents")
    print("=" * 60)
    fix_mislabeled_hierarchy_levels(conn, dry_run=dry_run)
    print()

    # Step 2: Infer scope_level from scope phrases
    print("=" * 60)
    print("  Step 2: Infer scope_level from scope phrases")
    print("=" * 60)
    phrase_count = infer_scope_level_from_phrase(
        conn=conn, state=args.state, dry_run=dry_run
    )
    if not dry_run and phrase_count > 0:
        print(f"  Inferred scope_level for {phrase_count} definitions from scope phrases")
    print()

    # Step 3: Infer scope from parent hierarchy (definition-titled sections only)
    print("=" * 60)
    print("  Step 3: Infer scope from parent hierarchy (def-titled sections)")
    print("=" * 60)
    parent_count = infer_scope_from_parent_section(dry_run=dry_run)
    if not dry_run and parent_count > 0:
        print(f"  Inferred scope for {parent_count} definitions from parent hierarchy")
    print()

    # Step 4: Populate scope_document_ids with fallback
    print("=" * 60)
    print("  Step 4: Populate scope_document_ids (with fallback)")
    print("=" * 60)
    populate_scope_document_ids(dry_run=dry_run)
    print()

    elapsed = time.time() - start_time

    # Report after counts
    if not dry_run:
        # Reconnect for fresh counts
        conn_after = get_db_connection()
        if conn_after:
            report_unlinked_counts(conn_after, "AFTER")
            conn_after.close()

    print(f"Completed in {elapsed:.1f}s")

    conn.close()


if __name__ == '__main__':
    main()
