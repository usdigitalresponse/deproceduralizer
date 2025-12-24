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
from config import OUTPUTS_DIR

from .config import StateConfig, IssueTypeConfig
from .models import BaseComplianceAnalysis
from .statute_checker import StatuteChecker, NoOpStatuteChecker, create_statute_checker


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
    ):
        """
        Initialize searcher.

        Args:
            state_config: State configuration (NJ, NY, etc.)
            issue_config: Issue type configuration (wet_signature, mail_only, etc.)
            with_statutes: Whether to enable statute lookup
        """
        self.state_config = state_config
        self.issue_config = issue_config
        self.with_statutes = with_statutes

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

        # Query documents from database
        print(f"Querying {state_code} regulations from database...")

        try:
            # Get all documents for this state
            query = f"""
                SELECT id, title, content, url, hierarchy_level, hierarchy_path,
                       {prefix}_title, {prefix}_chapter, {prefix}_section, source_index
                FROM regulatory_documents
                WHERE state = %s AND content IS NOT NULL
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
        system_prompt = prompt_config.get('system')
        template = prompt_config.get('template', '')

        # Fill in template variables
        user_prompt = template.format(
            regulation_context=match['context'],
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
            analysis = await call_llm_parse_async(
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

        # Get batch directory for logging
        batch_dir = manager.find_batch_dir(batch_id)

        # Retrieve and process results
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

            # Parse analysis
            try:
                analysis = parse_batch_result_tool_use(result, self.issue_config.response_model)
                if analysis:
                    results.append({
                        **match,
                        'llm_analysis': analysis.model_dump(),
                        'analysis_error': False,
                    })
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

        # Update batch info
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

    def save_to_database(self, results: list[dict]) -> int:
        """
        Save confirmed issues to compliance_issues table.

        Only saves results where LLM confirmed has_issue=True.

        Args:
            results: List of analyzed matches

        Returns:
            Number of records saved
        """
        # Filter for confirmed issues
        confirmed = [
            r for r in results
            if r.get('llm_analysis', {}).get('has_issue') is True
        ]

        if not confirmed:
            print("No confirmed issues to save")
            return 0

        print(f"\nSaving {len(confirmed)} confirmed issues to database...")

        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return 0

        saved = 0
        skipped = 0
        errors = 0
        prefix = self.state_config.citation_prefix

        try:
            for item in confirmed:
                try:
                    document_id = item.get('document_id')
                    if document_id is None:
                        skipped += 1
                        continue

                    analysis = item.get('llm_analysis', {})

                    # Insert into compliance_issues (upsert)
                    conn.execute(
                        """
                        INSERT INTO compliance_issues
                        (document_id, issue_type, term_matched, context, requirement_quote,
                         from_statute, statute_citation, llm_confirmed, state, url)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (document_id, issue_type) DO UPDATE SET
                            term_matched = EXCLUDED.term_matched,
                            context = EXCLUDED.context,
                            requirement_quote = EXCLUDED.requirement_quote,
                            from_statute = EXCLUDED.from_statute,
                            llm_confirmed = EXCLUDED.llm_confirmed,
                            url = EXCLUDED.url
                        """,
                        (
                            document_id,
                            self.issue_config.db_issue_type,
                            item.get('term_matched'),
                            item.get('context'),
                            analysis.get('requirement_quote'),
                            analysis.get('from_statute'),
                            None,  # statute_citation - could add if needed
                            True,  # llm_confirmed
                            self.state_config.state_code,
                            item.get('url', ''),  # url from search results
                        )
                    )
                    saved += 1

                except Exception as e:
                    errors += 1
                    print(f"  Error saving {item.get('title', 'unknown')[:50]}: {e}")

            conn.commit()

        except Exception as e:
            print(f"Database error: {e}")
            conn.rollback()
        finally:
            conn.close()

        print(f"Database save complete: {saved} saved, {skipped} skipped, {errors} errors")
        return saved

    def print_results(self, results: list[dict]) -> None:
        """Print results summary to console."""
        print("\n" + "=" * 80)
        print(f"{self.issue_config.display_name.upper()} RESULTS")
        print("=" * 80)

        total = len(results)
        with_issue = sum(
            1 for r in results
            if r.get('llm_analysis', {}).get('has_issue', False)
        )
        with_statute_refs = sum(1 for r in results if r.get('statute_citations'))
        from_statute = sum(
            1 for r in results
            if r.get('llm_analysis', {}).get('from_statute') is True
        )
        from_agency = sum(
            1 for r in results
            if r.get('llm_analysis', {}).get('has_issue') and
               r.get('llm_analysis', {}).get('from_statute') is False
        )

        print(f"\nTotal regex matches searched: {total}")
        print(f"Confirmed {self.issue_config.display_name}: {with_issue}")
        print(f"  - With statute references: {with_statute_refs}")
        print(f"  - Requirement from statute: {from_statute}")
        print(f"  - Requirement from agency (not in statute): {from_agency}")

        # Show confirmed issues
        confirmed = [
            r for r in results
            if r.get('llm_analysis', {}).get('has_issue', False)
        ]

        if confirmed:
            print("\n" + "-" * 80)
            print(f"{self.issue_config.display_name.upper()} FOUND:")
            print("-" * 80)

            prefix = self.state_config.citation_prefix

            for r in confirmed[:30]:
                analysis = r.get('llm_analysis', {})
                from_stat = analysis.get('from_statute')
                source = "FROM STATUTE" if from_stat is True else "AGENCY-ADDED" if from_stat is False else "?"
                print(f"\n[{source}] {r['title'][:60]}...")
                print(f"   {prefix.upper()} {r.get(f'{prefix}_section', 'Unknown')}")
                quote = analysis.get('requirement_quote', 'N/A')
                print(f"   Quote: \"{quote[:100] if quote else 'N/A'}\"")
                if r.get('statute_citations'):
                    print(f"   Statute refs: {', '.join(r['statute_citations'][:3])}")

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

        # Count stats
        total = len(results)
        has_issue_yes = sum(1 for r in results if r.get('llm_analysis', {}).get('has_issue'))
        has_issue_no = total - has_issue_yes
        with_statute = sum(1 for r in results if r.get('statute_citations'))
        from_statute = sum(1 for r in results if r.get('llm_analysis', {}).get('from_statute') is True)
        from_agency = sum(
            1 for r in results
            if r.get('llm_analysis', {}).get('has_issue') and r.get('llm_analysis', {}).get('from_statute') is False
        )

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
                        <th>Citation</th>
                        <th>Title</th>
                        <th>Requirement Quote</th>
                        <th>Statute Refs</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
"""

        for r in results:
            analysis = r.get('llm_analysis', {}) or {}
            has_issue = analysis.get('has_issue', False)
            quote = analysis.get('requirement_quote') or ''
            from_stat = analysis.get('from_statute')
            statute_refs = r.get('statute_citations', [])

            issue_display = '<span class="yes">YES</span>' if has_issue else '<span class="no">no</span>'

            if has_issue and from_stat is True:
                source_display = '<span class="from-statute">From Statute</span>'
                source_data = 'statute'
            elif has_issue and from_stat is False:
                source_display = '<span class="from-agency">Agency-Added</span>'
                source_data = 'agency'
            else:
                source_display = '-'
                source_data = 'none'

            statute_refs_display = ', '.join(statute_refs[:3]) if statute_refs else '-'
            if len(statute_refs) > 3:
                statute_refs_display += f' (+{len(statute_refs)-3})'

            search_text = f"{r.get('title', '')} {quote}".lower()

            html += f"""                    <tr data-issue="{'yes' if has_issue else 'no'}" data-source="{source_data}" data-search="{escape(search_text)}">
                        <td>{issue_display}</td>
                        <td>{source_display}</td>
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
