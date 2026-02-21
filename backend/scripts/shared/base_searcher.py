"""
Base pattern searcher for regulation analysis.

Provides a reusable regex+LLM pipeline that can be extended for different
analysis types (compliance issues, incorporation by reference, etc.).
"""

import json
import re
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional, Type
from html import escape
from pydantic import BaseModel

from lib.db import get_db_connection
from lib.llm import get_async_anthropic_client, call_llm_parse_async, DEFAULT_MODEL
from lib.batch import format_batch_request, BatchManager, parse_batch_result_tool_use
from config import OUTPUTS_DIR

from scripts.compliance_issues.config import JurisdictionConfig, IssueTypeConfig
from scripts.compliance_issues.statute_checker import create_statute_checker


class BasePatternSearcher(ABC):
    """
    Abstract base class for pattern-based regulation searching.

    Provides:
    - Regex pattern matching against regulatory documents
    - Context extraction around matches
    - Statute reference extraction
    - Async LLM analysis with batching
    - Batch API submission and processing
    - Console, JSON, and HTML reporting

    Subclasses must implement:
    - save_to_database(): How to persist analyzed results
    - get_already_analyzed_ids(): Which documents to skip
    """

    def __init__(
        self,
        state_config: JurisdictionConfig,
        issue_config: IssueTypeConfig,
        with_statutes: bool = True,
        batches_subdir: str = 'batches',
        cache=None,
    ):
        """
        Initialize searcher.

        Args:
            state_config: Jurisdiction configuration (NJ, NY, etc.)
            issue_config: Issue type configuration with patterns and prompts
            with_statutes: Whether to enable statute lookup
            batches_subdir: Subdirectory for batch files
            cache: Optional CacheManager for LLM response caching
        """
        self.state_config = state_config
        self.issue_config = issue_config
        self.with_statutes = with_statutes
        self.cache = cache

        # Create statute checker
        self.statute_checker = create_statute_checker(state_config, with_statutes)

        # Batches directory
        self.batches_dir = OUTPUTS_DIR / batches_subdir / issue_config.name

    @abstractmethod
    def get_already_analyzed_ids(self, conn) -> set[int]:
        """
        Get document IDs that have already been analyzed.

        Args:
            conn: Database connection

        Returns:
            Set of document IDs to skip
        """
        pass

    @abstractmethod
    def save_to_database(self, results: list[dict]) -> int:
        """
        Save analyzed results to the database.

        Args:
            results: List of analyzed matches with llm_analysis

        Returns:
            Number of records saved
        """
        pass

    def search(self, limit: Optional[int] = None, tag: Optional[str] = None) -> list[dict]:
        """
        Search regulations for pattern matches.

        Args:
            limit: Optional limit on number of matches
            tag: Optional tag filter — only search documents with this tag
                 (e.g., 'scan:compliance'). Requires document_tags table.

        Returns:
            List of match dicts with document info, context, etc.
        """
        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return []

        prefix = self.state_config.citation_prefix
        state_code = self.state_config.state_code

        # Get already-analyzed document IDs
        already_analyzed = self.get_already_analyzed_ids(conn)
        if already_analyzed:
            print(f"Skipping {len(already_analyzed)} already-analyzed docs")

        # Query documents
        tag_msg = f" (tag: {tag})" if tag else ""
        print(f"Querying {state_code} regulations from database{tag_msg}...")

        try:
            tag_join = ""
            params = [state_code]
            if tag:
                tag_join = "JOIN document_tags dt ON dt.document_id = rd.id AND dt.tag = %s"
                params = [state_code, tag]

            query = f"""
                SELECT rd.id, rd.title, rd.content, rd.url, rd.hierarchy_level, rd.hierarchy_path,
                       rd.{prefix}_title, rd.{prefix}_chapter, rd.{prefix}_section, rd.source_index
                FROM regulatory_documents rd
                {tag_join}
                WHERE rd.state = %s
                  AND rd.content IS NOT NULL
                  AND (rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)
                ORDER BY rd.id
            """
            # params order: tag (if present) must come before state in the JOIN
            # but state is in WHERE — psycopg2 uses positional %s
            if tag:
                rows = conn.execute(query, (tag, state_code)).fetchall()
            else:
                rows = conn.execute(query, (state_code,)).fetchall()
            print(f"Found {len(rows)} {state_code} documents to search...")

        except Exception as e:
            print(f"Database query error: {e}")
            conn.close()
            return []

        matches = []
        compiled_patterns = self.issue_config.compiled_patterns

        for row in rows:
            doc_id, title, content, url, hierarchy_level, hierarchy_path, \
                doc_title, doc_chapter, doc_section, source_index = row

            if not content:
                continue

            if doc_id in already_analyzed:
                continue

            # Check patterns
            matched_term = None
            matched_pattern = None

            for pattern in compiled_patterns:
                match_obj = pattern.search(content)
                if match_obj:
                    matched_term = pattern.pattern
                    matched_pattern = pattern
                    break

            if matched_pattern:
                # Get context around match
                match_obj = matched_pattern.search(content)
                if match_obj:
                    start = max(0, match_obj.start() - 300)
                    end = min(len(content), match_obj.end() + 300)
                    context = content[start:end].strip()
                else:
                    context = content[:600]

                # Extract statute references
                statute_refs = self.statute_checker.extract_references(content)

                result = {
                    'document_id': doc_id,
                    'title': title or '',
                    'url': url or '',
                    'term_matched': matched_term,
                    'context': context,
                    'full_content': content,
                    f'{prefix}_title': doc_title,
                    f'{prefix}_chapter': doc_chapter,
                    f'{prefix}_section': doc_section,
                    'hierarchy_path': hierarchy_path or '',
                    'source_index': source_index,
                    'statute_citations': statute_refs,
                }

                matches.append(result)

                if limit and len(matches) >= limit:
                    break

        conn.close()
        print(f"Found {len(matches)} potential matches")
        return matches

    def create_prompt(self, match: dict) -> tuple[Optional[str], str]:
        """Create LLM prompt for analyzing a match."""
        statute_context = self.statute_checker.get_statute_context(
            match.get('statute_citations', [])
        )

        prompt_config = self.issue_config.prompt
        system_prompt = prompt_config.get('system')
        template = prompt_config.get('template', '')

        # Use full content for small docs, windowed content for large docs
        full_content = match.get('full_content') or match['context']
        MAX_CONTENT_CHARS = 15000
        WINDOW_RADIUS = 1500  # ±1500 chars around each match (enough context, captures all matches)

        if len(full_content) <= MAX_CONTENT_CHARS:
            regulation_text = full_content
        else:
            # For large docs, find ALL regex matches and create merged windows
            # This ensures we capture all instances without duplication
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
                # Fallback: use beginning of doc
                regulation_text = full_content[:MAX_CONTENT_CHARS]
            else:
                # Create windows around each match
                windows = []
                for m in all_matches:
                    match_center = (m.start() + m.end()) // 2
                    win_start = max(0, match_center - WINDOW_RADIUS)
                    win_end = min(len(full_content), match_center + WINDOW_RADIUS)
                    windows.append((win_start, win_end))

                # Merge overlapping windows
                windows.sort()
                merged = [windows[0]]
                for start, end in windows[1:]:
                    last_start, last_end = merged[-1]
                    if start <= last_end:  # Overlapping
                        merged[-1] = (last_start, max(last_end, end))
                    else:
                        merged.append((start, end))

                # Extract merged regions (with separator if multiple)
                regions = []
                for start, end in merged:
                    regions.append(full_content[start:end])

                regulation_text = "\n\n[...]\n\n".join(regions)

        user_prompt = template.format(
            regulation_context=regulation_text,
            statute_context=statute_context if statute_context else "No statute references found.",
        )

        return system_prompt, user_prompt

    async def analyze_match(self, match: dict, client) -> dict:
        """Analyze a single match with LLM."""
        system_prompt, user_prompt = self.create_prompt(match)

        try:
            analysis, _ = await call_llm_parse_async(
                client=client,
                prompt=user_prompt,
                response_format=self.issue_config.response_model,
                model=DEFAULT_MODEL,
                system=system_prompt,
                cache=self.cache,
                cache_metadata={"pipeline": "compliance_scan", "tier": None, "document_id": match.get("document_id")},
            )

            if analysis is None:
                print(f"  Warning: LLM analysis failed for {match['title'][:50]}...")
                return {**match, 'llm_analysis': None, 'analysis_error': True}

            return {**match, 'llm_analysis': analysis.model_dump(), 'analysis_error': False}

        except Exception as e:
            print(f"  Error analyzing {match['title'][:50]}: {e}")
            return {**match, 'llm_analysis': None, 'analysis_error': True}

    async def analyze_async(self, matches: list[dict], batch_size: int = 10) -> list[dict]:
        """Analyze matches using async LLM calls."""
        client = get_async_anthropic_client()
        results = []

        print(f"\nAnalyzing {len(matches)} matches with LLM...")

        for i in range(0, len(matches), batch_size):
            batch = matches[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(matches) + batch_size - 1) // batch_size
            print(f"  Batch {batch_num}/{total_batches}...")

            tasks = [self.analyze_match(m, client) for m in batch]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

            completed = min(i + batch_size, len(matches))
            if completed % 20 == 0:
                print(f"    Completed {completed}/{len(matches)}")

        return results

    def submit_batch(self, matches: list[dict]) -> str:
        """Submit matches for batch API processing."""
        print(f"\n[1/2] Formatting {len(matches)} batch requests...")

        requests = []
        for match in matches:
            system_prompt, user_prompt = self.create_prompt(match)
            request = format_batch_request(
                custom_id=f"doc_{match['document_id']}",
                prompt=user_prompt,
                response_format=self.issue_config.response_model,
                system=system_prompt,
            )
            requests.append(request)

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

        print(f"      Submitted batch: {batch_id}")
        return batch_id

    def process_batch_results(self, batch_id: str, matches: list[dict]) -> list[dict]:
        """Process results from a completed batch."""
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
            print(f"      Progress: {status['succeeded'] + status['errored']}/{status['total']}")
            return []

        print(f"      Batch completed: {status['succeeded']} succeeded, {status['errored']} errored")

        match_lookup = {m['document_id']: m for m in matches}
        batch_dir = manager.find_batch_dir(batch_id)

        print("[2/3] Retrieving and processing results...")

        results_iter = manager.get_batch_results(batch_id)
        results = []
        processed = 0
        errored = 0

        for result in results_iter:
            custom_id = result.custom_id
            doc_id = int(custom_id.replace('doc_', ''))
            match = match_lookup.get(doc_id)

            if not match:
                errored += 1
                processed += 1
                continue

            if result.result.type != 'succeeded':
                if batch_dir:
                    manager.log_error(batch_dir, custom_id, result.result.type.upper(), str(result.result))
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

        print(f"      Processed {processed} results ({errored} errors)")

        if batch_dir:
            info_file = batch_dir / 'batch_info.json'
            if info_file.exists():
                with open(info_file) as f:
                    batch_info = json.load(f)
                batch_info['status'] = 'processed'
                batch_info['processed_at'] = datetime.now().isoformat()
                with open(info_file, 'w') as f:
                    json.dump(batch_info, f, indent=2)

        return results

    def print_results(self, results: list[dict]) -> None:
        """Print results summary to console."""
        print("\n" + "=" * 80)
        print(f"{self.issue_config.display_name.upper()} RESULTS")
        print("=" * 80)

        total = len(results)
        confirmed = sum(1 for r in results if (r.get('llm_analysis') or {}).get('llm_confirmed', False))

        print(f"\nTotal regex matches searched: {total}")
        print(f"Confirmed: {confirmed}")

    def save_results_json(self, results: list[dict], output_file: Path) -> None:
        """Save results to JSON file."""
        output_file.parent.mkdir(parents=True, exist_ok=True)

        cleaned_results = []
        for r in results:
            cleaned = {k: v for k, v in r.items() if k != 'full_content'}
            cleaned_results.append(cleaned)

        with open(output_file, 'w') as f:
            json.dump(cleaned_results, f, indent=2, ensure_ascii=False)
        print(f"\nSaved results to {output_file}")
