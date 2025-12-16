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
from collections import defaultdict
from dotenv import load_dotenv
from tqdm import tqdm

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT
from shared_utils import get_db_connection

# Load .env
load_dotenv(PROJECT_ROOT / '.env')


def refresh_structure_stats_batched(conn, state: str, batch_size: int = 500) -> int:
    """
    Refresh structural hierarchy stats in batches with progress tracking.

    Updates: direct_child_count, descendant_count
    """
    print(f"  Computing structure stats for {state}...")

    with conn.cursor() as cur:
        # Get all document IDs for this state
        cur.execute("""
            SELECT id, hierarchy_path FROM regulatory_documents
            WHERE state = %s ORDER BY id
        """, (state,))
        docs = cur.fetchall()

    if not docs:
        print(f"  No documents found for {state}")
        return 0

    # Build hierarchy path index for fast descendant counting
    print(f"  Building hierarchy index for {len(docs):,} documents...")
    path_to_id = {row[1]: row[0] for row in docs if row[1]}
    all_paths = set(path_to_id.keys())

    updated = 0

    with conn.cursor() as cur:
        for i in tqdm(range(0, len(docs), batch_size), desc="  Updating structure"):
            batch = docs[i:i + batch_size]

            for doc_id, hierarchy_path in batch:
                if not hierarchy_path:
                    continue

                # Count direct children
                cur.execute("""
                    SELECT COUNT(*) FROM regulatory_documents WHERE parent_id = %s
                """, (doc_id,))
                direct_count = cur.fetchone()[0]

                # Count descendants by path prefix matching
                prefix = hierarchy_path + " > "
                descendant_count = sum(1 for p in all_paths if p.startswith(prefix))

                # Update
                cur.execute("""
                    UPDATE regulatory_documents
                    SET direct_child_count = %s, descendant_count = %s
                    WHERE id = %s
                """, (direct_count, descendant_count, doc_id))
                updated += 1

            conn.commit()

    print(f"  Updated {updated:,} documents")
    return updated


def refresh_analysis_stats_incremental(conn, state: str) -> int:
    """
    Refresh analysis stats by walking UP from analyzed documents.

    Instead of joining all 61k documents, we:
    1. Find documents with analyses (~200)
    2. Parse their hierarchy_path to find all ancestors
    3. Aggregate stats per ancestor
    4. Update only the affected ancestors

    This is O(analyzed_docs * avg_depth) instead of O(all_docs^2).

    Updates: descendant_flag_count, descendant_max_severity, has_descendant_analysis
    """
    print(f"  Computing analysis stats for {state} (incremental)...")
    start = time.time()

    # Step 1: Get all analyzed documents with their stats and paths
    with conn.cursor() as cur:
        cur.execute("""
            SELECT rd.id, rd.hierarchy_path, a.num_flags, a.max_severity
            FROM regulatory_documents rd
            JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
            WHERE rd.state = %s
        """, (state,))
        analyzed_docs = cur.fetchall()

    if not analyzed_docs:
        print(f"  No analyzed documents found for {state}")
        return 0

    print(f"  Found {len(analyzed_docs)} analyzed documents")

    # Step 2: Build a map of path -> document ID for all documents in state
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, hierarchy_path FROM regulatory_documents
            WHERE state = %s AND hierarchy_path IS NOT NULL
        """, (state,))
        path_to_id = {row[1]: row[0] for row in cur.fetchall()}

    # Step 3: For each analyzed doc, walk up the hierarchy and aggregate stats
    # ancestor_stats[doc_id] = {flag_count, max_severity, has_analysis}
    ancestor_stats = defaultdict(lambda: {'flag_count': 0, 'max_severity': None, 'has_analysis': False})

    for doc_id, hierarchy_path, num_flags, max_severity in tqdm(analyzed_docs, desc="  Aggregating stats"):
        if not hierarchy_path:
            continue

        # Parse hierarchy path: "Title 1 > Part 2 > Section 3"
        # Each prefix is an ancestor
        parts = hierarchy_path.split(" > ")

        # Build all ancestor paths (excluding the document itself)
        for i in range(len(parts) - 1):
            ancestor_path = " > ".join(parts[:i + 1])
            ancestor_id = path_to_id.get(ancestor_path)

            if ancestor_id:
                stats = ancestor_stats[ancestor_id]
                stats['flag_count'] += num_flags or 0
                if max_severity is not None:
                    if stats['max_severity'] is None:
                        stats['max_severity'] = max_severity
                    else:
                        stats['max_severity'] = max(stats['max_severity'], max_severity)
                stats['has_analysis'] = True

    # Step 4: Reset all documents in state first, then update affected ones
    print(f"  Resetting stats for {state}...")
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE regulatory_documents
            SET descendant_flag_count = 0,
                descendant_max_severity = NULL,
                has_descendant_analysis = false
            WHERE state = %s
        """, (state,))
        conn.commit()

    # Step 5: Update all affected ancestors
    print(f"  Updating {len(ancestor_stats)} ancestor documents...")
    with conn.cursor() as cur:
        for doc_id, stats in tqdm(ancestor_stats.items(), desc="  Writing updates"):
            cur.execute("""
                UPDATE regulatory_documents
                SET descendant_flag_count = %s,
                    descendant_max_severity = %s,
                    has_descendant_analysis = %s
                WHERE id = %s
            """, (stats['flag_count'], stats['max_severity'], stats['has_analysis'], doc_id))
        conn.commit()

    elapsed = time.time() - start
    print(f"  Updated {len(ancestor_stats):,} ancestors in {elapsed:.1f}s")
    return len(ancestor_stats)


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
                updated = refresh_structure_stats_batched(conn, state)
            elif mode == 'analysis':
                updated = refresh_analysis_stats_incremental(conn, state)
            else:  # 'all'
                updated = refresh_structure_stats_batched(conn, state)
                updated += refresh_analysis_stats_incremental(conn, state)
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


# Backwards-compatible aliases for imports from other scripts
refresh_structure_stats = refresh_structure_stats_batched
refresh_analysis_stats = refresh_analysis_stats_incremental


if __name__ == "__main__":
    main()
