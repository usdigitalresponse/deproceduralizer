#!/usr/bin/env python3
"""CLI for Haiku batch summarization.

Usage:
    # Submit a phase (does NOT wait - returns batch_id)
    python -m local_summarization.batch.cli --state NJ --phase sections --submit

    # Check status of submitted batches
    python -m local_summarization.batch.cli --state NJ --status

    # Process results when batch completes (downloads and saves)
    python -m local_summarization.batch.cli --state NJ --phase sections --process

    # Resume: skip already-processed documents
    python -m local_summarization.batch.cli --state NJ --phase sections --submit --resume

    # Dry run: show what would be submitted
    python -m local_summarization.batch.cli --state NJ --phase sections --dry-run

    # Run specific title only (for testing)
    python -m local_summarization.batch.cli --state NJ --title 12A --phase sections --submit

    # Combine all phase results into single file
    python -m local_summarization.batch.cli --state NJ --combine

    # View sample results after processing
    python -m local_summarization.batch.cli --state NJ --phase sections --view --limit 10

    # Watch status continuously until complete
    python -m local_summarization.batch.cli --state NJ --status --watch --interval 30
"""

import argparse
from pathlib import Path

from .runner import SummarizationBatchRunner


# Default output directory (relative to this file)
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent / "summaries_staging"

# Valid phases in order
PHASES = ["sections", "subchapters", "chapters", "parts", "titles"]

# Parent-level phases (use submit_parent_phase)
PARENT_PHASES = {"subchapters", "chapters", "parts", "titles"}


def main():
    parser = argparse.ArgumentParser(
        description="Haiku batch summarization CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Required arguments
    parser.add_argument(
        "--state",
        required=True,
        help="State code (e.g., NJ, NY)",
    )

    # Phase selection
    parser.add_argument(
        "--phase",
        choices=PHASES,
        help="Phase to run (sections, subchapters, chapters, parts, titles)",
    )

    # Actions (mutually exclusive)
    action_group = parser.add_mutually_exclusive_group()
    action_group.add_argument(
        "--submit",
        action="store_true",
        help="Submit a batch for the specified phase",
    )
    action_group.add_argument(
        "--process",
        action="store_true",
        help="Process results for the specified phase",
    )
    action_group.add_argument(
        "--status",
        action="store_true",
        help="Check status of all batches for the state",
    )
    action_group.add_argument(
        "--combine",
        action="store_true",
        help="Combine all phase results into a single file",
    )
    action_group.add_argument(
        "--view",
        action="store_true",
        help="View sample results from a processed batch",
    )
    action_group.add_argument(
        "--process-all",
        action="store_true",
        help="Process ALL batches for a phase with deduplication",
    )

    # Options
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip already-processed documents when submitting",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be submitted without actually submitting",
    )
    parser.add_argument(
        "--title",
        type=str,
        help="Filter to specific title (e.g., 8, 12A)",
    )
    parser.add_argument(
        "--all-titles",
        action="store_true",
        help="Submit/process all titles separately (one batch per title)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Continuously poll status until all batches complete (use with --status)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Polling interval in seconds for --watch mode (default: 30)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of results to show with --view (default: 5)",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.submit or args.process or args.view or getattr(args, 'process_all', False):
        if not args.phase:
            parser.error("--phase is required with --submit, --process, --process-all, or --view")

    if args.dry_run and not args.submit:
        parser.error("--dry-run only makes sense with --submit")

    if args.resume and not args.submit:
        parser.error("--resume only makes sense with --submit")

    if args.watch and not args.status:
        parser.error("--watch only makes sense with --status")

    # Validate --all-titles and --title are mutually exclusive
    if getattr(args, 'all_titles', False) and args.title:
        parser.error("--all-titles and --title are mutually exclusive")

    # Require explicit title selection for submit (prevent accidental 51K batch)
    if args.submit and not args.title and not getattr(args, 'all_titles', False):
        parser.error("--submit requires either --title or --all-titles")

    # Create runner
    runner = SummarizationBatchRunner(
        state=args.state,
        output_dir=args.output_dir,
        title=args.title,
    )

    # Execute action
    if args.status:
        if args.watch:
            runner.watch_status(interval=args.interval)
        else:
            runner.check_status()

    elif args.combine:
        combined_file = runner.combine_results()
        print(f"\nCombined file: {combined_file}")

    elif args.submit:
        if getattr(args, 'all_titles', False):
            # Submit all titles separately
            results = runner.submit_all_titles(
                phase=args.phase,
                resume=args.resume,
                dry_run=args.dry_run,
            )
            if results and not args.dry_run:
                print(f"\nSubmitted {len(results)} batches.")
                print(f"Run: python -m batch.cli --state {args.state} --status")
        else:
            # Single title submission
            if args.phase == "sections":
                batch_id = runner.submit_sections_phase(
                    resume=args.resume,
                    dry_run=args.dry_run,
                )
            else:
                # Parent phase (subchapters, chapters, parts, titles)
                level = args.phase.rstrip("s")  # subchapters -> subchapter
                batch_id = runner.submit_parent_phase(
                    level=level,
                    resume=args.resume,
                    dry_run=args.dry_run,
                )

            if batch_id and not args.dry_run:
                print(f"\nBatch submitted successfully!")
                print(f"Run: python -m local_summarization.batch.cli --state {args.state} --status")
                print(f"When complete: python -m local_summarization.batch.cli --state {args.state} --phase {args.phase} --process")

    elif args.process:
        results = runner.process_results(args.phase)
        if results:
            print(f"\nProcessed {len(results)} results")
            print(f"\nNext steps:")
            phase_idx = PHASES.index(args.phase)
            if phase_idx < len(PHASES) - 1:
                next_phase = PHASES[phase_idx + 1]
                print(f"  Submit next phase: python -m local_summarization.batch.cli --state {args.state} --phase {next_phase} --submit")
            else:
                print(f"  All phases complete! Run: python -m local_summarization.batch.cli --state {args.state} --combine")

    elif args.view:
        runner.view_results(args.phase, limit=args.limit)

    elif getattr(args, 'process_all', False):
        results = runner.process_all_batches(args.phase)
        print(f"\nTotal unique results: {len(results)}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
