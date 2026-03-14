"""Re-run volume estimates on all fines records using the improved V2 prompt.

Writes back only estimated_annual_payers — does NOT touch activity_category,
justification, or justification_quote.

Usage:
    cd backend
    python3 -m scripts.rerun_volume_v2 --dry-run
    python3 -m scripts.rerun_volume_v2 --execute --batch
"""

import argparse

from lib.db import chunked_update
from lib.enrichment import EnrichmentRunner
from scripts.fines_shared import (
    VolumeEstimate,
    SYSTEM_PROMPT_V2,
    build_fines_prompt,
    fetch_fines_with_context,
)


def fetch_all_with_volume(limit: int = 0) -> list[dict]:
    """Fetch all fines records that have a volume estimate (to re-estimate).

    Uses paginated fetch to avoid Neon timeouts on large result sets.
    """
    return fetch_fines_with_context(
        "f.estimated_annual_payers IS NOT NULL",
        limit,
        paginate=True,
    )


def write_volume_results(results: list[tuple]) -> int:
    """Write only volume estimates back to DB."""
    return chunked_update(
        "UPDATE fines_fees_penalties SET estimated_annual_payers = %s WHERE id = %s",
        results,
        label="volume estimates",
    )


def main():
    parser = argparse.ArgumentParser(description="Re-run volume estimates with V2 prompt")
    parser.add_argument("--execute", action="store_true", help="Write results to DB")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--batch", action="store_true", help="Use batch API (recommended)")
    parser.add_argument("--limit", type=int, default=0, help="Max records (0=all)")
    parser.add_argument(
        "--resume-batch", nargs="+", metavar="BATCH_ID",
        help="Resume from completed Anthropic batch IDs (skip fetch/submit, just download and write)",
    )
    args = parser.parse_args()

    runner = EnrichmentRunner(
        name="volume_v2",
        response_model=VolumeEstimate,
        system_prompt=SYSTEM_PROMPT_V2,
        build_prompt=lambda record: build_fines_prompt(record, include_activity_category=True),
        fetch_rows=fetch_all_with_volume,
        write_result=lambda row_id, parsed: (
            parsed.estimated_annual_payers,
            row_id,
        ),
        write_batch=write_volume_results,
        max_tokens=256,
    )

    runner.run(
        execute=args.execute,
        batch=args.batch,
        limit=args.limit,
        resume_batch_ids=args.resume_batch,
    )


if __name__ == "__main__":
    main()
