#!/usr/bin/env python3
"""
Refresh precomputed hierarchy stats for fast browse page queries.

This script populates the denormalized columns on regulatory_documents:
- direct_child_count: Number of direct children
- descendant_count: Total descendants in subtree
- descendant_flag_count: Sum of red flags in descendants
- descendant_max_severity: Max severity across descendants
- has_descendant_analysis: Whether any descendant has been analyzed

Usage:
    python refresh_hierarchy_stats.py              # Refresh all stats for all states
    python refresh_hierarchy_stats.py --state NY   # Refresh single state
    python refresh_hierarchy_stats.py --state NJ   # Refresh single state
    python refresh_hierarchy_stats.py --structure  # Only structural stats (children counts)
    python refresh_hierarchy_stats.py --analysis   # Only analysis stats (flags, severity)
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

    Returns the number of documents updated.
    """
    print(f"  Computing structure stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Use a CTE to compute children counts in one pass
        cur.execute("""
            WITH structure_stats AS (
                SELECT
                    parent.id,
                    -- Direct children count
                    (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = parent.id) as direct_child_count,
                    -- All descendants count (using hierarchy_path)
                    COUNT(DISTINCT descendant.id) as descendant_count
                FROM regulatory_documents parent
                LEFT JOIN regulatory_documents descendant
                    ON descendant.hierarchy_path LIKE parent.hierarchy_path || ' > %%'
                WHERE parent.state = %s
                GROUP BY parent.id
            )
            UPDATE regulatory_documents rd
            SET
                direct_child_count = ss.direct_child_count,
                descendant_count = ss.descendant_count
            FROM structure_stats ss
            WHERE rd.id = ss.id
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

    Returns the number of documents updated.
    """
    print(f"  Computing analysis stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Use a CTE to compute analysis stats in one pass
        cur.execute("""
            WITH analysis_stats AS (
                SELECT
                    parent.id,
                    -- Sum of flags across all descendants
                    COALESCE(SUM(a.num_flags), 0)::int as descendant_flag_count,
                    -- Max severity across all descendants
                    MAX(a.max_severity) as descendant_max_severity,
                    -- Whether any descendant has analysis
                    BOOL_OR(a.id IS NOT NULL) as has_descendant_analysis
                FROM regulatory_documents parent
                LEFT JOIN regulatory_documents descendant
                    ON descendant.hierarchy_path LIKE parent.hierarchy_path || ' > %%'
                LEFT JOIN analyses a
                    ON a.document_id = descendant.id AND a.is_current = true
                WHERE parent.state = %s
                GROUP BY parent.id
            )
            UPDATE regulatory_documents rd
            SET
                descendant_flag_count = ast.descendant_flag_count,
                descendant_max_severity = ast.descendant_max_severity,
                has_descendant_analysis = COALESCE(ast.has_descendant_analysis, false)
            FROM analysis_stats ast
            WHERE rd.id = ast.id
        """, (state,))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"  Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_all_stats(conn, state: str) -> int:
    """
    Refresh ALL hierarchy stats (both structural and analysis) for a state.

    This is the original combined query - useful for standalone refreshes
    or when you need both updated at once.

    Returns the number of documents updated.
    """
    print(f"  Computing all stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        cur.execute("""
            WITH all_stats AS (
                SELECT
                    parent.id,
                    -- Direct children count
                    (SELECT COUNT(*) FROM regulatory_documents c WHERE c.parent_id = parent.id) as direct_child_count,
                    -- All descendants count (using hierarchy_path)
                    COUNT(DISTINCT descendant.id) as descendant_count,
                    -- Sum of flags across all descendants
                    COALESCE(SUM(a.num_flags), 0)::int as descendant_flag_count,
                    -- Max severity across all descendants
                    MAX(a.max_severity) as descendant_max_severity,
                    -- Whether any descendant has analysis
                    BOOL_OR(a.id IS NOT NULL) as has_descendant_analysis
                FROM regulatory_documents parent
                LEFT JOIN regulatory_documents descendant
                    ON descendant.hierarchy_path LIKE parent.hierarchy_path || ' > %%'
                LEFT JOIN analyses a
                    ON a.document_id = descendant.id AND a.is_current = true
                WHERE parent.state = %s
                GROUP BY parent.id
            )
            UPDATE regulatory_documents rd
            SET
                direct_child_count = ast.direct_child_count,
                descendant_count = ast.descendant_count,
                descendant_flag_count = ast.descendant_flag_count,
                descendant_max_severity = ast.descendant_max_severity,
                has_descendant_analysis = COALESCE(ast.has_descendant_analysis, false)
            FROM all_stats ast
            WHERE rd.id = ast.id
        """, (state,))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"  Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def run_refresh(states: list[str] = None, mode: str = 'all'):
    """
    Run refresh for specified states.

    Args:
        states: List of state codes to refresh (default: all states)
        mode: 'all', 'structure', or 'analysis'
    """
    if states is None:
        states = ['NY', 'NJ']

    mode_label = {
        'all': 'all hierarchy stats',
        'structure': 'structure stats (children counts)',
        'analysis': 'analysis stats (flags, severity)'
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

    args = parser.parse_args()

    states = [args.state] if args.state else None

    # Determine mode
    if args.structure and args.analysis:
        mode = 'all'  # Both flags = do everything
    elif args.structure:
        mode = 'structure'
    elif args.analysis:
        mode = 'analysis'
    else:
        mode = 'all'  # Default: refresh everything

    run_refresh(states, mode)


if __name__ == "__main__":
    main()
