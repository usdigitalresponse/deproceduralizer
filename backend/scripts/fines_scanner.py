#!/usr/bin/env python3
"""
Fines, Fees & Penalties Scanner.

Scans regulations and guidance documents for monetary charges (fines, fees,
penalties, surcharges, forfeitures) and saves structured results to the
fines_fees_penalties table.

Usage:
    python fines_scanner.py --state ny
    python fines_scanner.py --state ny --batch
    python fines_scanner.py --state ny --process-batch <batch_id>
    python fines_scanner.py --state ny --dry-run
    python fines_scanner.py --state ny --include-guidance
"""

import argparse
import asyncio
import sys
import traceback
from pathlib import Path
from dotenv import load_dotenv

# Project root and env loading
PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

from lib.db import get_db_connection
from lib.jurisdictions import VALID_JURISDICTIONS_LOWER, get_title_agency_map
from config import OUTPUTS_DIR

from lib.batch import BatchManager
from scripts.shared.base_searcher import BasePatternSearcher
from scripts.compliance_issues.config import STATES, _load_issue_config


class FinesSearcher(BasePatternSearcher):
    """
    Searcher for fines, fees, and penalties in regulations.

    Extends BasePatternSearcher to:
    - Save results to the fines_fees_penalties table
    - Handle multiple items per document (one doc can have many fines)
    - Support --title and --part filters for targeted scanning
    """

    def __init__(self, state_config, issue_config, with_statutes: bool = True,
                 include_guidance: bool = False, title_filter: int = None,
                 part_filter: str = None):
        super().__init__(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=with_statutes,
            batches_subdir='batches/fines',
        )
        self.include_guidance = include_guidance
        self.title_filter = title_filter
        self.part_filter = part_filter
        self.model = "claude-haiku-4-5-20251001"
        self._title_agency_map = get_title_agency_map(self.state_config.jurisdiction_code)

    def create_prompt(self, match: dict) -> tuple:
        """Override to inject document metadata into the prompt."""
        from typing import Optional
        import re

        statute_context = self.statute_checker.get_statute_context(
            match.get('statute_citations', [])
        )

        prompt_config = self.issue_config.prompt
        system_prompt = prompt_config.get('system')
        template = prompt_config.get('template', '')

        # Build document metadata
        metadata_parts = []
        if match.get('source_type') == 'guidance':
            metadata_parts.append(f"Source: Guidance document")
            if match.get('agency'):
                metadata_parts.append(f"Issuing agency: {match['agency']}")
        else:
            metadata_parts.append(f"Source: Regulation")
            title_num = match.get(f'{self.state_config.citation_prefix}_title')
            if title_num and str(title_num) in self._title_agency_map:
                metadata_parts.append(f"Administering agency: {self._title_agency_map[str(title_num)]}")

        if match.get('title'):
            metadata_parts.append(f"Document title: {match['title']}")
        if match.get('url'):
            metadata_parts.append(f"URL: {match['url']}")

        document_metadata = "\n".join(metadata_parts) if metadata_parts else "No metadata available"

        # Use full content for small docs, windowed content for large docs
        full_content = match.get('full_content') or match.get('content') or match['context']
        MAX_CONTENT_CHARS = 15000
        WINDOW_RADIUS = 1500

        if len(full_content) <= MAX_CONTENT_CHARS:
            regulation_text = full_content
        else:
            pattern_str = match.get('term_matched', '')
            if pattern_str:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE)
                    all_matches = list(pattern.finditer(full_content))
                except re.error:
                    all_matches = []
            else:
                all_matches = []

            if not all_matches:
                regulation_text = full_content[:MAX_CONTENT_CHARS]
            else:
                windows = []
                for m in all_matches:
                    center = (m.start() + m.end()) // 2
                    windows.append((max(0, center - WINDOW_RADIUS),
                                    min(len(full_content), center + WINDOW_RADIUS)))
                windows.sort()
                merged = [windows[0]]
                for s, e in windows[1:]:
                    if s <= merged[-1][1]:
                        merged[-1] = (merged[-1][0], max(merged[-1][1], e))
                    else:
                        merged.append((s, e))
                regulation_text = "\n\n[...]\n\n".join(
                    full_content[s:e] for s, e in merged
                )

        user_prompt = template.format(
            regulation_context=regulation_text,
            statute_context=statute_context if statute_context else "No statute references found.",
            document_metadata=document_metadata,
        )

        return system_prompt, user_prompt

    def search(self, limit=None, tag=None):
        """Override base search to support title/part filters."""
        if not self.title_filter and not self.part_filter:
            return super().search(limit=limit, tag=tag)

        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return []

        prefix = self.state_config.citation_prefix
        state_code = self.state_config.state_code

        already_analyzed = self.get_already_analyzed_ids(conn)
        if already_analyzed:
            print(f"Skipping {len(already_analyzed)} already-analyzed docs")

        filters = [f"rd.jurisdiction = %s", "rd.type = 'regulation'",
                   "rd.content IS NOT NULL",
                   "(rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)"]
        params = [state_code]

        if self.title_filter:
            filters.append(f"rd.{prefix}_title = %s")
            params.append(self.title_filter)
        if self.part_filter:
            filters.append(f"rd.{prefix}_part = %s")
            params.append(self.part_filter)

        where = " AND ".join(filters)
        query = f"""
            SELECT rd.id, rd.title, rd.content, rd.url, rd.hierarchy_level, rd.hierarchy_path,
                   rd.{prefix}_title, rd.{prefix}_chapter, rd.{prefix}_section, rd.source_index
            FROM regulatory_documents rd
            WHERE {where}
            ORDER BY rd.id
        """

        filter_desc = []
        if self.title_filter:
            filter_desc.append(f"Title {self.title_filter}")
        if self.part_filter:
            filter_desc.append(f"Part {self.part_filter}")
        print(f"Querying {state_code} regulations ({', '.join(filter_desc)})...")

        try:
            rows = conn.execute(query, params).fetchall()
            print(f"Found {len(rows)} {state_code} documents to search...")
        except Exception as e:
            print(f"Database query error: {e}")
            conn.rollback()
            conn.close()
            return []

        matches = []
        compiled_patterns = self.issue_config.compiled_patterns

        for row in rows:
            doc_id, title, content, url, hierarchy_level, hierarchy_path, \
                doc_title, doc_chapter, doc_section, source_index = row

            if not content or doc_id in already_analyzed:
                continue

            for pattern in compiled_patterns:
                match_obj = pattern.search(content)
                if match_obj:
                    start = max(0, match_obj.start() - 300)
                    end = min(len(content), match_obj.end() + 300)
                    context = content[start:end].strip()

                    matches.append({
                        'document_id': doc_id,
                        'guidance_document_id': None,
                        'title': title or '',
                        'content': content,
                        'url': url or '',
                        'context': context,
                        'term_matched': pattern.pattern,
                        'source_type': 'regulation',
                        f'{self.state_config.citation_prefix}_title': doc_title,
                    })
                    break

        conn.commit()
        conn.close()
        if limit:
            matches = matches[:limit]
        print(f"Found {len(matches)} potential matches")
        return matches

    def get_already_analyzed_ids(self, conn) -> set[int]:
        """Get document IDs already in fines_fees_penalties."""
        return self._get_analyzed_ids(conn, "document_id", "fines records")

    def _get_already_analyzed_guidance_ids(self, conn) -> set[int]:
        """Get guidance document IDs already in fines_fees_penalties."""
        return self._get_analyzed_ids(conn, "guidance_document_id", "guidance fines records")

    def _get_analyzed_ids(self, conn, column: str, label: str) -> set[int]:
        """Get IDs from fines_fees_penalties for a given FK column."""
        try:
            result = conn.execute(
                f"""
                SELECT DISTINCT {column} FROM fines_fees_penalties
                WHERE jurisdiction = %s AND {column} IS NOT NULL
                """,
                (self.state_config.state_code,)
            ).fetchall()
            return {row[0] for row in result}
        except Exception as e:
            try:
                import psycopg.errors
                if isinstance(e, psycopg.errors.UndefinedTable):
                    print("Warning: fines_fees_penalties table does not exist yet — run migrations first")
                else:
                    print(f"Warning: Could not check existing {label}: {e}")
                    traceback.print_exc()
            except ImportError:
                print(f"Warning: Could not check existing {label}: {e}")
                traceback.print_exc()
            try:
                conn.rollback()
            except Exception:
                pass
            return set()

    def search_guidance(self, limit=None) -> list[dict]:
        """Search guidance documents for pattern matches."""
        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return []

        state_code = self.state_config.state_code
        already_analyzed = self._get_already_analyzed_guidance_ids(conn)
        if already_analyzed:
            print(f"Skipping {len(already_analyzed)} already-analyzed guidance docs")

        print(f"Querying {state_code} guidance documents from database...")

        try:
            rows = conn.execute(
                """
                SELECT id, title, content, url, agency
                FROM guidance_documents
                WHERE jurisdiction = %s
                  AND content IS NOT NULL
                  AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
                ORDER BY id
                """,
                (state_code,)
            ).fetchall()
            print(f"Found {len(rows)} {state_code} guidance documents to search...")
        except Exception as e:
            print(f"Database query error: {e}")
            conn.rollback()
            conn.close()
            return []

        matches = []
        compiled_patterns = self.issue_config.compiled_patterns

        for row in rows:
            doc_id, title, content, url, agency = row

            if not content or doc_id in already_analyzed:
                continue

            matched_term = None
            first_match = None

            for pattern in compiled_patterns:
                match_obj = pattern.search(content)
                if match_obj:
                    matched_term = pattern.pattern
                    first_match = match_obj
                    break

            if first_match:
                start = max(0, first_match.start() - 300)
                end = min(len(content), first_match.end() + 300)
                context = content[start:end].strip()

                result = {
                    'document_id': None,
                    'guidance_document_id': doc_id,
                    'title': title or '',
                    'content': content,
                    'url': url or '',
                    'context': context,
                    'term_matched': matched_term,
                    'source_type': 'guidance',
                    'agency': agency or '',
                }
                matches.append(result)

        conn.commit()
        conn.close()

        if limit:
            matches = matches[:limit]

        print(f"Found {len(matches)} guidance document matches")
        return matches

    def submit_batch(self, matches: list[dict]) -> str:
        """Override to use guid_ prefix for guidance document IDs."""
        import json as _json
        from lib.batch import format_batch_request, BatchManager

        print(f"\n[1/2] Formatting {len(matches)} batch requests...")
        requests = []
        manifest = {}
        for match in matches:
            system_prompt, user_prompt = self.create_prompt(match)
            if match.get('source_type') == 'guidance':
                custom_id = f"guid_{match['guidance_document_id']}"
            else:
                custom_id = f"doc_{match['document_id']}"
            request = format_batch_request(
                custom_id=custom_id,
                prompt=user_prompt,
                response_format=self.issue_config.response_model,
                model=self.model,
                system=system_prompt,
            )
            requests.append(request)
            # Save match metadata (without full_content) for reliable batch processing
            manifest[custom_id] = {k: v for k, v in match.items() if k != 'full_content'}
        print(f"      Formatted {len(requests)} requests")

        print(f"\n[2/2] Submitting to Anthropic Batch API...")
        manager = BatchManager(batches_dir=self.batches_dir)
        batch_id = manager.submit_batch(
            requests=requests,
            batch_name=f"{self.state_config.state_code.lower()}_{self.issue_config.name}",
            metadata={
                'state': self.state_config.state_code,
                'issue_type': self.issue_config.name,
                'match_count': len(matches),
            }
        )

        # Persist match manifest alongside batch files for reliable re-processing
        batch_dir = manager.find_batch_dir(batch_id)
        if batch_dir:
            manifest_file = batch_dir / 'match_manifest.json'
            with open(manifest_file, 'w') as f:
                _json.dump(manifest, f, indent=2, ensure_ascii=False)
            print(f"      Saved match manifest ({len(manifest)} entries)")

        print(f"      Submitted batch: {batch_id}")
        return batch_id

    def load_match_manifest(self, batch_id: str) -> dict[str, dict] | None:
        """Load persisted match manifest for a batch, if available."""
        import json as _json
        from lib.batch import BatchManager

        manager = BatchManager(batches_dir=self.batches_dir)
        batch_dir = manager.find_batch_dir(batch_id)
        if not batch_dir:
            return None
        manifest_file = batch_dir / 'match_manifest.json'
        if not manifest_file.exists():
            return None
        with open(manifest_file) as f:
            return _json.load(f)

    def process_batch_results(self, batch_id: str, matches: list[dict] | None = None) -> list[dict]:
        """Override to handle both doc_ and guid_ custom IDs.

        Prefers loading the persisted match manifest (saved at submit time).
        Falls back to the provided matches list for backwards compatibility.
        """
        from lib.batch import BatchManager, parse_batch_result_tool_use

        print("=" * 70)
        print(f"PROCESSING {self.issue_config.display_name.upper()} BATCH")
        print("=" * 70)

        manager = BatchManager(batches_dir=self.batches_dir)

        print("[1/3] Checking batch status...")
        try:
            status = manager.get_batch_status(batch_id)
        except Exception as e:
            print(f"      Could not retrieve batch: {e}")
            return []

        if status['status'] != 'ended':
            print(f"      Batch is still processing: {status['status']}")
            return []

        print(f"      Batch completed: {status['succeeded']} succeeded, {status['errored']} errored")

        # Try loading persisted manifest first (immutable, created at submit time)
        manifest = self.load_match_manifest(batch_id)
        if manifest:
            print(f"      Loaded match manifest ({len(manifest)} entries)")
            # Build lookup directly from manifest keyed by custom_id
            manifest_lookup = manifest
        else:
            print("      WARNING: No match manifest found — falling back to re-fetched matches")
            if not matches:
                print("      ERROR: No matches provided and no manifest found")
                return []
            manifest_lookup = {}
            for m in matches:
                if m.get('source_type') == 'guidance':
                    cid = f"guid_{m['guidance_document_id']}"
                else:
                    cid = f"doc_{m['document_id']}"
                manifest_lookup[cid] = m

        batch_dir = manager.find_batch_dir(batch_id)

        print("[2/3] Retrieving and processing results...")
        results_iter = manager.get_batch_results(batch_id)
        results = []
        processed = 0
        errored = 0
        missing = 0

        for result in results_iter:
            custom_id = result.custom_id
            match = manifest_lookup.get(custom_id)

            if not match:
                missing += 1
                errored += 1
                processed += 1
                if missing <= 5:
                    print(f"      WARNING: No match found for {custom_id}")
                continue

            if result.result.type != 'succeeded':
                results.append({**match, 'llm_analysis': None, 'analysis_error': True})
                errored += 1
                processed += 1
                continue

            try:
                analysis = parse_batch_result_tool_use(result, self.issue_config.response_model)
                if analysis:
                    results.append({**match, 'llm_analysis': analysis.model_dump(), 'analysis_error': False})
                else:
                    results.append({**match, 'llm_analysis': None, 'analysis_error': True})
                    errored += 1
            except Exception as e:
                if batch_dir:
                    manager.log_error(batch_dir, custom_id, 'ERROR', str(e))
                results.append({**match, 'llm_analysis': None, 'analysis_error': True})
                errored += 1

            processed += 1

        if missing > 5:
            print(f"      ... and {missing - 5} more missing matches")
        print(f"      Processed {processed} results ({errored} errors, {missing} missing matches)")
        return results

    def print_results(self, results: list[dict]) -> None:
        """Override to count confirmed items nested inside llm_analysis.items."""
        print("\n" + "=" * 80)
        print(f"{self.issue_config.display_name.upper()} RESULTS")
        print("=" * 80)

        total = len(results)
        confirmed_items = 0
        for r in results:
            analysis = r.get('llm_analysis') or {}
            for item in analysis.get('items', []):
                if item.get('llm_confirmed'):
                    confirmed_items += 1

        print(f"\nTotal regex matches searched: {total}")
        print(f"Confirmed items: {confirmed_items}")

    def save_to_database(self, results: list[dict]) -> int:
        """
        Save analyzed results to fines_fees_penalties table.

        Each result may contain multiple items (fines/fees) from one document.
        Only saves items where llm_confirmed=True.
        """
        analyzed = [r for r in results if r.get('llm_analysis') is not None]

        if not analyzed:
            print("No analyzed results to save")
            return 0

        # Count confirmed items across all results
        total_items = 0
        for r in analyzed:
            analysis = r.get('llm_analysis', {})
            items = analysis.get('items', [])
            total_items += sum(1 for item in items if item.get('llm_confirmed'))

        print(f"\nSaving {total_items} confirmed fines/fees from {len(analyzed)} documents to database...")

        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return 0

        saved = 0
        skipped = 0
        errors = 0

        try:
            for result in analyzed:
                try:
                    document_id = result.get('document_id')
                    guidance_document_id = result.get('guidance_document_id')

                    if document_id is None and guidance_document_id is None:
                        skipped += 1
                        continue

                    analysis = result.get('llm_analysis', {})
                    items = analysis.get('items', [])

                    for item in items:
                        if not item.get('llm_confirmed', False):
                            skipped += 1
                            continue

                        conn.execute(
                            """
                            INSERT INTO fines_fees_penalties
                            (document_id, guidance_document_id, penalty_type, amount,
                             amount_min, amount_max, per_unit, who_pays, responsible_agency,
                             violation_description, requirement_quote, context,
                             term_matched, llm_confirmed, jurisdiction, url,
                             jurisdiction_level, jurisdiction_level_other, issuing_entity_confidence)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                            """,
                            (
                                document_id,
                                guidance_document_id,
                                item.get('penalty_type', 'other'),
                                item.get('amount'),
                                item.get('amount_min'),
                                item.get('amount_max'),
                                item.get('per_unit'),
                                item.get('who_pays'),
                                item.get('responsible_agency'),
                                item.get('violation_description'),
                                item.get('requirement_quote'),
                                result.get('context', ''),
                                result.get('term_matched'),
                                True,
                                self.state_config.state_code,
                                result.get('url', ''),
                                item.get('jurisdiction_level'),
                                item.get('jurisdiction_level_other'),
                                item.get('issuing_entity_confidence'),
                            )
                        )
                        saved += 1

                    # Commit after each document so errors don't roll back everything
                    conn.commit()

                except Exception as e:
                    errors += 1
                    print(f"  Error saving {result.get('title', 'unknown')[:50]}: {e}")
                    traceback.print_exc()
                    try:
                        conn.rollback()
                    except Exception:
                        pass

        except Exception as e:
            print(f"Database error: {e}")
            conn.rollback()
        finally:
            conn.close()

        print(f"Database save complete: {saved} saved, {skipped} skipped (unconfirmed), {errors} errors")
        return saved


