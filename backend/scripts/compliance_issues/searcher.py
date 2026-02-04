"""
Generic compliance issue searcher.

Regex-only searcher for compliance issues. Finds regex matches in regulations
and saves them to the database. LLM analysis is handled by the research
pipeline (Tier 1-3).

See: https://github.com/michaeleboyce/deproceduralizer/issues/94
"""

from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared_utils import get_db_connection

from .config import StateConfig, IssueTypeConfig
from .statute_checker import create_statute_checker


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
            with_statutes=False,
            run_id='abc123',  # Optional: for tracking pipeline runs
        )

        # Step 1: Regex search
        matches = searcher.search()

        # Step 2: Save to database
        saved = searcher.save_to_database(matches)

        # LLM analysis is handled by the research pipeline:
        # python -m scripts.research_pipeline.cli --state nj --all --execute
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

    def save_to_database(self, matches: list[dict]) -> int:
        """
        Save regex matches to compliance_issues table.

        Creates one row per document match. No LLM analysis — that's handled
        by the research pipeline (Tier 1-3).

        Args:
            matches: List of match dicts from search()

        Returns:
            Number of records saved
        """
        if not matches:
            print("No matches to save")
            return 0

        print(f"\nSaving {len(matches)} regex matches to database...")

        conn = get_db_connection()
        if not conn:
            print("ERROR: Could not connect to database")
            return 0

        saved = 0
        skipped = 0
        errors = 0

        try:
            for item in matches:
                try:
                    document_id = item.get('document_id')
                    if document_id is None:
                        skipped += 1
                        continue

                    regex_match_context = item.get('context') or ''

                    conn.execute(
                        """
                        INSERT INTO compliance_issues
                        (document_id, issue_type, occurrence_number,
                         regex_match_pattern, regex_match_context, url,
                         state, run_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            document_id,
                            self.issue_config.db_issue_type,
                            1,  # One match per document
                            item.get('term_matched'),
                            regex_match_context,
                            item.get('url', ''),
                            self.state_config.state_code,
                            self.run_id,
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

        print(f"Database save complete: {saved} rows saved, {skipped} skipped, {errors} errors")
        return saved

    def print_summary(self, matches: list[dict]) -> None:
        """Print regex match summary to console."""
        print(f"\n{self.issue_config.display_name}: {len(matches)} regex matches")
        if matches:
            prefix = self.state_config.citation_prefix
            for m in matches[:10]:
                print(f"  - {m.get('title', '')[:60]} ({m.get(f'{prefix}_section', '?')})")
            if len(matches) > 10:
                print(f"  ... and {len(matches) - 10} more")
