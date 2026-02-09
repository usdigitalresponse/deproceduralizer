#!/usr/bin/env python3
"""
Backfill definition scope from parent section.

When definitions have null scope_level but are in a section whose title contains
"definition", infer the scope from the parent section's hierarchy_level.

Usage:
    python backfill_definition_scope.py --dry-run   # Preview changes
    python backfill_definition_scope.py             # Apply changes
    python backfill_definition_scope.py --state NJ  # Process only NJ
"""

import argparse
import time
from dotenv import load_dotenv

from config import PROJECT_ROOT
from lib.db import get_db_connection

# Load environment
load_dotenv(PROJECT_ROOT / '.env')


def infer_scope_from_parent(dry_run: bool = False, state: str = None, limit: int = None):
    """
    For definitions with null scope_level in sections titled "definition(s)",
    set scope_level and scope_document_id by walking up to the first ancestor
    with a DIFFERENT hierarchy_level than the source document.

    Logic:
    1. Find definitions where scope_level IS NULL
    2. The source document's title contains "definition" (case-insensitive)
    3. Walk up the hierarchy to find the first ancestor with a different level
    4. Set scope_level = that ancestor's hierarchy_level
    5. Set scope_document_id = that ancestor's id
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    print("=" * 70)
    print("BACKFILL DEFINITION SCOPE FROM PARENT")
    print("=" * 70)
    print()

    # Build query with optional state filter
    state_filter = ""
    params = []
    if state:
        state_filter = "AND section.state = %s"
        params.append(state.upper())
        print(f"State filter: {state.upper()}")
        print()

    # Use recursive CTE to find first ancestor with different hierarchy_level
    # This handles both cases:
    # - Parent has different level: stops immediately, uses parent
    # - Parent has same level: walks up until finding different level
    base_cte = f"""
        WITH RECURSIVE ancestors AS (
            -- Base: start from the document where the definition lives
            SELECT
                d.id as def_id,
                d.term,
                section.id as start_doc_id,
                section.title as start_title,
                section.hierarchy_level as start_level,
                section.parent_id as current_parent_id,
                1 as depth
            FROM definitions d
            JOIN regulatory_documents section ON d.document_id = section.id
            WHERE d.scope_level IS NULL
              AND section.title ~* 'definition'
              AND section.parent_id IS NOT NULL
              {state_filter}

            UNION ALL

            -- Recurse: keep walking up if parent has same level as start
            SELECT
                a.def_id,
                a.term,
                a.start_doc_id,
                a.start_title,
                a.start_level,
                parent.parent_id as current_parent_id,
                a.depth + 1
            FROM ancestors a
            JOIN regulatory_documents parent ON a.current_parent_id = parent.id
            WHERE parent.hierarchy_level = a.start_level
              AND parent.parent_id IS NOT NULL
              AND a.depth < 10
        ),
        first_different_ancestor AS (
            SELECT DISTINCT ON (a.def_id)
                a.def_id,
                a.term,
                a.start_doc_id,
                a.start_title,
                a.start_level,
                a.depth,
                ancestor.id as scope_doc_id,
                ancestor.title as scope_title,
                ancestor.hierarchy_level as scope_level
            FROM ancestors a
            JOIN regulatory_documents ancestor ON a.current_parent_id = ancestor.id
            WHERE ancestor.hierarchy_level != a.start_level
            ORDER BY a.def_id, a.depth
        )
    """

    # Count how many definitions would be affected
    count_query = base_cte + "SELECT COUNT(*) FROM first_different_ancestor"
    total = conn.execute(count_query, params).fetchone()[0]
    print(f"Found {total} definitions with null scope_level in 'definitions' documents")
    print()

    if total == 0:
        print("Nothing to update.")
        conn.close()
        return

    # Get sample for preview
    preview_query = base_cte + """
        SELECT def_id, term, start_doc_id, start_title, start_level,
               depth, scope_doc_id, scope_title, scope_level
        FROM first_different_ancestor
        ORDER BY def_id
        LIMIT 10
    """

    preview = conn.execute(preview_query, params).fetchall()

    print("Sample of definitions to update:")
    print("-" * 70)
    for row in preview:
        def_id, term, start_doc_id, start_title, start_level, depth, scope_doc_id, scope_title, scope_level = row
        print(f"  [{def_id}] \"{term[:30]}\"")
        print(f"       Source: [{start_doc_id}] {start_title[:50]} (level: {start_level})")
        print(f"       Scope:  [{scope_doc_id}] {scope_title[:50]} (level: {scope_level}, depth: {depth})")
        print()

    if len(preview) < total:
        print(f"  ... and {total - len(preview)} more")
        print()

    if dry_run:
        print("-" * 70)
        print("DRY RUN - No changes made.")
        print("Run without --dry-run to apply changes.")
        conn.close()
        return

    # Apply the update
    print("-" * 70)
    print("Applying updates...")

    update_query = base_cte + """
        UPDATE definitions d
        SET
            scope_level = fda.scope_level,
            scope_document_id = fda.scope_doc_id
        FROM first_different_ancestor fda
        WHERE d.id = fda.def_id
    """

    start_time = time.time()
    result = conn.execute(update_query, params)
    updated = result.rowcount
    conn.commit()
    elapsed = time.time() - start_time

    print(f"  ✓ Updated {updated} definitions in {elapsed:.2f}s")
    print()

    # Verify the update
    verify_query = f"""
        SELECT COUNT(*)
        FROM definitions d
        JOIN regulatory_documents section ON d.document_id = section.id
        WHERE d.scope_level IS NULL
          AND section.title ~* 'definition'
          {state_filter}
    """

    remaining = conn.execute(verify_query, params).fetchone()[0]
    print(f"Definitions still needing scope: {remaining}")

    conn.close()

    print()
    print("=" * 70)
    print("COMPLETE")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description='Backfill definition scope from parent section',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python backfill_definition_scope.py --dry-run   # Preview changes
  python backfill_definition_scope.py             # Apply changes
  python backfill_definition_scope.py --state NJ  # Process only NJ
        """
    )

    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without applying them')
    parser.add_argument('--state', type=str, choices=['NY', 'NJ'],
                        help='Only process definitions from this state')
    parser.add_argument('--limit', type=int,
                        help='Limit number of definitions to update')

    args = parser.parse_args()

    infer_scope_from_parent(
        dry_run=args.dry_run,
        state=args.state,
        limit=args.limit
    )


if __name__ == '__main__':
    main()
