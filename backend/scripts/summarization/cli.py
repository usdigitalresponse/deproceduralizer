#!/usr/bin/env python3
"""CLI for batch summarization.

Usage:
    cd backend

    # Run all phases end-to-end for a title (submit → poll → process → import to DB)
    python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases

    # Dry run: preview what --run-all-phases would submit for each phase
    python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases --dry-run

    # Submit a single phase
    python3 -m scripts.summarization.cli --state NJ --title 12A --phase sections --submit

    # Check status of submitted batches
    python3 -m scripts.summarization.cli --state NJ --status

    # Process results when batch completes
    python3 -m scripts.summarization.cli --state NJ --phase sections --process

    # Watch status continuously until complete
    python3 -m scripts.summarization.cli --state NJ --status --watch
"""

import argparse
from pathlib import Path

from .runner import SummarizationBatchRunner


# Default output directory (backend/summaries_staging/)
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent / "summaries_staging"

# All known hierarchy levels (pluralized as phase names)
# Used for --phase validation; actual ordering is auto-detected at runtime
PHASES = [
    "sections", "subparts", "parts", "articles",
    "subchapters", "chapters", "subtitles", "titles",
]


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
    action_group.add_argument(
        "--run-all-phases",
        action="store_true",
        help="Run all phases end-to-end: submit → poll → process → import to DB",
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

    if getattr(args, 'run_all_phases', False) and not args.title and not getattr(args, 'all_titles', False):
        parser.error("--run-all-phases requires --title (e.g., --title 18)")

    if args.dry_run and not args.submit and not getattr(args, 'run_all_phases', False):
        parser.error("--dry-run only makes sense with --submit or --run-all-phases")

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

    # --run-all-phases bypasses --phase requirement since it runs all phases
    if getattr(args, 'run_all_phases', False) and args.phase:
        parser.error("--run-all-phases runs all phases automatically, don't specify --phase")

    # Create runner
    runner = SummarizationBatchRunner(
        jurisdiction=args.state,
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
                print(f"Run: python3 -m scripts.summarization.cli --state {args.state} --status")
                print(f"When complete: python3 -m scripts.summarization.cli --state {args.state} --phase {args.phase} --process")

    elif args.process:
        results = runner.process_results(args.phase)
        if results:
            print(f"\nProcessed {len(results)} results")
            print(f"\nNext steps:")
            phase_idx = PHASES.index(args.phase)
            if phase_idx < len(PHASES) - 1:
                next_phase = PHASES[phase_idx + 1]
                print(f"  Submit next phase: python3 -m scripts.summarization.cli --state {args.state} --phase {next_phase} --submit")
            else:
                print(f"  All phases complete! Run: python3 -m scripts.summarization.cli --state {args.state} --combine")

    elif args.view:
        runner.view_results(args.phase, limit=args.limit)

    elif getattr(args, 'process_all', False):
        results = runner.process_all_batches(args.phase)
        print(f"\nTotal unique results: {len(results)}")

    elif getattr(args, 'run_all_phases', False):
        if args.dry_run:
            # Auto-detect phase order and dry-run each
            from .db_queries import get_hierarchy_order
            parent_levels = get_hierarchy_order(args.state.upper(), args.title)
            phases = ["sections"] + [f"{level}s" for level in parent_levels]
            print(f"Detected phase order: {' → '.join(phases)}")
            for phase in phases:
                print(f"\n{'='*60}")
                print(f"DRY RUN: {phase.upper()}")
                print(f"{'='*60}")
                if phase == "sections":
                    runner.submit_sections_phase(resume=True, dry_run=True)
                else:
                    level = phase.rstrip("s")
                    runner.submit_parent_phase(level=level, resume=True, dry_run=True)
        else:
            all_results = runner.run_all_phases(
                poll_interval=args.interval,
            )
            total = sum(len(r) for r in all_results.values())
            if total > 0:
                # Import summaries into the database
                from .import_summaries import (
                    find_all_results_files, load_results, extract_summary_data,
                    batch_update_summaries,
                )
                from .db_queries import get_connection

                print(f"\n{'='*60}")
                print(f"IMPORTING SUMMARIES TO DATABASE")
                print(f"{'='*60}")

                results_files = find_all_results_files(args.state.upper(), args.output_dir)
                all_updates = []
                for rf in results_files:
                    for result in load_results(rf):
                        data = extract_summary_data(result)
                        if data and data["summary"]:
                            all_updates.append(data)

                if all_updates:
                    with get_connection() as conn:
                        updated = batch_update_summaries(conn, all_updates)
                    print(f"  Updated {updated} documents in database")
                else:
                    print("  No summaries to import")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
