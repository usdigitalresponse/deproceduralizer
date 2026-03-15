"""CLI entry point for readability metrics computation.

Usage:
    cd backend
    python3 -m scripts.readability_metrics --stats
    python3 -m scripts.readability_metrics --dry-run --limit 5
    python3 -m scripts.readability_metrics --run
    python3 -m scripts.readability_metrics --run --agency OCFS
"""

import argparse
import sys

from .runner import ReadabilityRunner


def main():
    parser = argparse.ArgumentParser(
        description="Compute readability metrics for guidance documents",
        epilog=(
            "Examples:\n"
            "  python3 -m scripts.readability_metrics --stats\n"
            "  python3 -m scripts.readability_metrics --dry-run --limit 10\n"
            "  python3 -m scripts.readability_metrics --run\n"
            "  python3 -m scripts.readability_metrics --run --agency OCFS\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Mutually exclusive action group
    action = parser.add_mutually_exclusive_group()
    action.add_argument(
        "--run",
        action="store_true",
        help="Compute and save readability metrics to the database",
    )
    action.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute metrics but don't save (preview mode)",
    )
    action.add_argument(
        "--stats",
        action="store_true",
        help="Show current readability computation status",
    )

    # Optional filters
    parser.add_argument(
        "--agency",
        type=str,
        default=None,
        help="Filter by agency (e.g., OCFS, OTDA, DOH)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of documents to process",
    )
    args = parser.parse_args()

    runner = ReadabilityRunner(agency=args.agency)

    if args.stats:
        runner.show_stats()
        return

    if args.run:
        runner.run(limit=args.limit, dry_run=False)
        return

    if args.dry_run:
        runner.run(limit=args.limit, dry_run=True)
        return

    # No action specified — show stats + help
    runner.show_stats()
    print("Use --run to compute metrics, --dry-run to preview, --stats for status.")
    print("Run with --help for all options.\n")
