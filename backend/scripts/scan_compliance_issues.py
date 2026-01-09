#!/usr/bin/env python3
"""
Compliance Issues Scanner.

Scans regulations for compliance issues and saves to compliance_issues table.

Usage:
    # Async mode (real-time LLM calls)
    python test_compliance_searcher.py --state nj
    python test_compliance_searcher.py --state nj --issue wet_signature

    # Batch mode (50% cheaper, submit and process later)
    python test_compliance_searcher.py --state nj --batch
    python test_compliance_searcher.py --state nj --process-batches

    # Other options
    python test_compliance_searcher.py --list-issues
    python test_compliance_searcher.py --state nj --dry-run
    python test_compliance_searcher.py --state nj --limit 100
    python test_compliance_searcher.py --state nj --concurrency 50
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from tqdm import tqdm

# Project root and env loading
PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from config import OUTPUTS_DIR
from shared_utils import BatchManager
from compliance_issues.searcher import ComplianceIssueSearcher
from compliance_issues.config import STATES, ISSUE_TYPES, list_issue_types

# Directory to track pending batches
BATCH_TRACKER_DIR = OUTPUTS_DIR / 'batches' / 'compliance_issues'


def get_pending_batches_file(state: str) -> Path:
    """Get the file tracking pending batches for a state."""
    BATCH_TRACKER_DIR.mkdir(parents=True, exist_ok=True)
    return BATCH_TRACKER_DIR / f'{state}_pending_batches.json'


def load_pending_batches(state: str) -> dict:
    """Load pending batch info for a state."""
    file = get_pending_batches_file(state)
    if file.exists():
        with open(file) as f:
            return json.load(f)
    return {}


def save_pending_batches(state: str, batches: dict):
    """Save pending batch info for a state."""
    file = get_pending_batches_file(state)
    with open(file, 'w') as f:
        json.dump(batches, f, indent=2)


def submit_batches(state_code: str, issues: list[str], limit: int | None):
    """Submit batch jobs for specified issue types."""
    state_config = STATES[state_code]
    pending = load_pending_batches(state_code)

    print("\n" + "=" * 70)
    print(f"SUBMITTING BATCH JOBS - {state_code.upper()}")
    print("=" * 70)

    # Check for active batches from API
    manager = BatchManager()
    active_batches = manager.list_active_batches()
    active_batch_ids = {b['batch_id'] for b in active_batches}

    if active_batches:
        print(f"\n⚠️  {len(active_batches)} active batch(es) in API:")
        for b in active_batches[:5]:
            print(f"    {b['batch_id']}: {b['processing']} processing, {b['succeeded']} done")
        if len(active_batches) > 5:
            print(f"    ... and {len(active_batches) - 5} more")

    # Verify pending batches - remove completed ones
    if pending:
        still_pending = {}
        for issue_type, info in pending.items():
            batch_id = info['batch_id']
            if batch_id in active_batch_ids:
                still_pending[issue_type] = info
            else:
                # Batch completed or doesn't exist - check if we should warn
                try:
                    status = manager.get_batch_status(batch_id)
                    if status['status'] == 'ended':
                        print(f"  ⚠️  {issue_type}: Batch {batch_id} completed but not processed!")
                        print(f"      Run --process-batches first, or it will be re-submitted")
                        still_pending[issue_type] = info  # Keep it pending
                except Exception:
                    pass  # Batch doesn't exist anymore, remove from pending
        pending = still_pending
        save_pending_batches(state_code, pending)

    print(f"\nIssue types: {len(issues)}")

    submitted = 0
    skipped = 0

    for issue_type in tqdm(issues, desc="Submitting batches", unit="issue"):
        # Skip if already pending (and verified active)
        if issue_type in pending:
            print(f"  {issue_type}: Already pending ({pending[issue_type]['batch_id']}), skipping")
            skipped += 1
            continue

        issue_config = ISSUE_TYPES[issue_type]

        searcher = ComplianceIssueSearcher(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=False,
        )

        matches = searcher.search(limit=limit)

        if not matches:
            skipped += 1
            continue

        try:
            batch_id = searcher.submit_batch(matches)
            pending[issue_type] = {
                'batch_id': batch_id,
                'match_count': len(matches),
                'submitted_at': datetime.now().isoformat(),
            }
            print(f"  {issue_type}: {len(matches)} matches -> {batch_id}")
            submitted += 1
        except Exception as e:
            print(f"  {issue_type}: Failed: {e}")

    save_pending_batches(state_code, pending)

    print("\n" + "-" * 70)
    print(f"Submitted: {submitted}, Skipped: {skipped}")
    print(f"\nRun with --process-batches when complete")


def process_batches(state_code: str, issues: list[str] | None = None):
    """Process completed batch jobs."""
    state_config = STATES[state_code]
    pending = load_pending_batches(state_code)

    if not pending:
        print(f"No pending batches for {state_code.upper()}")
        return

    print("\n" + "=" * 70)
    print(f"PROCESSING BATCHES - {state_code.upper()}")
    print("=" * 70)
    print(f"Pending batches: {len(pending)}")

    completed = []
    # Start with a copy of all pending - we'll remove as we complete
    still_pending = dict(pending)

    issue_types_to_process = issues if issues else list(pending.keys())

    for issue_type in tqdm(issue_types_to_process, desc="Processing", unit="issue"):
        if issue_type not in pending:
            continue

        batch_info = pending[issue_type]
        batch_id = batch_info['batch_id']
        issue_config = ISSUE_TYPES[issue_type]

        print(f"\n  {issue_type}: {batch_id}...")

        searcher = ComplianceIssueSearcher(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=False,
        )

        matches = searcher.search()
        results = searcher.process_batch_results(batch_id, matches)

        if not results:
            print(f"    Not ready, keeping in pending")
            continue

        saved = searcher.save_to_database(results)
        confirmed = sum(
            1 for r in results
            for issue in (r.get('llm_analysis') or {}).get('issues', [])
            if issue.get('requirement_found')
        )

        print(f"    Saved {saved} rows ({confirmed} confirmed)")
        completed.append(issue_type)

        # Remove from pending and save immediately (crash-safe)
        del still_pending[issue_type]
        save_pending_batches(state_code, still_pending)

    print("\n" + "-" * 70)
    print(f"Completed: {len(completed)}, Still pending: {len(still_pending)}")


async def run_async(state_code: str, issues: list[str], limit: int | None, concurrency: int):
    """Run async LLM analysis."""
    state_config = STATES[state_code]

    print("\n" + "=" * 70)
    print(f"COMPLIANCE ISSUES SCANNER - {state_code.upper()}")
    print("=" * 70)
    print(f"Issue types: {len(issues)}")
    print(f"Mode: Async, concurrency={concurrency}")

    total_saved = 0
    total_confirmed = 0

    for issue_type in tqdm(issues, desc=f"{state_code.upper()} issues", unit="issue"):
        issue_config = ISSUE_TYPES[issue_type]

        searcher = ComplianceIssueSearcher(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=False,
        )

        matches = searcher.search(limit=limit)

        if not matches:
            continue

        print(f"\n  {issue_type}: {len(matches)} matches...")

        results = await searcher.analyze_async(matches, batch_size=concurrency)

        saved = searcher.save_to_database(results)
        confirmed = sum(
            1 for r in results
            for issue in (r.get('llm_analysis') or {}).get('issues', [])
            if issue.get('requirement_found')
        )

        total_saved += saved
        total_confirmed += confirmed
        print(f"    Saved {saved} rows ({confirmed} confirmed)")

    print("\n" + "=" * 70)
    print(f"TOTAL: {total_saved} rows, {total_confirmed} confirmed issues")


def dry_run(state_code: str, issues: list[str], limit: int | None):
    """Search only, no LLM."""
    state_config = STATES[state_code]

    print("\n" + "=" * 70)
    print(f"DRY RUN - {state_code.upper()}")
    print("=" * 70)

    total = 0
    for issue_type in issues:
        issue_config = ISSUE_TYPES[issue_type]
        searcher = ComplianceIssueSearcher(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=False,
        )
        matches = searcher.search(limit=limit)
        total += len(matches)
        if matches:
            print(f"  {issue_type}: {len(matches)} matches")

    print(f"\nTotal: {total} matches across {len(issues)} issue types")


def main():
    parser = argparse.ArgumentParser(
        description='Scan regulations for compliance issues',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument('--state', '-s', choices=['nj', 'ny'], help='State to scan')
    parser.add_argument('--issue', '-i', help='Specific issue type (default: all)')
    parser.add_argument('--limit', '-l', type=int, help='Limit matches per issue type')
    parser.add_argument('--batch', '-b', action='store_true', help='Submit to batch API (50%% cheaper)')
    parser.add_argument('--process-batches', '-p', action='store_true', help='Process completed batches')
    parser.add_argument('--dry-run', action='store_true', help='Search only, no LLM')
    parser.add_argument('--list-issues', action='store_true', help='List issue types')
    parser.add_argument('--concurrency', '-c', type=int, default=20, help='Concurrent requests (default: 20)')

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
        dry_run(args.state, issues, args.limit)
    elif args.batch:
        submit_batches(args.state, issues, args.limit)
    elif args.process_batches:
        process_batches(args.state, issues if args.issue else None)
    else:
        asyncio.run(run_async(args.state, issues, args.limit, args.concurrency))


if __name__ == '__main__':
    main()
