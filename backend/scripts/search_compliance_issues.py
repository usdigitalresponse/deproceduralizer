#!/usr/bin/env python3
"""
Search for compliance issues in state regulations.

A generic tool for detecting various compliance issues (wet signatures,
mail-only submissions, fax requirements, obsolete technology, etc.)
across different states (NJ, NY).

Usage:
    # NJ wet signatures with statute lookup
    python search_compliance_issues.py --state nj --issue-type wet_signature

    # NJ wet signatures without statute lookup (faster)
    python search_compliance_issues.py --state nj --issue-type wet_signature --skip-statutes

    # NY mail-only submissions
    python search_compliance_issues.py --state ny --issue-type mail_only

    # Use batch API for cheaper processing
    python search_compliance_issues.py --state nj --issue-type certified_mail --use-batch-api

    # Process completed batch
    python search_compliance_issues.py --state nj --issue-type certified_mail --process-batch msgbatch_xxx

    # List available issue types
    python search_compliance_issues.py --list-types

Examples:
    # Quick test run (limit matches, skip DB save)
    python search_compliance_issues.py --state nj --issue-type fax --limit 10 --skip-db

    # Full run with all outputs
    python search_compliance_issues.py --state nj --issue-type wet_signature
"""

import sys
import asyncio
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import OUTPUTS_DIR
from dotenv import load_dotenv
from config import PROJECT_ROOT

# Load environment variables
load_dotenv(PROJECT_ROOT / '.env')

from compliance_issues import (
    STATES,
    ISSUE_TYPES,
    ComplianceIssueSearcher,
)


def list_issue_types():
    """Print available issue types."""
    print("\nAvailable issue types:")
    print("-" * 60)
    for name, config in ISSUE_TYPES.items():
        print(f"  {name:20} - {config.display_name}")
        if config.description:
            print(f"                         {config.description}")
    print()


def list_states():
    """Print available states."""
    print("\nAvailable states:")
    print("-" * 60)
    for code, config in STATES.items():
        statute_status = "✓ statutes" if config.has_statute_data() else "no statutes"
        print(f"  {code:5} - {config.state_code} ({statute_status})")
    print()


def main():
    parser = argparse.ArgumentParser(
        description='Search for compliance issues in state regulations',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Main arguments
    parser.add_argument(
        '--state', '-s',
        choices=list(STATES.keys()),
        help='State to search (nj, ny)'
    )
    parser.add_argument(
        '--issue-type', '-t',
        choices=list(ISSUE_TYPES.keys()),
        help='Type of compliance issue to search for'
    )

    # Statute control
    parser.add_argument(
        '--skip-statutes',
        action='store_true',
        help='Skip statute lookup (faster, works for any state)'
    )
    parser.add_argument(
        '--with-statutes',
        action='store_true',
        default=True,
        help='Enable statute lookup if available (default)'
    )

    # Processing options
    parser.add_argument(
        '--no-llm',
        action='store_true',
        help='Skip LLM analysis (just do regex triage)'
    )
    parser.add_argument(
        '--skip-db',
        action='store_true',
        help='Skip saving to database'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit number of matches to analyze'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=5,
        help='Batch size for async LLM calls (default: 5)'
    )

    # Batch API
    parser.add_argument(
        '--use-batch-api',
        action='store_true',
        help='Submit to Anthropic Batch API (50%% cheaper, up to 24h processing)'
    )
    parser.add_argument(
        '--process-batch',
        type=str,
        metavar='BATCH_ID',
        help='Process a completed batch (e.g., msgbatch_xxx)'
    )

    # Output
    parser.add_argument(
        '--output', '-o',
        type=Path,
        help='Output file path (default: auto-generated)'
    )

    # Info commands
    parser.add_argument(
        '--list-types',
        action='store_true',
        help='List available issue types and exit'
    )
    parser.add_argument(
        '--list-states',
        action='store_true',
        help='List available states and exit'
    )

    args = parser.parse_args()

    # Handle info commands
    if args.list_types:
        list_issue_types()
        return

    if args.list_states:
        list_states()
        return

    # Validate required arguments
    if not args.state:
        parser.error("--state is required (use --list-states to see options)")

    if not args.issue_type:
        parser.error("--issue-type is required (use --list-types to see options)")

    # Get configurations
    state_config = STATES[args.state]
    issue_config = ISSUE_TYPES[args.issue_type]

    print("=" * 70)
    print(f"{state_config.state_code} {issue_config.display_name.upper()} SEARCH")
    print("=" * 70)
    print()

    # Determine statute handling
    with_statutes = not args.skip_statutes

    # Create searcher
    searcher = ComplianceIssueSearcher(
        state_config=state_config,
        issue_config=issue_config,
        with_statutes=with_statutes,
    )

    # Search for matches
    matches = searcher.search(limit=args.limit)

    if not matches:
        print("No matches found.")
        return

    if args.limit:
        print(f"Limited to {len(matches)} matches")

    # Handle --process-batch
    if args.process_batch:
        results = searcher.process_batch_results(args.process_batch, matches)
        if not results:
            return

        # Output
        print("[3/3] Saving results...")
        searcher.print_results(results)

        # Save JSON
        output_file = args.output or OUTPUTS_DIR / f"{state_config.state_code.lower()}_{issue_config.name}_analysis.json"
        searcher.save_results_json(results, output_file)

        # Generate HTML
        html_file = output_file.with_suffix('.html')
        searcher.generate_html(results, html_file)

        # Save to database
        if not args.skip_db:
            searcher.save_to_database(results)
        else:
            print("\n[SKIPPED] Database save (--skip-db flag)")

        print()
        print("=" * 70)
        print("PROCESSING COMPLETE")
        print("=" * 70)
        return

    # Handle --use-batch-api
    if args.use_batch_api:
        print()
        print("=" * 70)
        print("BATCH API SUBMISSION")
        print("=" * 70)

        batch_id = searcher.submit_batch(matches)

        print()
        print("=" * 70)
        print("BATCH SUBMITTED")
        print("=" * 70)
        print(f"Batch ID: {batch_id}")
        print(f"Requests: {len(matches)}")
        print()
        print("Batch processing takes up to 24 hours (50% cheaper).")
        print()
        print("Check status and process:")
        print(f"  python search_compliance_issues.py --state {args.state} --issue-type {args.issue_type} --process-batch {batch_id}")
        print()
        return

    # LLM analysis (realtime)
    if not args.no_llm:
        results = asyncio.run(searcher.analyze_async(
            matches,
            batch_size=args.batch_size,
        ))
    else:
        results = matches

    # Output
    searcher.print_results(results)

    # Save JSON
    output_file = args.output or OUTPUTS_DIR / f"{state_config.state_code.lower()}_{issue_config.name}_analysis.json"
    searcher.save_results_json(results, output_file)

    # Generate HTML (only if LLM analysis was done)
    if not args.no_llm:
        html_file = output_file.with_suffix('.html')
        searcher.generate_html(results, html_file)

    # Save to database (only if LLM analysis was done and not skipped)
    if not args.no_llm and not args.skip_db:
        searcher.save_to_database(results)
    elif args.skip_db:
        print("\n[SKIPPED] Database save (--skip-db flag)")


if __name__ == "__main__":
    main()
