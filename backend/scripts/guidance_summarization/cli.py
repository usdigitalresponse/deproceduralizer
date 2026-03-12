#!/usr/bin/env python3
"""CLI for guidance document summarization.

Usage:
    cd backend

    # Dry run: preview what would be submitted
    python3 -m scripts.guidance_summarization --dry-run

    # Run full pipeline (submit → poll → process → import to DB)
    python3 -m scripts.guidance_summarization --run

    # Run with filters
    python3 -m scripts.guidance_summarization --run --agency OCFS
    python3 -m scripts.guidance_summarization --run --doc-type ADM --limit 100

    # Check status of submitted batches
    python3 -m scripts.guidance_summarization --status

    # Process results when batch completes (if not using --run)
    python3 -m scripts.guidance_summarization --process

    # Show summarization progress stats
    python3 -m scripts.guidance_summarization --stats
"""

import argparse
from pathlib import Path

from .runner import GuidanceSummarizationRunner


DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "summaries_staging"


def main():
    parser = argparse.ArgumentParser(
        description="Guidance document batch summarization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Actions
    action_group = parser.add_mutually_exclusive_group()
    action_group.add_argument(
        "--run",
        action="store_true",
        help="Run full pipeline: submit → poll → process → import to DB",
    )
    action_group.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be submitted without submitting",
    )
    action_group.add_argument(
        "--status",
        action="store_true",
        help="Check status of submitted batches",
    )
    action_group.add_argument(
        "--process",
        action="store_true",
        help="Process results from completed batch and import to DB",
    )
    action_group.add_argument(
        "--stats",
        action="store_true",
        help="Show summarization progress stats",
    )

    # Filters
    parser.add_argument(
        "--agency",
        type=str,
        help="Filter by agency (e.g., OCFS, OTDA, DOH)",
    )
    parser.add_argument(
        "--doc-type",
        type=str,
        help="Filter by document type (e.g., ADM, LCM, INF, GIS)",
    )

    # Options
    parser.add_argument(
        "--limit",
        type=int,
        help="Max documents to process",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Polling interval in seconds (default: 30)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )

    args = parser.parse_args()

    runner = GuidanceSummarizationRunner(
        output_dir=args.output_dir,
        agency=args.agency,
        doc_type=args.doc_type,
    )

    if args.stats:
        runner.show_stats()

    elif args.status:
        runner.check_status()

    elif args.dry_run:
        runner.submit_batch(resume=True, dry_run=True, limit=args.limit)

    elif args.process:
        results = runner.process_results()
        if results:
            runner.import_to_db(results)

    elif args.run:
        runner.run(limit=args.limit, poll_interval=args.interval)

    else:
        runner.show_stats()
        parser.print_help()


if __name__ == "__main__":
    main()
