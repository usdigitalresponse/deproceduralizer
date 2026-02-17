#!/usr/bin/env python3
"""
Compliance Issues Scanner.

Scans regulations for compliance issues using regex patterns and saves
matches to the compliance_issues table. LLM analysis is handled separately
by the research pipeline (Tier 1-3).

See: https://github.com/michaeleboyce/deproceduralizer/issues/94

Usage:
    # Scan and save regex matches
    python scan_compliance_issues.py --state nj
    python scan_compliance_issues.py --state nj --issue wet_signature

    # Scan only tagged documents (e.g., NYC childcare titles)
    python scan_compliance_issues.py --state nyc --tag scan:compliance

    # Dry run (search only, no save)
    python scan_compliance_issues.py --state nj --dry-run

    # Other options
    python scan_compliance_issues.py --list-issues
    python scan_compliance_issues.py --state nj --limit 100
"""

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
from tqdm import tqdm

# Project root and env loading
PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

from compliance_issues.searcher import ComplianceIssueSearcher
from compliance_issues.config import STATES, ISSUE_TYPES, list_issue_types


def scan_and_save(state_code: str, issues: list[str], limit: int | None, tag: str | None):
    """Scan for regex matches and save to database."""
    state_config = STATES[state_code]

    print("\n" + "=" * 70)
    print(f"COMPLIANCE ISSUES SCANNER - {state_code.upper()}")
    print("=" * 70)
    print(f"Issue types: {len(issues)}")
    if tag:
        print(f"Tag filter: {tag}")
    print(f"Mode: Regex scan + save (no LLM)")

    total_saved = 0

    for issue_type in tqdm(issues, desc=f"{state_code.upper()} issues", unit="issue"):
        issue_config = ISSUE_TYPES[issue_type]

        searcher = ComplianceIssueSearcher(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=False,
        )

        matches = searcher.search(limit=limit, tag=tag)

        if not matches:
            continue

        saved = searcher.save_to_database(matches)
        total_saved += saved

    print("\n" + "=" * 70)
    print(f"TOTAL: {total_saved} regex matches saved")
    print(f"\nNext step: Run the research pipeline for LLM analysis:")
    print(f"  python -m scripts.research_pipeline.cli --state {state_code} --all-issues --execute")


def dry_run(state_code: str, issues: list[str], limit: int | None, tag: str | None):
    """Search only, no save."""
    state_config = STATES[state_code]

    print("\n" + "=" * 70)
    print(f"DRY RUN - {state_code.upper()}")
    if tag:
        print(f"Tag filter: {tag}")
    print("=" * 70)

    total = 0
    for issue_type in issues:
        issue_config = ISSUE_TYPES[issue_type]
        searcher = ComplianceIssueSearcher(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=False,
        )
        matches = searcher.search(limit=limit, tag=tag)
        total += len(matches)
        if matches:
            print(f"  {issue_type}: {len(matches)} matches")

    print(f"\nTotal: {total} matches across {len(issues)} issue types")


def main():
    parser = argparse.ArgumentParser(
        description='Scan regulations for compliance issues (regex only)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument('--state', '-s', choices=['nj', 'ny', 'nyc'], help='State to scan')
    parser.add_argument('--issue', '-i', help='Specific issue type (default: all)')
    parser.add_argument('--tag', '-t', help='Only scan documents with this tag (e.g., scan:compliance)')
    parser.add_argument('--limit', '-l', type=int, help='Limit matches per issue type')
    parser.add_argument('--dry-run', action='store_true', help='Search only, no save')
    parser.add_argument('--list-issues', action='store_true', help='List issue types')

    args = parser.parse_args()

    if args.list_issues:
        list_issue_types()
        return

    if not args.state:
        parser.error("--state required (or use --list-issues)")

    if args.issue:
        if args.issue not in ISSUE_TYPES:
            print(f"Unknown issue: {args.issue}")
            sys.exit(1)
        issues = [args.issue]
    else:
        issues = sorted(ISSUE_TYPES.keys())

    if args.dry_run:
        dry_run(args.state, issues, args.limit, args.tag)
    else:
        scan_and_save(args.state, issues, args.limit, args.tag)


if __name__ == '__main__':
    main()
