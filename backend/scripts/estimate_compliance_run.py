#!/usr/bin/env python3
"""
Quick estimation script for compliance issue scanning.
Estimates regex matches, tokens, time, and cost WITHOUT running LLM calls.
"""

import os
import re
import sys
import time
from pathlib import Path
from collections import defaultdict

# Setup paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / '.env')

from lib.db import get_db_connection
from compliance_issues.config import STATES, ISSUE_TYPES


# Haiku 4.5 pricing (per 1M tokens)
INPUT_COST_PER_M = 0.80
OUTPUT_COST_PER_M = 4.00

# Estimates
AVG_OUTPUT_TOKENS = 300  # typical structured response
SYSTEM_PROMPT_TOKENS = 600  # avg system prompt size
CALLS_PER_SECOND = 5  # conservative rate limit estimate


def count_regex_matches_fast(conn, state_code: str, patterns: list[str]) -> tuple[int, list[dict]]:
    """Count matches and return sample documents for token estimation."""
    cursor = conn.cursor()

    # Build combined regex pattern
    combined_pattern = '|'.join(f'({p})' for p in patterns)

    # Get count and samples in one query using SIMILAR TO or regex
    # PostgreSQL uses ~ for regex matching
    query = """
        SELECT id, title, content, LENGTH(content) as text_len
        FROM regulatory_documents
        WHERE state = %s
        AND content ~* %s
    """

    cursor.execute(query, (state_code.upper(), combined_pattern))
    rows = cursor.fetchall()

    count = len(rows)
    samples = [
        {'id': r[0], 'title': r[1], 'text_len': r[3]}
        for r in rows[:10]  # sample first 10 for token estimation
    ]

    return count, samples


def estimate_tokens(text_len: int) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return text_len // 4


def main():
    print("=" * 70)
    print("COMPLIANCE ISSUE SCAN ESTIMATION")
    print("=" * 70)

    conn = get_db_connection()

    # Track totals
    total_matches = 0
    total_input_tokens = 0
    results = []

    start_time = time.time()

    for state_code, state_config in STATES.items():
        print(f"\n{state_code.upper()}:")
        print("-" * 40)

        for issue_name, issue_config in ISSUE_TYPES.items():
            count, samples = count_regex_matches_fast(
                conn,
                state_code,
                issue_config.patterns
            )

            if count == 0:
                continue

            # Estimate tokens for this issue type
            avg_text_len = sum(s['text_len'] for s in samples) / len(samples) if samples else 0
            avg_context_tokens = estimate_tokens(int(avg_text_len))

            # Per-call tokens: system prompt + user prompt (regulation context)
            input_tokens_per_call = SYSTEM_PROMPT_TOKENS + avg_context_tokens
            total_input_for_issue = count * input_tokens_per_call
            total_output_for_issue = count * AVG_OUTPUT_TOKENS

            total_matches += count
            total_input_tokens += total_input_for_issue

            results.append({
                'state': state_code,
                'issue': issue_name,
                'count': count,
                'avg_doc_tokens': avg_context_tokens,
                'input_tokens': total_input_for_issue,
                'output_tokens': total_output_for_issue,
            })

            print(f"  {issue_name:30} {count:>6,} matches  (~{avg_context_tokens:,} tok/doc)")

    elapsed = time.time() - start_time
    conn.close()

    # Calculate totals
    total_output_tokens = total_matches * AVG_OUTPUT_TOKENS

    input_cost = (total_input_tokens / 1_000_000) * INPUT_COST_PER_M
    output_cost = (total_output_tokens / 1_000_000) * OUTPUT_COST_PER_M
    total_cost = input_cost + output_cost

    estimated_time_seconds = total_matches / CALLS_PER_SECOND
    estimated_time_minutes = estimated_time_seconds / 60
    estimated_time_hours = estimated_time_minutes / 60

    # Print summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"\nTotal regex matches (LLM calls):  {total_matches:,}")
    print(f"Total input tokens:               {total_input_tokens:,}")
    print(f"Total output tokens:              {total_output_tokens:,}")
    print(f"\nEstimation took:                  {elapsed:.1f}s")

    print(f"\n--- COST ESTIMATE (Haiku 4.5) ---")
    print(f"Input cost:                       ${input_cost:.2f}")
    print(f"Output cost:                      ${output_cost:.2f}")
    print(f"TOTAL COST:                       ${total_cost:.2f}")

    print(f"\n--- TIME ESTIMATE ---")
    print(f"At {CALLS_PER_SECOND} calls/sec:               {estimated_time_minutes:.0f} min ({estimated_time_hours:.1f} hrs)")

    # Top 10 by match count
    print(f"\n--- TOP 10 BY MATCH COUNT ---")
    sorted_results = sorted(results, key=lambda x: x['count'], reverse=True)
    for r in sorted_results[:10]:
        print(f"  {r['state'].upper()} {r['issue']:30} {r['count']:>6,}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
