#!/usr/bin/env python3
"""
Incorporation by Reference (IBR) Scanner.

Scans regulations for external standards incorporated by reference
(NFPA codes, ICC codes, ASTM standards, CFR references, etc.)
and saves results to the incorporations_by_reference table.

Usage:
    python ibr_scanner.py --state nj
    python ibr_scanner.py --state nj --batch
    python ibr_scanner.py --state nj --process-batch <batch_id>
"""

import argparse
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Project root and env loading
PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared_utils import get_db_connection
from config import OUTPUTS_DIR

from scripts.shared.base_searcher import BasePatternSearcher
from scripts.compliance_issues.config import STATES, _load_issue_config


class IBRSearcher(BasePatternSearcher):
    """
    Searcher for incorporation by reference in regulations.

    Extends BasePatternSearcher to save results to the
    incorporations_by_reference table instead of compliance_issues.
    """

    def __init__(self, state_config, issue_config, with_statutes: bool = True):
        super().__init__(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=with_statutes,
            batches_subdir='batches/ibr',
        )

    def get_already_analyzed_ids(self, conn) -> set[int]:
        """Get document IDs already in incorporations_by_reference."""
        already_analyzed = set()
        try:
            result = conn.execute(
                """
                SELECT document_id FROM incorporations_by_reference
                WHERE state = %s
                """,
                (self.state_config.state_code,)
            ).fetchall()
            already_analyzed = {row[0] for row in result}
        except Exception as e:
            print(f"Warning: Could not check existing IBR records: {e}")
        return already_analyzed

    def save_to_database(self, results: list[dict]) -> int:
        """
        Save analyzed results to incorporations_by_reference table.

        Saves ALL results (both confirmed IBRs and non-IBRs) so we can
        track which documents have been scanned.

        Args:
            results: List of analyzed matches

        Returns:
            Number of records saved
        """
        # Filter for results that have LLM analysis
        analyzed = [r for r in results if r.get('llm_analysis') is not None]

        if not analyzed:
            print("No analyzed results to save")
            return 0

        confirmed_count = sum(1 for r in analyzed if r.get('llm_analysis', {}).get('has_issue'))
        print(f"\nSaving {len(analyzed)} analyzed results ({confirmed_count} confirmed IBRs) to database...")

        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return 0

        saved = 0
        skipped = 0
        errors = 0

        try:
            for item in analyzed:
                try:
                    document_id = item.get('document_id')
                    if document_id is None:
                        skipped += 1
                        continue

                    analysis = item.get('llm_analysis', {})

                    # Only save confirmed IBRs (has_issue=true)
                    # Skip non-IBR matches to keep table clean
                    if not analysis.get('has_issue', False):
                        skipped += 1
                        continue

                    # Insert into incorporations_by_reference
                    conn.execute(
                        """
                        INSERT INTO incorporations_by_reference
                        (document_id, incorporated_document, source_organization, version,
                         requirement_quote, term_matched, context, llm_confirmed, state, url)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (
                            document_id,
                            analysis.get('incorporated_document'),
                            analysis.get('source_organization'),
                            analysis.get('version'),
                            analysis.get('requirement_quote') or '',
                            item.get('term_matched'),
                            item.get('context'),
                            True,  # llm_confirmed is always True for saved records
                            self.state_config.state_code,
                            item.get('url', ''),
                        )
                    )
                    saved += 1

                except Exception as e:
                    errors += 1
                    print(f"  Error saving {item.get('title', 'unknown')[:50]}: {e}")
                    try:
                        conn.rollback()
                    except Exception:
                        pass

            conn.commit()

        except Exception as e:
            print(f"Database error: {e}")
            conn.rollback()
        finally:
            conn.close()

        print(f"Database save complete: {saved} saved, {skipped} skipped (non-IBR), {errors} errors")
        return saved


def main():
    parser = argparse.ArgumentParser(description='Scan regulations for incorporation by reference')
    parser.add_argument('--state', required=True, choices=['nj', 'ny'], help='State to scan')
    parser.add_argument('--limit', type=int, help='Limit number of matches to process')
    parser.add_argument('--batch', action='store_true', help='Use batch API instead of async')
    parser.add_argument('--process-batch', type=str, help='Process a completed batch by ID')
    parser.add_argument('--dry-run', action='store_true', help='Search only, no LLM analysis')

    args = parser.parse_args()

    # Get state config
    state_config = STATES.get(args.state)
    if not state_config:
        print(f"Unknown state: {args.state}")
        sys.exit(1)

    # Get IBR config from loaded issue types
    try:
        ibr_config = _load_issue_config('incorporation_by_reference')
    except ValueError:
        print("ERROR: incorporation_by_reference not found in compliance_issues.yaml")
        sys.exit(1)

    # Create searcher
    searcher = IBRSearcher(
        state_config=state_config,
        issue_config=ibr_config,
        with_statutes=True,
    )

    print("=" * 70)
    print(f"INCORPORATION BY REFERENCE SCANNER - {args.state.upper()}")
    print("=" * 70)

    if args.process_batch:
        # Process existing batch
        print(f"\nProcessing batch: {args.process_batch}")
        matches = searcher.search(limit=args.limit)
        results = searcher.process_batch_results(args.process_batch, matches)
        if results:
            saved = searcher.save_to_database(results)
            searcher.print_results(results)
            print(f"\nSaved {saved} IBR records to database")
        return

    # Search for matches
    matches = searcher.search(limit=args.limit)

    if not matches:
        print("No matches found")
        return

    if args.dry_run:
        print(f"\nDry run: found {len(matches)} potential matches")
        for m in matches[:10]:
            print(f"  - {m['title'][:60]}...")
        return

    if args.batch:
        # Submit batch
        batch_id = searcher.submit_batch(matches)
        print(f"\nBatch submitted: {batch_id}")
        print(f"Run with --process-batch {batch_id} when complete")
    else:
        # Async processing
        results = asyncio.run(searcher.analyze_async(matches))
        saved = searcher.save_to_database(results)
        searcher.print_results(results)

        # Save JSON for reference
        output_file = OUTPUTS_DIR / f"ibr_{args.state}_results.json"
        searcher.save_results_json(results, output_file)

        print(f"\nSaved {saved} IBR records to database")


if __name__ == '__main__':
    main()
