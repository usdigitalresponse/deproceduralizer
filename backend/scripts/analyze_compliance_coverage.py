#!/usr/bin/env python3
"""
Analyze compliance issue regex coverage across states.

Shows:
1. Match counts per issue type per state
2. Document overlap - how many docs match 1, 2, 3, etc. issue types
3. Total unique documents and total LLM calls needed
"""

import re
from collections import defaultdict, Counter

from dotenv import load_dotenv
from config import PROJECT_ROOT
load_dotenv(PROJECT_ROOT / '.env')

from lib.db import get_db_connection
from compliance_issues import STATES, ISSUE_TYPES


def analyze_state(state_key: str):
    """Analyze all issue types for a state and show overlap."""
    state_config = STATES[state_key]
    print(f"\n{'='*70}")
    print(f"{state_config.state_code} COMPLIANCE ISSUE COVERAGE ANALYSIS")
    print(f"{'='*70}\n")

    # Pre-compile all regex patterns for all issue types
    compiled_patterns: dict[str, dict[str, list[re.Pattern]]] = {}
    for issue_key, issue_config in ISSUE_TYPES.items():
        compiled_patterns[issue_key] = {}
        for tier_name, patterns in issue_config.tiers.items():
            compiled_patterns[issue_key][tier_name] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

    # Query database ONCE
    print(f"Querying {state_config.state_code} documents from database...", end=" ", flush=True)
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return None

    rows = conn.execute(
        "SELECT id, content FROM regulatory_documents WHERE state = %s AND content IS NOT NULL",
        (state_config.state_code,)
    ).fetchall()
    conn.close()
    print(f"{len(rows)} documents")

    # Track which documents match each issue type
    doc_issues: dict[int, set[str]] = defaultdict(set)
    issue_counts: dict[str, int] = defaultdict(int)
    tier_details: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    print(f"Running regex patterns...", end=" ", flush=True)
    for doc_id, content in rows:
        if not content:
            continue
        content_lower = content.lower()

        # Check each issue type
        for issue_key, tiers in compiled_patterns.items():
            matched_tier = None
            for tier_name in sorted(tiers.keys()):
                for pattern in tiers[tier_name]:
                    if pattern.search(content_lower):
                        matched_tier = tier_name
                        break
                if matched_tier:
                    break

            if matched_tier:
                doc_issues[doc_id].add(issue_key)
                issue_counts[issue_key] += 1
                tier_details[issue_key][matched_tier] += 1

    print("done")

    # Summary
    print(f"\n{'-'*70}")
    print("MATCH COUNTS BY ISSUE TYPE:")
    print(f"{'-'*70}")
    for issue_key, count in issue_counts.items():
        tiers = tier_details[issue_key]
        tier_str = ", ".join(f"{k}:{v}" for k, v in sorted(tiers.items()))
        print(f"  {issue_key:20} {count:>6} matches  ({tier_str})")

    total_matches = sum(issue_counts.values())
    print(f"\n  {'TOTAL':20} {total_matches:>6} regex matches")

    # Overlap analysis
    print(f"\n{'-'*70}")
    print("DOCUMENT OVERLAP ANALYSIS:")
    print(f"{'-'*70}")

    # Count how many docs have 1, 2, 3, etc. issue types
    overlap_counts = Counter(len(issues) for issues in doc_issues.values())

    unique_docs = len(doc_issues)
    print(f"\n  Unique documents with any issue: {unique_docs}")
    print(f"\n  Documents by number of issue types matched:")

    total_calls = 0
    for num_issues in sorted(overlap_counts.keys()):
        doc_count = overlap_counts[num_issues]
        calls = doc_count * num_issues
        total_calls += calls
        print(f"    {num_issues} issue type(s): {doc_count:>5} docs ({calls:>6} LLM calls)")

    print(f"\n  LLM CALL OPTIONS:")
    print(f"    Separate calls (1 per issue type per doc): {total_calls:>6} calls")
    print(f"    Combined calls (1 per doc, all issues):    {unique_docs:>6} calls")
    print(f"    Savings from combined approach:            {total_calls - unique_docs:>6} fewer calls ({(1 - unique_docs/total_calls)*100:.1f}%)")

    # Show which issue types overlap most
    print(f"\n{'-'*70}")
    print("OVERLAP PAIRS (documents matching both):")
    print(f"{'-'*70}")

    issue_keys = list(ISSUE_TYPES.keys())
    for i, issue1 in enumerate(issue_keys):
        for issue2 in issue_keys[i+1:]:
            both = sum(1 for issues in doc_issues.values() if issue1 in issues and issue2 in issues)
            if both > 0:
                print(f"  {issue1} + {issue2}: {both} docs")

    return {
        'state': state_config.state_code,
        'issue_counts': issue_counts,
        'unique_docs': unique_docs,
        'total_matches': total_matches,
        'total_calls': total_calls,
        'overlap_counts': dict(overlap_counts),
    }


def main():
    results = {}
    for state_key in STATES.keys():
        results[state_key] = analyze_state(state_key)

    # Grand total
    print(f"\n{'='*70}")
    print("GRAND TOTAL ACROSS ALL STATES")
    print(f"{'='*70}")

    total_unique = sum(r['unique_docs'] for r in results.values() if r)
    total_matches = sum(r['total_matches'] for r in results.values() if r)
    total_calls = sum(r['total_calls'] for r in results.values() if r)

    print(f"\n  Unique documents with any issue: {total_unique}")
    print(f"\n  LLM CALL OPTIONS:")
    print(f"    Separate calls (1 per issue type per doc): {total_calls:>6} calls")
    print(f"    Combined calls (1 per doc, all issues):    {total_unique:>6} calls")
    print(f"    Savings from combined approach:            {total_calls - total_unique:>6} fewer calls ({(1 - total_unique/total_calls)*100:.1f}%)")


if __name__ == "__main__":
    main()
