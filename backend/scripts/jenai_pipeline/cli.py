#!/usr/bin/env python3
"""
CLI for the JenAI pipeline.

Runs regulatory sections through the two-tier implementation analysis pipeline.
Defaults are cost-safe: dry-run mode by default.

Usage:
    cd backend && python3 -m scripts.jenai_pipeline --help

    # Preview what would run (default is dry-run)
    python3 -m scripts.jenai_pipeline --state nj

    # Run with execution
    python3 -m scripts.jenai_pipeline --state nj --execute

    # Filter by title, limit sections
    python3 -m scripts.jenai_pipeline --state nj --title 3 --limit 50 --execute

    # Stop after Tier 1
    python3 -m scripts.jenai_pipeline --state nj --max-tier 1 --execute

    # Run only Tier 2 for sections with existing Tier 1 results
    python3 -m scripts.jenai_pipeline --state nj --tier2-only --execute
"""

import argparse
import os
import sys
from dotenv import load_dotenv


def state_validator(value: str) -> str:
    """Validate --state flag."""
    normalized = value.lower()
    if normalized not in ('nj', 'ny'):
        raise argparse.ArgumentTypeError(
            f"Invalid state '{value}'. Must be 'nj' or 'ny'."
        )
    return normalized


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="JenAI two-tier regulatory implementation analysis pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        '--state', type=state_validator, required=True,
        help="State to analyze: 'nj' or 'ny'",
    )
    parser.add_argument(
        '--title', type=int, default=None,
        help="Filter by title number (e.g., 18 for Title 18)",
    )
    parser.add_argument(
        '--part', type=str, default=None,
        help="Filter by part number (e.g., 413 for child care)",
    )
    parser.add_argument(
        '--limit', type=int, default=None,
        help="Max sections to analyze (default: 100)",
    )
    parser.add_argument(
        '--max-tier', type=int, default=2, choices=[1, 2],
        help="Stop after this tier (default: 2)",
    )
    parser.add_argument(
        '--tier2-only', action='store_true',
        help="Only run Tier 2 for sections with existing Tier 1 results",
    )
    parser.add_argument(
        '--execute', action='store_true',
        help="Actually run the pipeline (default is dry-run)",
    )
    parser.add_argument(
        '--include-all-types', action='store_true',
        help="Include reserved, definitions, scope, and very short sections (excluded by default)",
    )
    parser.add_argument(
        '--force', action='store_true',
        help="Re-analyze sections that already have JenAI analyses",
    )
    parser.add_argument(
        '--document-id', type=int, nargs='+', default=None,
        help="Specific document ID(s) to analyze",
    )
    parser.add_argument(
        '--realtime', action='store_true',
        help="Use realtime API instead of batch (faster but 2x cost, no batch discount)",
    )

    return parser


def main():
    # Force unbuffered stdout so progress appears in real time when piped
    os.environ['PYTHONUNBUFFERED'] = '1'
    sys.stdout.reconfigure(line_buffering=True)

    load_dotenv()

    parser = build_parser()
    args = parser.parse_args()

    from .pipeline_runner import run_pipeline

    dry_run = not args.execute

    if not dry_run:
        mode = "REALTIME" if args.realtime else "BATCH"
        print("=" * 60)
        print(f"  JenAI Pipeline - LIVE EXECUTION ({mode})")
        print("  This will make API calls and write to the database.")
        if args.realtime:
            print("  Realtime mode: 2x cost, no batch discount.")
        print("=" * 60)

    summary = run_pipeline(
        state=args.state,
        title=args.title,
        part=args.part,
        limit=args.limit,
        max_tier=args.max_tier,
        tier2_only=args.tier2_only,
        dry_run=dry_run,
        include_all_types=args.include_all_types,
        force=args.force,
        realtime=args.realtime,
        document_ids=args.document_id,
    )

    print(f"\n{'=' * 40}")
    print("Pipeline Summary:")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    print(f"{'=' * 40}")


if __name__ == '__main__':
    main()
