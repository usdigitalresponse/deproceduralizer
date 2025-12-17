#!/usr/bin/env python3
"""
Refresh precomputed hierarchy stats for fast browse page queries.

This script populates the denormalized columns on regulatory_documents:
- direct_child_count: Number of direct children
- descendant_count: Total descendants in subtree
- descendant_flag_count: Sum of red flags in descendants
- descendant_max_severity: Max severity across descendants
- has_descendant_analysis: Whether any descendant has been analyzed
- compliance_issue_count: Direct compliance issues on this document
- descendant_compliance_issue_count: Sum of compliance issues in subtree

Usage:
    python refresh_hierarchy_stats.py              # Refresh all stats for all states
    python refresh_hierarchy_stats.py --state NY   # Refresh single state
    python refresh_hierarchy_stats.py --state NJ   # Refresh single state
    python refresh_hierarchy_stats.py --structure  # Only structural stats (children counts)
    python refresh_hierarchy_stats.py --analysis   # Only analysis stats (flags, severity)
    python refresh_hierarchy_stats.py --compliance # Only compliance stats (compliance issues)
"""

import sys
import argparse
import time
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT
from shared_utils import get_db_connection

# Load .env
load_dotenv(PROJECT_ROOT / '.env')


def refresh_structure_stats(conn, state: str) -> int:
    """
    Refresh structural hierarchy stats (children counts) for all documents in a state.

    This should be called after data import (migrate_to_postgres.py) since children
    counts only change when document structure changes.

    Updates: direct_child_count, descendant_count

    Uses two efficient queries:
    1. Direct children count using parent_id index
    2. Recursive CTE for descendant count

    Returns the number of documents updated.
    """
    print(f"  Computing structure stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Two queries: one for direct children, one for descendants
        # Direct children (simple and fast)
        cur.execute("""
            WITH direct_children AS (
                SELECT parent_id, COUNT(*) as direct_child_count
                FROM regulatory_documents
                WHERE state = %s AND parent_id IS NOT NULL
                GROUP BY parent_id
            ),
            structure_stats AS (
                SELECT
                    rd.id,
                    COALESCE(dc.direct_child_count, 0) as direct_child_count
                FROM regulatory_documents rd
                LEFT JOIN direct_children dc ON rd.id = dc.parent_id
                WHERE rd.state = %s
            )
            UPDATE regulatory_documents rd
            SET direct_child_count = ss.direct_child_count
            FROM structure_stats ss
            WHERE rd.id = ss.id
        """, (state, state))

        conn.commit()

        # Descendants using recursive CTE (separate query)
        cur.execute("""
            WITH RECURSIVE all_descendants AS (
                -- Base case: all documents in this state
                SELECT id, parent_id, 1 as depth
                FROM regulatory_documents
                WHERE state = %s

                UNION ALL

                -- Recursive case: count descendants by walking up tree
                SELECT ad.id, p.parent_id, ad.depth + 1
                FROM all_descendants ad
                JOIN regulatory_documents p ON p.id = ad.parent_id
                WHERE ad.depth < 100  -- Safety limit
            ),
            descendant_counts AS (
                SELECT parent_id, COUNT(DISTINCT id) as descendant_count
                FROM all_descendants
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET descendant_count = COALESCE(dc.descendant_count, 0)
            FROM descendant_counts dc
            WHERE rd.id = dc.parent_id
        """, (state,))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"  Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_analysis_stats(conn, state: str) -> int:
    """
    Refresh analysis-related hierarchy stats for all documents in a state.

    This should be called after red flag analysis (red_flags.py) since these
    stats aggregate analysis results from descendants.

    Updates: descendant_flag_count, descendant_max_severity, has_descendant_analysis

    Uses recursive CTE walking from child to parent (efficient with parent_id index)
    instead of pattern matching on hierarchy_path.

    Returns the number of documents updated.
    """
    print(f"  Computing analysis stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Use recursive CTE to walk tree from children upward (uses parent_id index)
        cur.execute("""
            WITH RECURSIVE descendant_analysis AS (
                -- Base case: all leaf nodes with their analysis
                SELECT
                    rd.id as descendant_id,
                    rd.parent_id,
                    COALESCE(a.num_flags, 0) as num_flags,
                    a.max_severity,
                    a.id IS NOT NULL as has_analysis
                FROM regulatory_documents rd
                LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
                WHERE rd.state = %s

                UNION ALL

                -- Recursive case: aggregate up to parents
                SELECT
                    da.descendant_id,
                    p.parent_id,
                    da.num_flags,
                    da.max_severity,
                    da.has_analysis
                FROM descendant_analysis da
                JOIN regulatory_documents p ON p.id = da.parent_id
            ),
            analysis_stats AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(num_flags), 0)::int as descendant_flag_count,
                    MAX(max_severity) as descendant_max_severity,
                    BOOL_OR(has_analysis) as has_descendant_analysis
                FROM descendant_analysis
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET
                descendant_flag_count = ast.descendant_flag_count,
                descendant_max_severity = ast.descendant_max_severity,
                has_descendant_analysis = COALESCE(ast.has_descendant_analysis, false)
            FROM analysis_stats ast
            WHERE rd.id = ast.id AND rd.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"  Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_compliance_stats(conn, state: str) -> int:
    """
    Refresh compliance issue stats for all documents in a state.

    This should be called after compliance issue detection since these
    stats aggregate compliance issues from the document and its descendants.

    Updates: compliance_issue_count, descendant_compliance_issue_count

    Uses two queries:
    1. Direct compliance issue count per document
    2. Recursive CTE for descendant compliance issue count

    Returns the number of documents updated.
    """
    print(f"  Computing compliance stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # First: direct compliance issue counts per document
        cur.execute("""
            WITH direct_issues AS (
                SELECT document_id, COUNT(*) as issue_count
                FROM compliance_issues
                WHERE state = %s
                GROUP BY document_id
            )
            UPDATE regulatory_documents rd
            SET compliance_issue_count = COALESCE(di.issue_count, 0)
            FROM (
                SELECT rd2.id, COALESCE(di.issue_count, 0) as issue_count
                FROM regulatory_documents rd2
                LEFT JOIN direct_issues di ON rd2.id = di.document_id
                WHERE rd2.state = %s
            ) di
            WHERE rd.id = di.id
        """, (state, state))

        conn.commit()

        # Second: descendant compliance issue counts using recursive CTE
        cur.execute("""
            WITH RECURSIVE descendant_issues AS (
                -- Base case: all documents with their direct compliance issue count
                SELECT
                    rd.id as descendant_id,
                    rd.parent_id,
                    COALESCE(rd.compliance_issue_count, 0) as issue_count
                FROM regulatory_documents rd
                WHERE rd.state = %s

                UNION ALL

                -- Recursive case: aggregate up to parents
                SELECT
                    di.descendant_id,
                    p.parent_id,
                    di.issue_count
                FROM descendant_issues di
                JOIN regulatory_documents p ON p.id = di.parent_id
            ),
            descendant_counts AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(issue_count), 0)::int as descendant_compliance_issue_count
                FROM descendant_issues
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET descendant_compliance_issue_count = dc.descendant_compliance_issue_count
            FROM descendant_counts dc
            WHERE rd.id = dc.id AND rd.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"  Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_all_stats(conn, state: str) -> int:
    """
    Refresh ALL hierarchy stats (structural, analysis, and compliance) for a state.

    Uses separate optimized queries instead of one combined query to avoid
    memory issues and statement timeouts.

    Returns the number of documents updated.
    """
    print(f"  Computing all stats for {state}...")
    start = time.time()

    # Run structure stats first
    updated1 = refresh_structure_stats(conn, state)

    # Then run analysis stats
    updated2 = refresh_analysis_stats(conn, state)

    # Then run compliance stats
    updated3 = refresh_compliance_stats(conn, state)

    elapsed = time.time() - start
    # Return max since all update same rows
    updated_count = max(updated1, updated2, updated3)
    print(f"  All stats complete in {elapsed:.1f}s")
    return updated_count


def run_refresh(states: list[str] = None, mode: str = 'all'):
    """
    Run refresh for specified states.

    Args:
        states: List of state codes to refresh (default: all states)
        mode: 'all', 'structure', 'analysis', or 'compliance'
    """
    if states is None:
        states = ['NY', 'NJ']

    mode_label = {
        'all': 'all hierarchy stats',
        'structure': 'structure stats (children counts)',
        'analysis': 'analysis stats (flags, severity)',
        'compliance': 'compliance stats (compliance issues)'
    }

    print(f"Refreshing {mode_label[mode]} for: {', '.join(states)}")
    print("-" * 50)

    total_start = time.time()
    total_updated = 0

    with get_db_connection() as conn:
        for state in states:
            if mode == 'structure':
                updated = refresh_structure_stats(conn, state)
            elif mode == 'analysis':
                updated = refresh_analysis_stats(conn, state)
            elif mode == 'compliance':
                updated = refresh_compliance_stats(conn, state)
            else:  # 'all'
                updated = refresh_all_stats(conn, state)
            total_updated += updated

    total_elapsed = time.time() - total_start
    print("-" * 50)
    print(f"Done! Updated {total_updated:,} documents in {total_elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(
        description='Refresh precomputed hierarchy stats for browse page performance'
    )
    parser.add_argument(
        '--state',
        type=str,
        choices=['NY', 'NJ'],
        help='Refresh only a specific state (default: all states)'
    )
    parser.add_argument(
        '--structure',
        action='store_true',
        help='Only refresh structural stats (children counts) - use after data import'
    )
    parser.add_argument(
        '--analysis',
        action='store_true',
        help='Only refresh analysis stats (flags, severity) - use after red_flags.py'
    )
    parser.add_argument(
        '--compliance',
        action='store_true',
        help='Only refresh compliance stats (compliance issues) - use after compliance detection'
    )

    args = parser.parse_args()

    states = [args.state] if args.state else None

    # Determine mode - count how many specific modes are requested
    modes_requested = sum([args.structure, args.analysis, args.compliance])

    if modes_requested == 0 or modes_requested > 1:
        mode = 'all'  # Default or multiple = do everything
    elif args.structure:
        mode = 'structure'
    elif args.analysis:
        mode = 'analysis'
    elif args.compliance:
        mode = 'compliance'
    else:
        mode = 'all'

    run_refresh(states, mode)


if __name__ == "__main__":
    main()
