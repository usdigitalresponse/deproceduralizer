#!/usr/bin/env python3
"""
Entry point script showing how to run the full regulation analysis pipeline.

This script demonstrates the workflow and can be used to run individual steps
or the full pipeline.

Pipeline Steps:
1. Scrape regulations (NY or NJ) → writes to DB
2. Extract definitions from regulations → writes to DB
3. Analyze red flags in regulations → writes to DB

Note: For compliance issues, use backend/scripts/compliance_issues/searcher.py directly.

Usage:
    # Show available commands
    python run_pipeline.py --help

    # Run full pipeline for NJ
    python run_pipeline.py --state NJ --all

    # Run individual steps
    python run_pipeline.py --state NJ --scrape
    python run_pipeline.py --state NJ --definitions
    python run_pipeline.py --state NJ --red-flags

    # Common options
    python run_pipeline.py --state NJ --definitions --title 3A --skip-done
    python run_pipeline.py --state NY --red-flags --title 18 --chapter II

    # Dry run to preview what would be processed
    python run_pipeline.py --state NJ --all --dry-run
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import List

# Backend directory
BACKEND_DIR = Path(__file__).parent
SCRIPTS_DIR = BACKEND_DIR / "scripts"


def run_command(cmd: List[str], description: str, dry_run: bool = False) -> bool:
    """Run a command with nice output."""
    print()
    print("=" * 70)
    print(f"  {description}")
    print("=" * 70)

    cmd_str = " ".join(cmd)
    print(f"  Command: {cmd_str}")
    print()

    if dry_run:
        print("  [DRY RUN] Would execute above command")
        return True

    result = subprocess.run(cmd, cwd=BACKEND_DIR)
    if result.returncode != 0:
        print(f"\n  ❌ Command failed with exit code {result.returncode}")
        return False

    print(f"\n  ✓ Complete")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Run the regulation analysis pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full pipeline for NJ
  python run_pipeline.py --state NJ --all

  # Just definitions for NY Title 18
  python run_pipeline.py --state NY --definitions --title 18

  # Red flags analysis with filters
  python run_pipeline.py --state NJ --red-flags --title 3A --skip-done

  # Preview what would be run
  python run_pipeline.py --state NJ --all --dry-run
        """,
    )

    # State selection
    parser.add_argument(
        "--state",
        required=True,
        choices=["NY", "NJ"],
        help="State to process (NY or NJ)",
    )

    # Pipeline steps
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all pipeline steps",
    )
    parser.add_argument(
        "--scrape",
        action="store_true",
        help="Step 1: Scrape regulations from source",
    )
    parser.add_argument(
        "--definitions",
        action="store_true",
        help="Step 2: Extract definitions using LLM",
    )
    parser.add_argument(
        "--red-flags",
        action="store_true",
        help="Step 3: Analyze red flags using LLM",
    )

    # Filters
    parser.add_argument(
        "--title",
        type=str,
        help="Filter by title (e.g., '3A', '18')",
    )
    parser.add_argument(
        "--chapter",
        type=str,
        help="Filter by chapter (e.g., 'II', '23')",
    )
    parser.add_argument(
        "--subchapter",
        type=str,
        help="Filter by subchapter (e.g., 'C')",
    )
    parser.add_argument(
        "--part",
        type=str,
        help="Filter by part (e.g., '1202')",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of documents to process",
    )

    # Options
    parser.add_argument(
        "--skip-done",
        action="store_true",
        help="Skip documents that have already been processed",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be run without executing",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Use batch API for definitions (50%% cheaper, slower)",
    )

    args = parser.parse_args()

    # Validate
    if not any([args.all, args.scrape, args.definitions, args.red_flags]):
        print("ERROR: Specify at least one step: --all, --scrape, --definitions, --red-flags")
        sys.exit(1)

    # Determine which steps to run
    steps = []
    if args.all or args.scrape:
        steps.append("scrape")
    if args.all or args.definitions:
        steps.append("definitions")
    if args.all or args.red_flags:
        steps.append("red_flags")

    print()
    print("=" * 70)
    print(f"  REGULATION ANALYSIS PIPELINE - {args.state}")
    print("=" * 70)
    print(f"  Steps: {', '.join(steps)}")
    if args.title:
        print(f"  Title filter: {args.title}")
    if args.chapter:
        print(f"  Chapter filter: {args.chapter}")
    if args.skip_done:
        print(f"  Skip already processed: Yes")
    if args.dry_run:
        print(f"  Mode: DRY RUN")

    # Build filter args for commands
    filter_args = []
    if args.title:
        filter_args.extend(["--title", args.title])
    if args.chapter:
        filter_args.extend(["--chapter", args.chapter])
    if args.subchapter:
        filter_args.extend(["--subchapter", args.subchapter])
    if args.part:
        filter_args.extend(["--part", args.part])
    if args.limit:
        filter_args.extend(["--limit", str(args.limit)])
    if args.skip_done:
        filter_args.append("--skip-done")

    success = True

    # Step 1: Scrape
    if "scrape" in steps:
        scraper = f"{args.state.lower()}_regulations_scraper.py"
        cmd = [sys.executable, str(SCRIPTS_DIR / scraper)]
        success = run_command(
            cmd,
            f"Scraping {args.state} regulations",
            dry_run=args.dry_run,
        )
        if not success and not args.dry_run:
            print("\n❌ Pipeline stopped due to scraper error")
            sys.exit(1)

    # Step 2: Definitions
    if "definitions" in steps:
        if args.batch:
            # Use batch API (submit only - user must check status and process later)
            cmd = [
                sys.executable, str(SCRIPTS_DIR / "batch_definitions.py"),
                "submit",
                "--state", args.state,
            ] + filter_args

            if args.dry_run:
                cmd.append("--dry-run")

            success = run_command(
                cmd,
                f"Submitting {args.state} definitions to batch API",
                dry_run=False,  # Let the script handle its own dry-run
            )
            print("\n  Note: Batch processing takes up to 24 hours.")
            print("  Check status: python scripts/batch_definitions.py status")
            print("  Process results: python scripts/batch_definitions.py process --batch-id <id>")
        else:
            # Real-time processing - batch_definitions.py has realtime mode too
            # For now, point to batch_definitions.py submit which does the work
            cmd = [
                sys.executable, str(SCRIPTS_DIR / "batch_definitions.py"),
                "submit",
                "--state", args.state,
            ] + filter_args

            if args.dry_run:
                cmd.append("--dry-run")

            success = run_command(
                cmd,
                f"Extracting {args.state} definitions",
                dry_run=False,
            )

        if not success and not args.dry_run:
            print("\n⚠️ Definitions step had issues, continuing...")

    # Step 3: Red Flags
    if "red_flags" in steps:
        cmd = [
            sys.executable, str(SCRIPTS_DIR / "red_flags.py"),
            "--state", args.state,
        ] + filter_args

        if args.dry_run:
            cmd.append("--dry-run")

        success = run_command(
            cmd,
            f"Analyzing {args.state} red flags",
            dry_run=False,
        )
        if not success and not args.dry_run:
            print("\n⚠️ Red flags step had issues, continuing...")

    # Summary
    print()
    print("=" * 70)
    print("  PIPELINE COMPLETE")
    print("=" * 70)
    print()
    print("  Next steps:")
    print("  - View results in database or JSON outputs in data/outputs/")
    print("  - Run frontend: cd frontend && pnpm dev")
    print()


if __name__ == "__main__":
    main()
