#!/usr/bin/env python3
"""
Populate scope_document_id for definitions by walking the document hierarchy.

For each definition with document_id and scope_level set, walks up the
parent chain to find the ancestor document at the matching hierarchy level.

Usage:
    python populate_scope_documents.py [--dry-run]
"""

import argparse
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT
from shared_utils import get_db_connection, normalize_scope_level, format_time

load_dotenv(PROJECT_ROOT / '.env')


def find_ancestor_at_level(conn, start_doc_id: int, target_level: str) -> int | None:
    """
    Walk up from start_doc_id until we find a document at target_level.
    Returns the document ID or None if not found.
    Uses case-insensitive matching.
    """
    # Normalize the target level
    normalized_level = normalize_scope_level(target_level)
    if not normalized_level:
        return None

    result = conn.execute("""
        WITH RECURSIVE ancestors AS (
            -- Start with the source document itself
            SELECT id, parent_id, hierarchy_level, 0 as depth
            FROM regulatory_documents
            WHERE id = %s

            UNION ALL

            -- Walk up to parents
            SELECT rd.id, rd.parent_id, rd.hierarchy_level, a.depth + 1
            FROM regulatory_documents rd
            INNER JOIN ancestors a ON rd.id = a.parent_id
            WHERE a.depth < 20
        )
        SELECT id FROM ancestors
        WHERE LOWER(hierarchy_level) = %s
        ORDER BY depth ASC
        LIMIT 1
    """, (start_doc_id, normalized_level)).fetchone()

    return result[0] if result else None


def populate_scope_document_ids(dry_run: bool = False):
    """
    For each definition, walk up the hierarchy from document_id
    to find the ancestor matching scope_level.
    """
    print("=" * 70)
    print("POPULATE SCOPE_DOCUMENT_ID")
    print("=" * 70)
    print()

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    # Get definitions needing scope_document_id
    definitions = conn.execute("""
        SELECT d.id, d.document_id, d.scope_level, d.term
        FROM definitions d
        WHERE d.document_id IS NOT NULL
          AND d.scope_level IS NOT NULL
          AND d.scope_document_id IS NULL
        ORDER BY d.id
    """).fetchall()

    total = len(definitions)
    print(f"Found {total} definitions needing scope_document_id")
    print()

    if total == 0:
        print("Nothing to do!")
        conn.close()
        return

    if dry_run:
        print("DRY RUN - showing first 10 that would be processed:")
        for i, defn in enumerate(definitions[:10], 1):
            def_id, doc_id, target_level, term = defn
            scope_doc_id = find_ancestor_at_level(conn, doc_id, target_level)
            status = f"→ {scope_doc_id}" if scope_doc_id else "→ NOT FOUND"
            print(f"  {i}. [{def_id}] \"{term[:30]}\" (scope: {target_level}) {status}")
        if total > 10:
            print(f"  ... and {total - 10} more")
        print()
        print("Rerun without --dry-run to apply changes.")
        conn.close()
        return

    # Process definitions
    start_time = time.time()
    updated = 0
    not_found = 0

    print("Processing definitions...")
    print()

    for i, defn in enumerate(definitions, 1):
        def_id, doc_id, target_level, term = defn

        # Walk up parent chain to find matching level
        scope_doc_id = find_ancestor_at_level(conn, doc_id, target_level)

        if scope_doc_id:
            conn.execute("""
                UPDATE definitions SET scope_document_id = %s WHERE id = %s
            """, (scope_doc_id, def_id))
            updated += 1
        else:
            not_found += 1

        # Progress every 50 or at the end
        if i % 50 == 0 or i == total:
            elapsed = time.time() - start_time
            pct = (i / total) * 100
            eta = (elapsed / i) * (total - i) if i > 0 else 0
            print(f"  [{i}/{total}] ({pct:5.1f}%) Elapsed: {format_time(elapsed)} | ETA: {format_time(eta)} | Updated: {updated} | Not found: {not_found}")

    conn.commit()
    conn.close()

    elapsed = time.time() - start_time
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total processed: {total}")
    print(f"Updated:         {updated}")
    print(f"Not found:       {not_found}")
    print(f"Time:            {format_time(elapsed)}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description='Populate scope_document_id by walking document hierarchy'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without making changes')

    args = parser.parse_args()
    populate_scope_document_ids(dry_run=args.dry_run)


if __name__ == '__main__':
    main()
