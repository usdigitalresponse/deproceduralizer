"""Fix remaining fabricated justification_quotes via EnrichmentRunner.

Fetches records that still have fabricated quotes (starting with summary-like
prefixes), re-runs them through Haiku, and writes back results.

Usage:
    cd backend
    python3 -m scripts.fix_fabricated_quotes --dry-run
    python3 -m scripts.fix_fabricated_quotes --execute
    python3 -m scripts.fix_fabricated_quotes --execute --batch
"""

import argparse

from lib.enrichment import EnrichmentRunner
from scripts.enrich_fines_activity import ActivityClassification, SYSTEM_PROMPT
from scripts.fines_shared import (
    build_fines_prompt,
    fetch_fines_with_context,
    is_fabricated,
    write_fines_results,
    FABRICATION_PREFIXES,
)


def fetch_fabricated(limit: int = 0) -> list[dict]:
    """Fetch records with fabricated quotes."""
    like_clauses = " OR ".join(
        f"f.justification_quote LIKE '{prefix}%'" for prefix in FABRICATION_PREFIXES
    )
    return fetch_fines_with_context(
        f"f.justification_quote IS NOT NULL AND ({like_clauses})",
        limit,
    )


def main():
    parser = argparse.ArgumentParser(description="Fix fabricated justification quotes")
    parser.add_argument("--execute", action="store_true", help="Write results to DB")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--batch", action="store_true", help="Use batch API")
    parser.add_argument("--limit", type=int, default=0, help="Max records (0=all)")
    args = parser.parse_args()

    runner = EnrichmentRunner(
        name="fix_fabricated_quotes",
        response_model=ActivityClassification,
        system_prompt=SYSTEM_PROMPT,
        build_prompt=build_fines_prompt,
        fetch_rows=fetch_fabricated,
        write_result=lambda row_id, parsed: (
            parsed.activity_category,
            parsed.estimated_annual_payers,
            parsed.justification,
            # Null out quotes that are still fabricated after LLM retry
            None if is_fabricated(parsed.justification_quote) else parsed.justification_quote,
            row_id,
        ),
        write_batch=write_fines_results,
    )

    runner.run(execute=args.execute, batch=args.batch, limit=args.limit)


if __name__ == "__main__":
    main()