def main():
    parser = argparse.ArgumentParser(description='Scan regulations for fines, fees, and penalties')
    parser.add_argument('--state', required=True, choices=VALID_JURISDICTIONS_LOWER, help='State to scan')
    parser.add_argument('--limit', type=int, help='Limit number of matches to process')
    parser.add_argument('--batch', action='store_true', help='Use batch API instead of async')
    parser.add_argument('--process-batch', type=str, help='Process a completed batch by ID')
    parser.add_argument('--dry-run', action='store_true', help='Search only, no LLM analysis')
    parser.add_argument('--include-guidance', action='store_true', help='Also scan guidance documents')
    parser.add_argument('--title', type=int, help='Filter to specific NYCRR title number')
    parser.add_argument('--part', type=str, help='Filter to specific NYCRR part number')
    parser.add_argument('--poll', type=str, help='Poll a batch until complete, then process results')

    args = parser.parse_args()

    # Get state config
    state_config = STATES.get(args.state)
    if not state_config:
        print(f"Unknown state: {args.state}")
        sys.exit(1)

    # Get fines config from loaded issue types
    try:
        fines_config = _load_issue_config('fines_fees_penalties')
    except ValueError:
        print("ERROR: fines_fees_penalties not found in compliance_issues.yaml")
        sys.exit(1)

    # Create searcher
    searcher = FinesSearcher(
        state_config=state_config,
        issue_config=fines_config,
        with_statutes=True,
        include_guidance=args.include_guidance,
        title_filter=args.title,
        part_filter=args.part,
    )

    print("=" * 70)
    print(f"FINES, FEES & PENALTIES SCANNER - {args.state.upper()}")
    print("=" * 70)

    if args.poll:
        batch_id = args.poll
        print(f"\nPolling batch: {batch_id}")
        manager = BatchManager(batches_dir=searcher.batches_dir)
        manager.poll_until_complete(batch_id, poll_interval=60)
        print("\nBatch complete! Processing results...")
        # Use persisted manifest if available; fall back to re-search
        if searcher.load_match_manifest(batch_id):
            results = searcher.process_batch_results(batch_id)
        else:
            print("WARNING: No manifest found — re-searching (results may differ from submission)")
            matches = searcher.search(limit=args.limit)
            if args.include_guidance:
                matches.extend(searcher.search_guidance(limit=args.limit))
            results = searcher.process_batch_results(batch_id, matches)
        if results:
            saved = searcher.save_to_database(results)
            searcher.print_results(results)
            print(f"\nSaved {saved} fine/fee records to database")
        return

    if args.process_batch:
        print(f"\nProcessing batch: {args.process_batch}")
        # Use persisted manifest if available; fall back to re-search
        if searcher.load_match_manifest(args.process_batch):
            results = searcher.process_batch_results(args.process_batch)
        else:
            print("WARNING: No manifest found — re-searching (results may differ from submission)")
            matches = searcher.search(limit=args.limit)
            if args.include_guidance:
                matches.extend(searcher.search_guidance(limit=args.limit))
            results = searcher.process_batch_results(args.process_batch, matches)
        if results:
            saved = searcher.save_to_database(results)
            searcher.print_results(results)
            print(f"\nSaved {saved} fine/fee records to database")
        return

    # Search regulations
    matches = searcher.search(limit=args.limit)

    # Optionally search guidance documents
    if args.include_guidance:
        guidance_matches = searcher.search_guidance(limit=args.limit)
        matches.extend(guidance_matches)

    if not matches:
        print("No matches found")
        return

    if args.dry_run:
        reg_count = sum(1 for m in matches if m.get('source_type') != 'guidance')
        guid_count = sum(1 for m in matches if m.get('source_type') == 'guidance')
        print(f"\nDry run: found {len(matches)} potential matches ({reg_count} regulations, {guid_count} guidance)")
        for m in matches[:10]:
            source = "[GUIDANCE]" if m.get('source_type') == 'guidance' else "[REG]"
            print(f"  {source} {m['title'][:60]}...")
        if len(matches) > 10:
            print(f"  ... and {len(matches) - 10} more")
        return

    if args.batch:
        batch_id = searcher.submit_batch(matches)
        print(f"\nBatch submitted: {batch_id}")
        print(f"Run with --process-batch {batch_id} when complete")
    else:
        results = asyncio.run(searcher.analyze_async(matches))
        saved = searcher.save_to_database(results)
        searcher.print_results(results)

        output_file = OUTPUTS_DIR / f"fines_{args.state}_results.json"
        searcher.save_results_json(results, output_file)

        print(f"\nSaved {saved} fine/fee records to database")


if __name__ == '__main__':
    main()
