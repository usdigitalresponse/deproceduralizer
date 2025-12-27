#!/usr/bin/env python3
"""
Backfill is_verbatim field for existing compliance issues.

Fetches regulation content for each issue and checks if requirement_text
is a verbatim substring match.

Usage:
    python backend/scripts/backfill_is_verbatim.py [--dry-run] [--limit N]
"""

import argparse
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / '.env')

sys.path.insert(0, str(Path(__file__).parent.parent))

from shared_utils import get_db_connection
from compliance_issues.validation import is_verbatim_match


def backfill_is_verbatim(dry_run: bool = False, limit: int = None):
    """
    Backfill is_verbatim for existing compliance issues where it is NULL.
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    # Get issues with NULL is_verbatim, joining to get regulation content
    query = """
        SELECT
            ci.id,
            ci.requirement_text,
            ci.matched_context,
            rd.content
        FROM compliance_issues ci
        JOIN regulatory_documents rd ON ci.document_id = rd.id
        WHERE ci.is_verbatim IS NULL
          AND ci.requirement_text IS NOT NULL
        ORDER BY ci.id
    """

    if limit:
        query += f" LIMIT {limit}"

    try:
        rows = conn.execute(query).fetchall()
        total = len(rows)
        print(f"Found {total} issues to process")

        if total == 0:
            print("No issues need backfilling.")
            conn.close()
            return

        updated = 0
        verbatim_count = 0
        paraphrased_count = 0

        for i, (issue_id, requirement_text, matched_context, content) in enumerate(rows):
            # Compute is_verbatim
            is_verbatim = is_verbatim_match(
                requirement_text=requirement_text,
                source_text=content or '',
                fallback_context=matched_context,
            )

            if is_verbatim:
                verbatim_count += 1
            else:
                paraphrased_count += 1

            if not dry_run:
                conn.execute(
                    "UPDATE compliance_issues SET is_verbatim = %s WHERE id = %s",
                    (is_verbatim, issue_id)
                )

            updated += 1

            # Progress every 100
            if (i + 1) % 100 == 0:
                pct = int((i + 1) / total * 100)
                print(f"  Processed {i + 1}/{total} ({pct}%) - {verbatim_count} verbatim, {paraphrased_count} paraphrased")

        if not dry_run:
            conn.commit()

        print(f"\nDone! Processed {updated} issues")
        print(f"  Verbatim: {verbatim_count}")
        print(f"  Paraphrased: {paraphrased_count}")

        if dry_run:
            print("\n(Dry run - no changes made)")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill is_verbatim field")
    parser.add_argument("--dry-run", action="store_true", help="Don't commit changes")
    parser.add_argument("--limit", type=int, help="Limit number of records to process")
    args = parser.parse_args()

    backfill_is_verbatim(dry_run=args.dry_run, limit=args.limit)
