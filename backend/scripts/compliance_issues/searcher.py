"""
Generic compliance issue searcher.

Regex-only searcher for compliance issues. Finds regex matches in regulations
and saves them to the database. LLM analysis is handled by the research
pipeline (Tier 1-3).

See: https://github.com/michaeleboyce/deproceduralizer/issues/94
"""

from typing import Optional

from lib.db import get_db_connection

from scripts.shared.base_searcher import BasePatternSearcher

from .config import StateConfig, IssueTypeConfig


class ComplianceIssueSearcher(BasePatternSearcher):
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
        super().__init__(
            state_config=state_config,
            issue_config=issue_config,
            with_statutes=with_statutes,
            batches_subdir='batches/compliance',
        )
        self.run_id = run_id

    def get_already_analyzed_ids(self, conn) -> set[int]:
        """Get document IDs already in compliance_issues for this issue type."""
        already_analyzed = set()
        try:
            result = conn.execute(
                """
                SELECT document_id FROM compliance_issues
                WHERE state = %s AND issue_type = %s
                """,
                (self.state_config.state_code, self.issue_config.db_issue_type)
            ).fetchall()
            already_analyzed = {row[0] for row in result}
        except Exception as e:
            print(f"Warning: Could not check existing analysis: {e}")
        return already_analyzed

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
