#!/usr/bin/env python3
"""
Validate and fix is_verbatim flags on barrier_issues.text_examples.

Checks each text_example against the source regulation content using fuzzy
matching. If the match ratio is below a threshold, marks is_verbatim=false.

Usage:
  cd backend && source .venv/bin/activate

  # Dry run — show what would change:
  python scripts/validate_verbatim.py

  # Actually update the database:
  python scripts/validate_verbatim.py --execute

  # Limit to specific title:
  python scripts/validate_verbatim.py --title 18 --execute
"""

import argparse
import os
from difflib import SequenceMatcher
from dotenv import load_dotenv
from pathlib import Path
import psycopg

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")

# Threshold: below this ratio, the text_example is considered paraphrased.
# 0.6 cleanly separates verbatim (0.9+) from paraphrased (0.3-0.5) based on testing.
VERBATIM_THRESHOLD = 0.6


def best_match_ratio(example: str, content: str) -> float:
    """Find the best fuzzy match ratio for an example substring in content."""
    ex = example.strip().lower()
    c = content.lower()

    # Quick exact check on first 40 chars
    if ex[:40] in c:
        return 1.0

    # Sliding window fuzzy match on first 80 chars of example
    ex_snippet = ex[:80]
    ex_len = len(ex)
    best = 0.0
    step = max(1, ex_len // 4)
    for start in range(0, len(c) - min(ex_len, len(c)) + 1, step):
        window = c[start:start + ex_len + 20]
        ratio = SequenceMatcher(None, ex_snippet, window[:80]).ratio()
        if ratio > best:
            best = ratio
        if best > 0.85:
            break
    return best


def main():
    parser = argparse.ArgumentParser(description="Validate is_verbatim on barrier_issues")
    parser.add_argument("--execute", action="store_true", help="Actually update the DB")
    parser.add_argument("--title", type=str, help="Filter by NYCRR title number")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of issues to check")
    args = parser.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    title_filter = ""
    if args.title:
        title_filter = f"AND rd.nycrr_title = {int(args.title)}"

    limit_clause = f"LIMIT {args.limit}" if args.limit else ""

    cur.execute(f"""
        SELECT ji.id, ji.text_examples, ji.is_verbatim, rd.content, rd.citation
        FROM barrier_issues ji
        JOIN regulatory_documents rd ON ji.document_id = rd.id
        WHERE ji.text_examples IS NOT NULL
          AND array_length(ji.text_examples, 1) > 0
          AND rd.content IS NOT NULL
          {title_filter}
        ORDER BY ji.id
        {limit_clause}
    """)

    rows = cur.fetchall()
    print(f"Checking {len(rows)} issues with text_examples...")

    to_fix = []  # (id, was_verbatim)
    stats = {"good": 0, "close": 0, "paraphrased": 0, "total_examples": 0}

    for row in rows:
        issue_id, examples, is_verbatim, content, citation = row
        if not content or not examples:
            continue

        all_good = True
        for ex in examples:
            stats["total_examples"] += 1
            ratio = best_match_ratio(ex, content)
            if ratio >= 0.9:
                stats["good"] += 1
            elif ratio >= VERBATIM_THRESHOLD:
                stats["close"] += 1
            else:
                stats["paraphrased"] += 1
                all_good = False

        # If any example is paraphrased and currently marked verbatim, flag it
        if not all_good and is_verbatim:
            to_fix.append((issue_id, citation))

    print(f"\nResults across {stats['total_examples']} text_examples:")
    print(f"  Verbatim (>=0.9):    {stats['good']} ({round(100*stats['good']/max(stats['total_examples'],1))}%)")
    print(f"  Close (0.6-0.9):     {stats['close']} ({round(100*stats['close']/max(stats['total_examples'],1))}%)")
    print(f"  Paraphrased (<0.6):  {stats['paraphrased']} ({round(100*stats['paraphrased']/max(stats['total_examples'],1))}%)")
    print(f"\nIssues to fix (is_verbatim=true but has paraphrased examples): {len(to_fix)}")

    if to_fix[:5]:
        print("\nSample fixes:")
        for issue_id, citation in to_fix[:5]:
            print(f"  id={issue_id} {citation}")

    if args.execute and to_fix:
        ids = [t[0] for t in to_fix]
        cur.execute(
            "UPDATE barrier_issues SET is_verbatim = false WHERE id = ANY(%s)",
            (ids,),
        )
        conn.commit()
        print(f"\nUpdated {len(to_fix)} issues: is_verbatim = false")
    elif to_fix:
        print(f"\nDry run — use --execute to update {len(to_fix)} issues")

    conn.close()


if __name__ == "__main__":
    main()
