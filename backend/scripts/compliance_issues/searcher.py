"""
Generic compliance issue searcher.

Provides a unified interface for searching regulations for compliance issues
across different states and issue types.
"""

import json
import re
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, Iterator
from html import escape

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared_utils import (
    get_async_openai_client,
    get_openai_client,
    call_llm_parse_async,
    get_db_connection,
    format_batch_request,
    BatchManager,
    parse_batch_result_tool_use,
    DEFAULT_MODEL,
)
from observability import LLMTraceContext, flush_langfuse
from config import OUTPUTS_DIR

from .config import StateConfig, IssueTypeConfig
from .models import BaseComplianceAnalysis
from .statute_checker import StatuteChecker, NoOpStatuteChecker, create_statute_checker
from .validation import are_all_verbatim


class ComplianceIssueSearcher:
    """
    Search for compliance issues in regulations.

    This class is parameterized by:
    - StateConfig: Which state's regulations to search
    - IssueTypeConfig: What type of issue to look for
    - with_statutes: Whether to do statute lookup

    Usage:
        searcher = ComplianceIssueSearcher(
            state_config=STATES['nj'],
            issue_config=ISSUE_TYPES['wet_signature'],
            with_statutes=True,
            run_id='abc123',  # Optional: for tracking pipeline runs
        )

        # Step 1: Regex triage
        matches = searcher.search()

        # Step 2: LLM analysis
        results = await searcher.analyze_async(matches)

        # Or use batch API
        batch_id = searcher.submit_batch(matches)
    """

    def __init__(
        self,
        state_config: StateConfig,
        issue_config: IssueTypeConfig,
        with_statutes: bool = True,
        run_id: Optional[str] = None,
    ):
        """
        Initialize searcher.

        Args:
            state_config: State configuration (NJ, NY, etc.)
            issue_config: Issue type configuration (wet_signature, mail_only, etc.)
            with_statutes: Whether to enable statute lookup
            run_id: Optional pipeline run identifier for tracking
        """
        self.state_config = state_config
        self.issue_config = issue_config
        self.with_statutes = with_statutes
        self.run_id = run_id

        # Create statute checker
        self.statute_checker = create_statute_checker(state_config, with_statutes)

        # Batches directory
        self.batches_dir = OUTPUTS_DIR / 'batches' / issue_config.name

    def search(self, limit: Optional[int] = None) -> list[dict]:
        """
        Search regulations in database for potential compliance issues.

        Uses regex pattern matching from the issue config.

        Args:
            limit: Optional limit on number of matches to return

        Returns:
            List of match dicts with document info, context, etc.
        """
        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return []

        prefix = self.state_config.citation_prefix
        state_code = self.state_config.state_code
        issue_type = self.issue_config.db_issue_type

        # Get already-analyzed document IDs for this specific issue type
        already_analyzed = set()
        try:
            result = conn.execute(
                """
                SELECT document_id FROM compliance_issues
                WHERE state = %s AND issue_type = %s
                """,
                (state_code, issue_type)
            ).fetchall()
            already_analyzed = {row[0] for row in result}
            if already_analyzed:
                print(f"Skipping {len(already_analyzed)} already-analyzed docs for {issue_type}")
        except Exception as e:
            print(f"Warning: Could not check existing analysis: {e}")

        # Query documents from database
        print(f"Querying {state_code} regulations from database...")

        try:
            # Get all documents for this state (excluding documents marked for exclusion)
            query = f"""
                SELECT id, title, content, url, hierarchy_level, hierarchy_path,
                       {prefix}_title, {prefix}_chapter, {prefix}_section, source_index
                FROM regulatory_documents
                WHERE state = %s
                  AND content IS NOT NULL
                  AND (exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)
                ORDER BY id
            """
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

            # Skip if already analyzed for this issue type
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
                # Get context around match (larger for LLM)
                match_obj = matched_pattern.search(content)
                if match_obj:
                    start = max(0, match_obj.start() - 300)
                    end = min(len(content), match_obj.end() + 300)
                    context = content[start:end].strip()
                else:
                    context = content[:600]

                # Extract statute references if checker is available
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

        # Print summary
        print(f"Found {len(matches)} potential matches")

        return matches

    # Common instructions appended to all compliance issue prompts
    # Field names match database columns: requirement_found, verbatim_supporting_text, required_by_statute, severity, decision_rationale
    LIST_OUTPUT_INSTRUCTIONS = """

    IMPORTANT: Return a LIST with at least one item. Each item needs: requirement_found, verbatim_supporting_text, required_by_statute, severity, decision_rationale.

    OUTPUT FORMAT:
    - If you find issue(s): return each with requirement_found=true, severity 1-10, and verbatim_supporting_text with exact quotes
    - If NO issue: return ONE item with requirement_found=false, severity=null, verbatim_supporting_text=[] (empty array)

    Example with 2 issues found:
    {
      "issues": [
        {"requirement_found": true, "verbatim_supporting_text": ["shall be signed in ink"], "required_by_statute": false, "severity": 7, "decision_rationale": "Explicit ink requirement with no electronic alternative"},
        {"requirement_found": true, "verbatim_supporting_text": ["original signature required", "signature in the presence of a notary"], "required_by_statute": true, "severity": 8, "decision_rationale": "Statute mandates original signatures"}
      ]
    }

    Example with NO issue (always return one item explaining why):
    {
      "issues": [
        {"requirement_found": false, "verbatim_supporting_text": [], "required_by_statute": null, "severity": null, "decision_rationale": "Regulation explicitly permits electronic signatures, no wet signature requirement"}
      ]
    }

    SEVERITY RATING (1-10 scale, only when requirement_found=true):
    - 10: Complete barrier (no alternatives, major burden on public)
    - 7-9: Significant barrier (limited alternatives, notable burden)
    - 4-6: Moderate issue (some alternatives exist, inconvenient)
    - 1-3: Minor issue (easy workarounds, minimal burden)
    """

    def create_prompt(self, match: dict) -> tuple[Optional[str], str]:
        """
        Create LLM prompt for analyzing a match.

        Returns:
            Tuple of (system_prompt, user_prompt) for optimal caching
        """
        # Get statute context if available
        statute_context = self.statute_checker.get_statute_context(
            match.get('statute_citations', [])
        )

        # Get prompt from issue config (loaded from YAML)
        prompt_config = self.issue_config.prompt
        base_system_prompt = prompt_config.get('system', '')
        # Append common list output instructions to all prompts
        system_prompt = base_system_prompt + self.LIST_OUTPUT_INSTRUCTIONS
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
                import re
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

        # Fill in template variables
        user_prompt = template.format(
            regulation_context=regulation_text,
            statute_context=statute_context if statute_context else "No statute references found.",
        )

        return system_prompt, user_prompt

    async def analyze_match(
        self,
        match: dict,
        client,
    ) -> dict:
        """
        Analyze a single match with LLM.

        Args:
            match: Match dict from search()
            client: AsyncAnthropic client

        Returns:
            Match dict augmented with llm_analysis
        """
        system_prompt, user_prompt = self.create_prompt(match)

        try:
            analysis, _ = await call_llm_parse_async(
                client=client,
                prompt=user_prompt,
                response_format=self.issue_config.response_model,
                model=DEFAULT_MODEL,
                system=system_prompt,  # Static prompt for caching
            )

            if analysis is None:
                print(f"  ⚠️ LLM analysis failed for {match['title'][:50]}...")
                return {
                    **match,
                    'llm_analysis': None,
                    'analysis_error': True,
                }

            return {
                **match,
                'llm_analysis': analysis.model_dump(),
                'analysis_error': False,
            }

        except Exception as e:
            print(f"  ⚠️ Error analyzing {match['title'][:50]}: {e}")
            return {
                **match,
                'llm_analysis': None,
                'analysis_error': True,
            }

    async def analyze_async(
        self,
        matches: list[dict],
        batch_size: int = 10,
    ) -> list[dict]:
        """
        Analyze matches using async LLM calls.

        Args:
            matches: List of matches from search()
            batch_size: Number of concurrent requests

        Returns:
            List of matches with llm_analysis added
        """
        client = get_async_openai_client()
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

            # Progress update
            completed = min(i + batch_size, len(matches))
            if completed % 20 == 0:
                print(f"    Completed {completed}/{len(matches)}")

        return results

    def submit_batch(self, matches: list[dict]) -> str:
        """
        Submit matches for batch API processing.

        Args:
            matches: List of matches from search()

        Returns:
            Batch API ID
        """
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

        print(f"      ✓ Formatted {len(requests)} requests")

        print(f"\n[2/2] Submitting to Anthropic Batch API...")

        # Create trace context for observability
        trace_context = LLMTraceContext(
            run_id=self.run_id or "unknown",
            session_name=f"compliance_{self.state_config.state_code}_{self.issue_config.name}",
            stage="batch_submission",
            state=self.state_config.state_code,
            issue_type=self.issue_config.name,
            prompt_name=f"compliance_{self.issue_config.name}",
            extra={"match_count": len(matches)},
        )

        manager = BatchManager(batches_dir=self.batches_dir)
        batch_id = manager.submit_batch(
            requests=requests,
            batch_name=f"{self.state_config.state_code.lower()}_{self.issue_config.name}",
            metadata={
                'state': self.state_config.state_code,
                'issue_type': self.issue_config.name,
                'match_count': len(matches),
                'run_id': self.run_id,
            },
            trace_context=trace_context,
        )

        print(f"      ✓ Submitted batch: {batch_id}")
        return batch_id

    def process_batch_results(
        self,
        batch_id: str,
        matches: list[dict],
    ) -> list[dict]:
        """
        Process results from a completed batch.

        Args:
            batch_id: Batch API ID
            matches: Original matches (for context)

        Returns:
            List of matches with llm_analysis added
        """
        print("=" * 70)
        print(f"PROCESSING {self.issue_config.display_name.upper()} BATCH")
        print("=" * 70)
        print()

        manager = BatchManager(batches_dir=self.batches_dir)

        # Check batch status
        print("[1/3] Checking batch status...")
        try:
            status = manager.get_batch_status(batch_id)
        except Exception as e:
            print(f"      ❌ Could not retrieve batch: {e}")
            return []

        if status['status'] != 'ended':
            print(f"      ⚠️  Batch is still processing: {status['status']}")
            print(f"      Progress: {status['succeeded'] + status['errored']}/{status['total']}")
            print("\nWait for batch to complete, then run this command again.")
            return []

        print(f"      ✓ Batch completed")
        print(f"      Succeeded: {status['succeeded']}")
        print(f"      Errored: {status['errored']}")
        print()

        # Build match lookup by document_id
        match_lookup = {m['document_id']: m for m in matches}

        # Get batch directory for logging and metadata
        batch_dir = manager.find_batch_dir(batch_id)

        # Retrieve run_id from batch metadata if not set on instance
        if self.run_id is None and batch_dir:
            info_file = batch_dir / 'batch_info.json'
            if info_file.exists():
                import json
                with open(info_file) as f:
                    batch_info = json.load(f)
                if batch_info.get('run_id'):
                    self.run_id = batch_info['run_id']
                    print(f"      Using run_id from batch metadata: {self.run_id}")

        # Retrieve and process results
        print("[2/3] Retrieving and processing results...")

        results_iter = manager.get_batch_results(batch_id)
        results = []
        processed = 0
        errored = 0
        succeeded = 0

        # Token tracking for observability
        total_input_tokens = 0
        total_output_tokens = 0

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

            # Parse analysis
            try:
                # Extract token usage from result
                if hasattr(result.result, 'message') and hasattr(result.result.message, 'usage'):
                    usage = result.result.message.usage
                    total_input_tokens += getattr(usage, 'input_tokens', 0)
                    total_output_tokens += getattr(usage, 'output_tokens', 0)

                analysis = parse_batch_result_tool_use(result, self.issue_config.response_model)
                if analysis:
                    results.append({
                        **match,
                        'llm_analysis': analysis.model_dump(),
                        'analysis_error': False,
                    })
                    succeeded += 1
                else:
                    results.append({**match, 'llm_analysis': None, 'analysis_error': True})
                    errored += 1
            except Exception as e:
                if batch_dir:
                    manager.log_error(batch_dir, custom_id, 'ERROR', str(e))
                results.append({**match, 'llm_analysis': None, 'analysis_error': True})
                errored += 1

            processed += 1

        print(f"      ✓ Processed {processed} results ({errored} errors)")
        print(f"      Total tokens: {total_input_tokens:,} input, {total_output_tokens:,} output")

        # Update batch info
        if batch_dir:
            info_file = batch_dir / 'batch_info.json'
            if info_file.exists():
                with open(info_file) as f:
                    batch_info = json.load(f)
                batch_info['status'] = 'processed'
                batch_info['processed_at'] = datetime.now().isoformat()
                batch_info['total_input_tokens'] = total_input_tokens
                batch_info['total_output_tokens'] = total_output_tokens
                with open(info_file, 'w') as f:
                    json.dump(batch_info, f, indent=2)

        # Log batch completion to Langfuse
        if self.run_id:
            try:
                from observability import log_batch_completion, calculate_cost
                trace_context = LLMTraceContext(
                    run_id=self.run_id,
                    session_name=f"compliance_{self.state_config.state_code}_{self.issue_config.name}",
                    stage="batch_processing",
                    state=self.state_config.state_code,
                    issue_type=self.issue_config.name,
                    prompt_name=f"compliance_{self.issue_config.name}",
                )
                total_cost = calculate_cost(
                    model="claude-sonnet-4-5-20250929",  # Sonnet 4.5
                    input_tokens=total_input_tokens,
                    output_tokens=total_output_tokens,
                ) * 0.5  # 50% batch discount
                log_batch_completion(
                    context=trace_context,
                    trace_id=None,
                    succeeded=succeeded,
                    errored=errored,
                    expired=0,
                    total_input_tokens=total_input_tokens,
                    total_output_tokens=total_output_tokens,
                    total_cost=total_cost,
                )
                flush_langfuse()
            except Exception as e:
                print(f"      ⚠️  Could not log to Langfuse: {e}")

        return results

    def save_to_database(self, results: list[dict]) -> int:
        """
        Save all analyzed results to compliance_issues table.

        Each issue instance becomes a separate row with occurrence_number 1, 2, 3...
        If no issues found, saves one row with requirement_found=False.

        Args:
            results: List of analyzed matches

        Returns:
            Number of records saved
        """
        # Filter for results that have LLM analysis (skip errors)
        analyzed = [
            r for r in results
            if r.get('llm_analysis') is not None
        ]

        if not analyzed:
            print("No analyzed results to save")
            return 0

        # Count total issues across all documents
        total_rows = sum(
            len(r.get('llm_analysis', {}).get('issues', []))
            for r in analyzed
        )
        confirmed_issues = sum(
            1 for r in analyzed
            for issue in r.get('llm_analysis', {}).get('issues', [])
            if issue.get('requirement_found')
        )
        print(f"\nSaving {len(analyzed)} documents ({confirmed_issues} confirmed issues, {total_rows} total rows)...")

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
                    issues = analysis.get('issues', [])

                    # Save each issue as a separate row (including "no issue" explanations)
                    for occurrence_num, issue in enumerate(issues, start=1):
                        verbatim_supporting_text = issue.get('verbatim_supporting_text', [])
                        full_content = item.get('full_content') or ''
                        regex_match_context = item.get('context') or ''

                        # Compute verbatim status - all texts must match source
                        is_verbatim = are_all_verbatim(
                            texts=verbatim_supporting_text,
                            source_text=full_content,
                            fallback_context=regex_match_context,
                        )

                        # Enforce severity for confirmed issues - default to minimum
                        requirement_found = issue.get('requirement_found', False)
                        severity = issue.get('severity')
                        if requirement_found and severity is None:
                            print(f"  Warning: Missing severity for doc {document_id}, defaulting to 1")
                            severity = 1

                        conn.execute(
                            """
                            INSERT INTO compliance_issues
                            (document_id, issue_type, occurrence_number, regex_match_pattern, regex_match_context, url,
                             state, run_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                document_id,
                                self.issue_config.db_issue_type,
                                occurrence_num,
                                item.get('term_matched'),  # regex_match_pattern
                                regex_match_context,  # regex_match_context
                                item.get('url', ''),
                                self.state_config.state_code,
                                self.run_id,  # Pipeline run identifier
                            )
                        )
                        saved += 1

                        # Write LLM analysis data to compliance_issue_analyses (PR 6.2)
                        # Only for the first occurrence per (document_id, issue_type)
                        if occurrence_num == 1:
                            result = conn.execute(
                                """
                                INSERT INTO compliance_issue_analyses
                                (document_id, issue_type, state, grouped_match_count,
                                 requirement_found, is_verbatim, final_severity,
                                 verbatim_requirements,
                                 cites_federal_statute, federal_citation,
                                 tier1_reasoning,
                                 highest_tier_completed, pipeline_version)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (document_id, issue_type) DO UPDATE SET
                                  requirement_found = EXCLUDED.requirement_found,
                                  is_verbatim = EXCLUDED.is_verbatim,
                                  final_severity = EXCLUDED.final_severity,
                                  verbatim_requirements = EXCLUDED.verbatim_requirements,
                                  cites_federal_statute = EXCLUDED.cites_federal_statute,
                                  federal_citation = EXCLUDED.federal_citation,
                                  tier1_reasoning = EXCLUDED.tier1_reasoning,
                                  updated_at = NOW()
                                RETURNING id
                                """,
                                (
                                    document_id,
                                    self.issue_config.db_issue_type,
                                    self.state_config.state_code,
                                    len(issues),
                                    requirement_found,
                                    is_verbatim,
                                    severity,
                                    verbatim_supporting_text,
                                    issue.get('required_by_statute'),
                                    issue.get('statute_citation'),
                                    issue.get('decision_rationale'),
                                    0,  # highest_tier_completed
                                    'searcher',
                                )
                            )
                            # PR 6.5: Link compliance_issues to analysis via FK
                            analysis_row = result.fetchone()
                            if analysis_row:
                                conn.execute(
                                    """
                                    UPDATE compliance_issues SET analysis_id = %s
                                    WHERE document_id = %s AND issue_type = %s AND analysis_id IS NULL
                                    """,
                                    (analysis_row[0], document_id, self.issue_config.db_issue_type)
                                )

                except Exception as e:
                    errors += 1
                    print(f"  Error saving {item.get('title', 'unknown')[:50]}: {e}")
                    # Rollback to recover from aborted transaction state
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

        print(f"Database save complete: {saved} rows saved, {skipped} skipped, {errors} errors")
        return saved

    def print_results(self, results: list[dict]) -> None:
        """Print results summary to console."""
        print("\n" + "=" * 80)
        print(f"{self.issue_config.display_name.upper()} RESULTS")
        print("=" * 80)

        total_docs = len(results)
        confirmed_issues = sum(
            1 for r in results
            for issue in r.get('llm_analysis', {}).get('issues', [])
            if issue.get('requirement_found')
        )
        docs_with_issues = sum(
            1 for r in results
            if any(issue.get('requirement_found') for issue in r.get('llm_analysis', {}).get('issues', []))
        )
        with_statute_refs = sum(1 for r in results if r.get('statute_citations'))

        # Count issues from statute vs agency
        from_statute_count = 0
        from_agency_count = 0
        for r in results:
            for issue in r.get('llm_analysis', {}).get('issues', []):
                if issue.get('requirement_found'):
                    if issue.get('required_by_statute') is True:
                        from_statute_count += 1
                    elif issue.get('required_by_statute') is False:
                        from_agency_count += 1

        print(f"\nTotal documents searched: {total_docs}")
        print(f"Documents with {self.issue_config.display_name}: {docs_with_issues}")
        print(f"Total confirmed issues: {confirmed_issues}")
        print(f"  - With statute references: {with_statute_refs}")
        print(f"  - Requirements from statute: {from_statute_count}")
        print(f"  - Requirements from agency (not in statute): {from_agency_count}")

        # Show confirmed issues
        if confirmed_issues > 0:
            print("\n" + "-" * 80)
            print(f"{self.issue_config.display_name.upper()} FOUND:")
            print("-" * 80)

            prefix = self.state_config.citation_prefix
            shown = 0

            for r in results:
                if shown >= 30:
                    break
                issues = r.get('llm_analysis', {}).get('issues', [])
                for i, issue in enumerate(issues, 1):
                    if shown >= 30:
                        break
                    if not issue.get('requirement_found'):
                        continue  # Skip "no issue" explanations
                    from_stat = issue.get('required_by_statute')
                    source = "FROM STATUTE" if from_stat is True else "AGENCY-ADDED" if from_stat is False else "?"
                    severity = issue.get('severity', '?')
                    print(f"\n[{source}] [Sev:{severity}] {r['title'][:50]}... (#{i})")
                    print(f"   {prefix.upper()} {r.get(f'{prefix}_section', 'Unknown')}")
                    quotes = issue.get('verbatim_supporting_text', [])
                    quote = quotes[0] if quotes else 'N/A'
                    print(f"   Quote: \"{quote[:100] if quote else 'N/A'}\"")
                    if r.get('statute_citations'):
                        print(f"   Statute refs: {', '.join(r['statute_citations'][:3])}")
                    shown += 1

    def save_results_json(self, results: list[dict], output_file: Path) -> None:
        """Save results to JSON file."""
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Remove full_content to reduce file size
        cleaned_results = []
        for r in results:
            cleaned = {k: v for k, v in r.items() if k != 'full_content'}
            cleaned_results.append(cleaned)

        with open(output_file, 'w') as f:
            json.dump(cleaned_results, f, indent=2, ensure_ascii=False)
        print(f"\nSaved results to {output_file}")

    def generate_html(self, results: list[dict], output_file: Path) -> None:
        """Generate HTML table viewer with analysis results."""
        prefix = self.state_config.citation_prefix

        # Flatten results: one row per issue instance
        rows = []
        for r in results:
            issues = r.get('llm_analysis', {}).get('issues', [])
            if issues:
                for i, issue in enumerate(issues, 1):
                    rows.append({
                        'doc': r,
                        'issue': issue,
                        'occurrence': i,
                        'requirement_found': issue.get('requirement_found', False),
                    })
            else:
                # No issues found for this document
                rows.append({
                    'doc': r,
                    'issue': None,
                    'occurrence': 0,
                    'requirement_found': False,
                })

        # Count stats
        total = len(rows)
        has_issue_yes = sum(1 for row in rows if row['requirement_found'])
        has_issue_no = total - has_issue_yes
        from_statute = sum(1 for row in rows if row['issue'] and row['issue'].get('required_by_statute') is True)
        from_agency = sum(1 for row in rows if row['issue'] and row['issue'].get('required_by_statute') is False)

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.state_config.state_code} {self.issue_config.display_name} Analysis</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5;
            line-height: 1.5;
        }}
        .container {{ max-width: 1800px; margin: 0 auto; }}
        h1 {{ color: #333; margin-bottom: 10px; }}
        .summary {{
            background: white; padding: 20px; border-radius: 8px;
            margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .summary-stats {{ display: flex; gap: 15px; flex-wrap: wrap; margin-top: 15px; }}
        .stat-box {{ padding: 10px 20px; border-radius: 6px; font-weight: bold; }}
        .stat-yes {{ background: #d4edda; color: #155724; }}
        .stat-no {{ background: #e2e3e5; color: #383d41; }}
        .stat-agency {{ background: #fff3cd; color: #856404; }}
        .stat-statute {{ background: #cce5ff; color: #004085; }}
        .filters {{
            background: white; padding: 15px 20px; border-radius: 8px;
            margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex; gap: 15px; flex-wrap: wrap; align-items: center;
        }}
        .filters select, .filters input {{
            padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
        }}
        .filters input[type="text"] {{ width: 250px; }}
        .results-count {{ margin-left: auto; font-weight: 500; color: #666; }}
        .table-container {{
            background: white; border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow-x: auto;
        }}
        table {{ width: 100%; border-collapse: collapse; font-size: 0.9em; }}
        thead {{ background: #f8f9fa; position: sticky; top: 0; }}
        th {{
            padding: 12px 10px; text-align: left; font-weight: 600;
            border-bottom: 2px solid #dee2e6; cursor: pointer;
        }}
        th:hover {{ background: #e9ecef; }}
        td {{ padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }}
        tr:hover {{ background: #f8f9fa; }}
        .yes {{ color: #155724; font-weight: 600; }}
        .no {{ color: #6c757d; }}
        .from-statute {{ background: #cce5ff; color: #004085; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }}
        .from-agency {{ background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }}
        .quote {{ font-style: italic; color: #555; max-width: 400px; }}
        .citation {{ font-family: monospace; font-size: 0.85em; white-space: nowrap; }}
        .statute-refs {{ font-size: 0.8em; color: #666; max-width: 200px; }}
        .url-link {{ color: #007bff; text-decoration: none; font-size: 0.85em; }}
        .url-link:hover {{ text-decoration: underline; }}
        .hidden {{ display: none !important; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{self.state_config.state_code} {self.issue_config.display_name} Analysis</h1>

        <div class="summary">
            <p>Analyzed <strong>{total}</strong> potential matches from regex search.</p>
            <div class="summary-stats">
                <div class="stat-box stat-yes">Confirmed: {has_issue_yes}</div>
                <div class="stat-box stat-no">Not Confirmed: {has_issue_no}</div>
                <div class="stat-box stat-statute">From Statute: {from_statute}</div>
                <div class="stat-box stat-agency">Agency-Added: {from_agency}</div>
            </div>
        </div>

        <div class="filters">
            <label>Has Issue:</label>
            <select id="issueFilter" onchange="filterTable()">
                <option value="all">All</option>
                <option value="yes">Yes Only</option>
                <option value="no">No Only</option>
            </select>
            <label>Source:</label>
            <select id="sourceFilter" onchange="filterTable()">
                <option value="all">All</option>
                <option value="statute">From Statute</option>
                <option value="agency">Agency-Added</option>
            </select>
            <input type="text" id="searchFilter" placeholder="Search title/quote..." oninput="filterTable()">
            <div class="results-count">Showing <span id="visibleCount">{total}</span> of {total}</div>
        </div>

        <div class="table-container">
            <table id="resultsTable">
                <thead>
                    <tr>
                        <th>Issue?</th>
                        <th>Source</th>
                        <th>Severity</th>
                        <th>Citation</th>
                        <th>Title</th>
                        <th>Requirement Quote</th>
                        <th>Statute Refs</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
"""

        for row in rows:
            r = row['doc']
            issue = row['issue']
            requirement_found = row['requirement_found']
            occurrence = row['occurrence']

            quotes = issue.get('verbatim_supporting_text', []) if issue else []
            quote = quotes[0] if quotes else ''
            from_stat = issue.get('required_by_statute') if issue else None
            severity = issue.get('severity', '') if issue else ''
            statute_refs = r.get('statute_citations', [])

            issue_display = f'<span class="yes">YES #{occurrence}</span>' if requirement_found else '<span class="no">no</span>'

            if requirement_found and from_stat is True:
                source_display = '<span class="from-statute">From Statute</span>'
                source_data = 'statute'
            elif requirement_found and from_stat is False:
                source_display = '<span class="from-agency">Agency-Added</span>'
                source_data = 'agency'
            else:
                source_display = '-'
                source_data = 'none'

            statute_refs_display = ', '.join(statute_refs[:3]) if statute_refs else '-'
            if len(statute_refs) > 3:
                statute_refs_display += f' (+{len(statute_refs)-3})'

            search_text = f"{r.get('title', '')} {quote}".lower()
            severity_display = f'<span style="font-weight:bold">{severity}</span>' if severity else '-'

            html += f"""                    <tr data-issue="{'yes' if requirement_found else 'no'}" data-source="{source_data}" data-search="{escape(search_text)}">
                        <td>{issue_display}</td>
                        <td>{source_display}</td>
                        <td>{severity_display}</td>
                        <td class="citation">{r.get(f'{prefix}_section') or '-'}</td>
                        <td>{escape(r.get('title', '')[:80])}</td>
                        <td class="quote">{escape(quote[:200]) if quote else '-'}</td>
                        <td class="statute-refs">{escape(statute_refs_display)}</td>
                        <td><a class="url-link" href="{r.get('url', '')}" target="_blank">View</a></td>
                    </tr>
"""

        html += """                </tbody>
            </table>
        </div>
    </div>

    <script>
        function filterTable() {
            const issue = document.getElementById('issueFilter').value;
            const source = document.getElementById('sourceFilter').value;
            const search = document.getElementById('searchFilter').value.toLowerCase();

            let visible = 0;
            document.querySelectorAll('#resultsTable tbody tr').forEach(row => {
                let show = true;
                if (issue !== 'all' && row.dataset.issue !== issue) show = false;
                if (source !== 'all' && row.dataset.source !== source) show = false;
                if (search && !row.dataset.search.includes(search)) show = false;

                row.classList.toggle('hidden', !show);
                if (show) visible++;
            });
            document.getElementById('visibleCount').textContent = visible;
        }
    </script>
</body>
</html>
"""

        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"HTML viewer saved to {output_file}")
