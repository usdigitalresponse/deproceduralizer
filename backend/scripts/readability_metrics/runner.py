"""Core processing logic for readability metrics computation.

ReadabilityRunner handles fetching documents, computing metrics, and
saving results with progress tracking.
"""

import time
from typing import Optional

from .db_queries import (
    batch_update_readability,
    get_guidance_docs_for_readability,
    get_readability_stats,
)
from .metrics import compute_readability


def format_eta(seconds: float) -> str:
    """Format seconds as human-readable time."""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        return f"{seconds / 60:.1f}m"
    else:
        return f"{seconds / 3600:.1f}h"


class ReadabilityRunner:
    """Computes readability metrics for guidance documents."""

    def __init__(self, agency: Optional[str] = None):
        self.agency = agency

    def show_stats(self) -> None:
        """Display current readability computation status."""
        stats = get_readability_stats()
        print("\n=== READABILITY METRICS STATUS ===\n")
        print(f"  Total docs with content:  {stats['total_with_content']:,}")
        print(f"  Already computed:         {stats['computed']:,}")
        print(f"  Pending:                  {stats['pending']:,}")

        if stats["total_with_content"] > 0:
            pct = 100 * stats["computed"] / stats["total_with_content"]
            print(f"  Progress:                 {pct:.1f}%")
        print()

    def run(
        self,
        limit: Optional[int] = None,
        dry_run: bool = False,
    ) -> None:
        """
        Compute readability metrics for pending guidance documents.

        Args:
            limit: Max number of documents to process
            dry_run: If True, compute metrics but don't save to DB
        """
        mode = "[DRY RUN] " if dry_run else ""
        print(f"\n=== {mode}READABILITY METRICS ===\n")

        if self.agency:
            print(f"Agency filter: {self.agency}")

        print("Fetching documents...")
        docs = get_guidance_docs_for_readability(
            agency=self.agency,
            resume=not dry_run,
            limit=limit,
        )
        total = len(docs)

        if total == 0:
            print("No documents to process.")
            return

        print(f"Found {total:,} documents to process\n")

        results: list[dict] = []
        skipped = 0
        errors = 0
        start_time = time.time()

        for i, doc in enumerate(docs, 1):
            try:
                metrics = compute_readability(doc["content"])
                if metrics is None:
                    skipped += 1
                else:
                    results.append({"id": doc["id"], **metrics})
            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"  Error on doc {doc['id']}: {e}")

            # Progress every 100 docs
            if i % 100 == 0 or i == total:
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                remaining = (total - i) / rate if rate > 0 else 0
                pct = 100 * i / total
                print(
                    f"  Computed {i:,}/{total:,} ({pct:.0f}%), "
                    f"ETA: {format_eta(remaining)}, "
                    f"skipped: {skipped}"
                )

        elapsed = time.time() - start_time
        print(f"\nComputation complete in {format_eta(elapsed)}")
        print(f"  Results: {len(results):,}")
        print(f"  Skipped (too short): {skipped:,}")
        if errors:
            print(f"  Errors: {errors:,}")

        if dry_run:
            print(f"\n{mode}Would update {len(results):,} documents")
            if results:
                sample = results[:3]
                for r in sample:
                    print(
                        f"  Doc {r['id']}: "
                        f"FK grade={r['flesch_kincaid_grade']:.1f}, "
                        f"ease={r['flesch_reading_ease']:.1f}, "
                        f"words={r['word_count']}, "
                        f"sentences={r['sentence_count']}"
                    )
                if len(results) > 3:
                    print(f"  ... and {len(results) - 3} more")
            print(f"\n{mode}No changes made")
            return

        if not results:
            print("\nNo results to save.")
            return

        # Batch update
        print(f"\nSaving {len(results):,} results to database...")
        updated = batch_update_readability(results)
        print(f"Updated {updated:,} rows")
