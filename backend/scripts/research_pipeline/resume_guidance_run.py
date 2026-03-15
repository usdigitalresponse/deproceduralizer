#!/usr/bin/env python3
"""
Resume the guidance research pipeline run safely.

Handles the gap where a batch was submitted to Anthropic but the polling
process died before results were imported to DB. Steps:

1. Check Anthropic API for any in-flight batches
2. Check local batch_mapping.json for the most recent batch IDs
3. If an in-flight batch matches our run, poll it to completion and import results
4. Then re-run the normal pipeline (which auto-resumes from DB state)

Usage:
    cd backend
    python3 -m scripts.research_pipeline.resume_guidance_run
    python3 -m scripts.research_pipeline.resume_guidance_run --check-only
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from lib.batch import BatchManager


BATCHES_DIR = Path(__file__).parent / "batches"
BATCH_MAPPING = BATCHES_DIR / "batch_mapping.json"


def get_our_batch_ids() -> dict[str, str]:
    """Get batch_id -> directory from local mapping."""
    if not BATCH_MAPPING.exists():
        return {}
    return json.loads(BATCH_MAPPING.read_text())


def check_in_flight_batches(bm: BatchManager) -> list[dict]:
    """Check Anthropic API for any active batches."""
    print("Checking Anthropic API for in-flight batches...", flush=True)
    active = bm.list_active_batches()
    if active:
        print(f"  Found {len(active)} active batch(es):")
        for b in active:
            print(f"    {b['batch_id']}: {b['processing']} processing, {b['succeeded']} succeeded")
    else:
        print("  No active batches found.")
    return active


def check_recent_batches(bm: BatchManager) -> list[dict]:
    """Check the most recent batches from our mapping to see if any completed but weren't imported."""
    our_batches = get_our_batch_ids()
    if not our_batches:
        print("  No local batch mapping found.")
        return []

    # Check the last 5 batches (most recent)
    recent_ids = list(our_batches.keys())[-5:]
    unimported = []

    print(f"\nChecking {len(recent_ids)} most recent local batches...", flush=True)
    for batch_id in recent_ids:
        batch_dir = our_batches[batch_id]
        try:
            status = bm.get_batch_status(batch_id)
            state = status["status"]
            succeeded = status["succeeded"]
            errored = status["errored"]
            processing = status["processing"]
            print(f"  {batch_id}: {state} (succeeded={succeeded}, errored={errored}, processing={processing}) -> {Path(batch_dir).name}")

            if state == "in_progress":
                unimported.append({"batch_id": batch_id, "status": status, "dir": batch_dir})
        except Exception as e:
            print(f"  {batch_id}: ERROR checking - {e}")

    return unimported


def poll_and_wait(bm: BatchManager, batch_id: str) -> dict:
    """Poll a batch until complete."""
    print(f"\nPolling batch {batch_id} until complete...", flush=True)
    return bm.poll_until_complete(batch_id, poll_interval=30)


def run_pipeline():
    """Re-run the pipeline with resume (picks up from DB state)."""
    cmd = [
        sys.executable, "-u", "-m", "scripts.research_pipeline.cli",
        "--state", "ny",
        "--source", "guidance",
        "--all-issues",
        "--global-limit", "no-limit",
        "--max-tier", "3",
        "--execute",
    ]
    print(f"\n{'='*60}")
    print("RESUMING PIPELINE")
    print(f"{'='*60}")
    print(f"Command: {' '.join(cmd)}")
    print(flush=True)

    proc = subprocess.run(cmd, cwd=str(Path(__file__).parent.parent.parent))
    return proc.returncode


def main():
    parser = argparse.ArgumentParser(description="Resume guidance research pipeline safely")
    parser.add_argument("--check-only", action="store_true", help="Just check status, don't run anything")
    args = parser.parse_args()

    bm = BatchManager(batches_dir=BATCHES_DIR)

    # Step 1: Check for in-flight batches
    active = check_in_flight_batches(bm)
    in_flight = check_recent_batches(bm)

    if args.check_only:
        if active or in_flight:
            print(f"\n⚠ There are {len(active)} active batches at Anthropic.")
            print("Run without --check-only to poll them and resume the pipeline.")
        else:
            print("\nNo in-flight batches. Safe to re-run pipeline directly.")
        return

    # Step 2: If there are in-flight batches from our run, poll them
    # The pipeline's run_batch_tier handles polling + result import together,
    # so we can't easily import results from a stray batch ourselves.
    # Instead, we just wait for them to complete, then let the pipeline re-run
    # (which will re-submit only the units that don't have DB results).
    if in_flight:
        print(f"\nFound {len(in_flight)} in-flight batch(es). Waiting for completion...")
        for batch_info in in_flight:
            bid = batch_info["batch_id"]
            try:
                poll_and_wait(bm, bid)
                print(f"  Batch {bid} completed!")
                print("  NOTE: Results may not be in DB (polling process died before import).")
                print("  The pipeline re-run will re-submit these units — the old batch")
                print("  results are lost but the cost is only for Tier 1 (~$7).")
            except Exception as e:
                print(f"  Error polling {bid}: {e}")
                print(f"  WARNING: Batch {bid} may still be running at Anthropic.")
                print(f"  Re-running the pipeline will re-submit the same requests (additional cost).")
                print(f"  Consider using --check-only first, or waiting and retrying.")

    # Step 3: Re-run the pipeline (auto-resumes from DB)
    print("\nStarting pipeline (will auto-resume from DB state)...")
    rc = run_pipeline()

    if rc == 0:
        print("\nPipeline completed successfully!")
    else:
        print(f"\nPipeline exited with code {rc}")
        print("You can safely re-run this script to resume.")

    sys.exit(rc)


if __name__ == "__main__":
    main()
