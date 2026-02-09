#!/usr/bin/env python3
"""
Detect Reserved/Repealed/Recodified Regulations

Scans regulation titles to identify documents that are reserved, repealed, or recodified,
and updates the regulatory_status column accordingly.

Examples:
    # Detect status for all documents
    python detect_regulatory_status.py

    # Detect status for NY only
    python detect_regulatory_status.py --state NY

    # Dry run (preview without updating)
    python detect_regulatory_status.py --dry-run

    # Reset all to active before detecting
    python detect_regulatory_status.py --reset
"""

import re
import sys
import argparse
from pathlib import Path
from typing import Optional, List, Tuple, Dict
from collections import defaultdict
from dotenv import load_dotenv

# Add backend directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT
from lib.db import get_db_connection

# Load environment variables from project root
load_dotenv(PROJECT_ROOT / '.env')

# =============================================================================
# Detection Patterns
# =============================================================================

# Patterns to detect regulatory status from title
# Order matters - more specific patterns first
# All patterns are case-insensitive (re.IGNORECASE used in detect_status_from_title)
TITLE_PATTERNS: List[Tuple[str, str]] = [
    # Bracketed variants (more specific)
    (r'\s*-\s*\[Repealed\]\s*$', 'repealed'),
    (r'\s*-\s*\[Reserved\]\s*$', 'reserved'),
    (r'\s*-\s*\[Expired\]\s*$', 'expired'),
    # Non-bracketed dash variants
    (r'\s*-\s*Repealed\s*$', 'repealed'),
    (r'\s*-\s*Reserved\s*$', 'reserved'),
    (r'\s*-\s*Recodified\s*$', 'recodified'),
    (r'\s*-\s*Renumbered\s*$', 'recodified'),  # NY uses Renumbered instead of Recodified
    (r'\s*-\s*Expired\s*$', 'expired'),
    # Parentheses variants (e.g., "Section Name (Repealed)")
    (r'\s*\(Repealed\)\s*$', 'repealed'),
    (r'\s*\(Reserved\)\s*$', 'reserved'),
    (r'\s*\(Recodified\)\s*$', 'recodified'),
    (r'\s*\(RECODIFIED\)\s*$', 'recodified'),  # Some are uppercase
]

# Patterns to extract recodification/renumbering target from content/notes
# NJ Examples:
#   "Recodified to N.J.A.C. 16:44-3.2 by R.2010 d.122"
#   "Recodified to N.J.A.C. 5:85-8.1"
# NY Examples:
#   "Renumbered to 253.15"
RECODIFIED_TO_PATTERNS = [
    # NJ: Recodified to N.J.A.C. X:X-X.X
    re.compile(r'Recodified\s+to\s+N\.?J\.?A\.?C\.?\s*([\d:A-Za-z.-]+)', re.IGNORECASE),
    # NY: Renumbered to XXX.XX
    re.compile(r'Renumbered\s+to\s+([\d.]+)', re.IGNORECASE),
]


def detect_status_from_title(title: str) -> Optional[str]:
    """
    Detect regulatory status from document title.

    Returns: 'repealed', 'reserved', 'recodified', or None if active
    """
    for pattern, status in TITLE_PATTERNS:
        if re.search(pattern, title, re.IGNORECASE):
            return status
    return None


def extract_recodified_to(content: str) -> Optional[str]:
    """
    Extract recodification/renumbering target citation from content.

    Returns: Citation like "16:44-3.2" (NJ) or "253.15" (NY), or None if not found
    """
    for pattern in RECODIFIED_TO_PATTERNS:
        match = pattern.search(content)
        if match:
            return match.group(1).strip()
    return None


def main():
    parser = argparse.ArgumentParser(
        description='Detect and update regulatory status (reserved/repealed/recodified)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--state',
        choices=['NY', 'NJ'],
        help='Only process documents from this state'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without updating database'
    )
    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset all documents to active status before detecting'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Limit number of documents to process (for testing)'
    )
    args = parser.parse_args()

    conn = get_db_connection()
    if not conn:
        print("Error: Could not connect to database")
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            # Reset if requested
            if args.reset and not args.dry_run:
                print("Resetting all documents to 'active' status...")
                if args.state:
                    cur.execute(
                        "UPDATE regulatory_documents SET regulatory_status = 'active', recodified_to = NULL WHERE state = %s",
                        (args.state,)
                    )
                else:
                    cur.execute(
                        "UPDATE regulatory_documents SET regulatory_status = 'active', recodified_to = NULL"
                    )
                conn.commit()
                print(f"Reset {cur.rowcount} documents\n")

            # Build query
            query = "SELECT id, title, content, state FROM regulatory_documents"
            params: List = []
            conditions = []

            if args.state:
                conditions.append("state = %s")
                params.append(args.state)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " ORDER BY state, source_index"

            if args.limit:
                query += f" LIMIT {args.limit}"

            print(f"Querying documents{' for state ' + args.state if args.state else ''}...")
            cur.execute(query, params if params else None)
            documents = cur.fetchall()
            print(f"Found {len(documents)} documents to process\n")

            # Track statistics
            stats: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
            updates: List[Tuple[str, Optional[str], int]] = []

            # Process each document
            for doc_id, title, content, state in documents:
                status = detect_status_from_title(title)
                recodified_to = None

                if status == 'recodified' and content:
                    recodified_to = extract_recodified_to(content)

                if status:
                    stats[state][status] += 1
                    updates.append((status, recodified_to, doc_id))
                else:
                    stats[state]['active'] += 1

            # Print statistics
            print("=" * 60)
            print("DETECTION RESULTS")
            print("=" * 60)

            for state in sorted(stats.keys()):
                print(f"\n{state}:")
                for status in ['active', 'reserved', 'repealed', 'recodified', 'expired']:
                    count = stats[state].get(status, 0)
                    if count > 0:
                        print(f"  {status:12s}: {count:,}")

            print(f"\n{'=' * 60}")
            print(f"Total documents needing update: {len(updates):,}")
            print("=" * 60)

            # Show sample of changes
            if updates and args.dry_run:
                print("\nSample changes (first 10):")
                for status, recodified_to, doc_id in updates[:10]:
                    cur.execute("SELECT title FROM regulatory_documents WHERE id = %s", (doc_id,))
                    row = cur.fetchone()
                    title = row[0] if row else "Unknown"
                    title_short = title[:60] + "..." if len(title) > 60 else title
                    if recodified_to:
                        print(f"  [{status}] -> {recodified_to}: {title_short}")
                    else:
                        print(f"  [{status}]: {title_short}")

            # Apply updates
            if updates and not args.dry_run:
                print("\nApplying updates...")
                update_count = 0
                for status, recodified_to, doc_id in updates:
                    cur.execute(
                        """
                        UPDATE regulatory_documents
                        SET regulatory_status = %s, recodified_to = %s
                        WHERE id = %s
                        """,
                        (status, recodified_to, doc_id)
                    )
                    update_count += 1
                    if update_count % 1000 == 0:
                        print(f"  Updated {update_count:,} documents...")

                conn.commit()
                print(f"\nSuccessfully updated {update_count:,} documents")
            elif args.dry_run:
                print("\n[DRY RUN] No changes made. Run without --dry-run to apply updates.")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
