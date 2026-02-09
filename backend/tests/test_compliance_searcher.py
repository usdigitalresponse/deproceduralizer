"""
Tests for ComplianceIssueSearcher.

Verifies search() behavior: pattern matching, skip logic, limits, etc.
All DB calls are mocked — no real database needed.
"""
import re
from unittest.mock import MagicMock, patch

import pytest

from scripts.compliance_issues.config import StateConfig, IssueTypeConfig
from scripts.compliance_issues.statute_checker import NoOpStatuteChecker


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def ny_state_config():
    """Minimal NY state config (no statute data)."""
    return StateConfig(
        state_code='NY',
        citation_prefix='nycrr',
        statute_file=None,
        statute_pattern=None,
        statute_citation_prefix=None,
    )


@pytest.fixture
def issue_config():
    """Issue config with a simple regex pattern."""
    return IssueTypeConfig(
        name='test_issue',
        display_name='Test Issue',
        db_issue_type='test_issue',
        category='test',
        description='A test issue type',
        response_model=None,
        patterns=[r'wet\s+signature'],
        prompt={},
    )


def _make_db_rows(docs):
    """
    Build fake DB rows from a list of dicts.

    Each dict needs: id, title, content, url.
    Optional: hierarchy_level, hierarchy_path, nycrr_title, nycrr_chapter,
              nycrr_section, source_index.
    """
    rows = []
    for d in docs:
        rows.append((
            d['id'],
            d.get('title', f'Doc {d["id"]}'),
            d.get('content', ''),
            d.get('url', f'https://example.com/{d["id"]}'),
            d.get('hierarchy_level', 'section'),
            d.get('hierarchy_path', ''),
            d.get('nycrr_title', '1'),
            d.get('nycrr_chapter', '1'),
            d.get('nycrr_section', '1.1'),
            d.get('source_index', 0),
        ))
    return rows


def _make_mock_conn(rows, already_analyzed_ids=None):
    """Create a mock DB connection that returns given rows."""
    conn = MagicMock()

    already_rows = [(aid,) for aid in (already_analyzed_ids or [])]

    # conn.execute() is called twice: first for already-analyzed, then for docs
    call_count = {'n': 0}

    def execute_side_effect(query, params=None):
        result = MagicMock()
        call_count['n'] += 1
        if call_count['n'] == 1:
            # First call: already-analyzed IDs
            result.fetchall.return_value = already_rows
        else:
            # Second call: document query
            result.fetchall.return_value = rows
        return result

    conn.execute.side_effect = execute_side_effect
    return conn


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestComplianceIssueSearcherSearch:
    """Test the search() method."""

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_basic_match(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Documents matching the pattern are returned."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        rows = _make_db_rows([
            {'id': 1, 'content': 'Requires a wet signature on the form.'},
            {'id': 2, 'content': 'No matching content here.'},
        ])
        mock_get_conn.return_value = _make_mock_conn(rows)

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert len(matches) == 1
        assert matches[0]['document_id'] == 1
        assert 'wet signature' in matches[0]['context'].lower()

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_no_matches(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Returns empty list when nothing matches."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        rows = _make_db_rows([
            {'id': 1, 'content': 'Nothing relevant here.'},
            {'id': 2, 'content': 'Also nothing.'},
        ])
        mock_get_conn.return_value = _make_mock_conn(rows)

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert matches == []

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_already_analyzed_skipped(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Documents already in compliance_issues table are skipped."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        rows = _make_db_rows([
            {'id': 1, 'content': 'Requires a wet signature.'},
            {'id': 2, 'content': 'Another wet signature requirement.'},
        ])
        # doc 1 already analyzed
        mock_get_conn.return_value = _make_mock_conn(rows, already_analyzed_ids=[1])

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert len(matches) == 1
        assert matches[0]['document_id'] == 2

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_limit(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Limit parameter caps the number of results."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        rows = _make_db_rows([
            {'id': i, 'content': f'Document {i} wet signature requirement.'}
            for i in range(1, 11)
        ])
        mock_get_conn.return_value = _make_mock_conn(rows)

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search(limit=3)

        assert len(matches) == 3

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_empty_content_skipped(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Documents with empty/None content are skipped."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        rows = _make_db_rows([
            {'id': 1, 'content': ''},
            {'id': 2, 'content': None},
            {'id': 3, 'content': 'Has a wet signature.'},
        ])
        # Patch None into the tuple for doc 2
        rows[1] = (2, 'Doc 2', None, 'https://example.com/2', 'section', '', '1', '1', '1.1', 0)
        mock_get_conn.return_value = _make_mock_conn(rows)

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert len(matches) == 1
        assert matches[0]['document_id'] == 3

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_no_db_connection(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Returns empty list when DB connection fails."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        mock_get_conn.return_value = None

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert matches == []

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_match_result_fields(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Verify all expected fields are present in match results."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        rows = _make_db_rows([
            {
                'id': 42,
                'title': 'Test Regulation',
                'content': 'The applicant must provide a wet signature.',
                'url': 'https://example.com/reg/42',
            },
        ])
        mock_get_conn.return_value = _make_mock_conn(rows)

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert len(matches) == 1
        m = matches[0]

        expected_fields = [
            'document_id', 'title', 'url', 'term_matched', 'context',
            'full_content', 'nycrr_title', 'nycrr_chapter', 'nycrr_section',
            'hierarchy_path', 'source_index', 'statute_citations',
        ]
        for field in expected_fields:
            assert field in m, f"Missing field: {field}"

        assert m['document_id'] == 42
        assert m['title'] == 'Test Regulation'
        assert m['url'] == 'https://example.com/reg/42'

    @patch('scripts.shared.base_searcher.create_statute_checker')
    @patch('scripts.shared.base_searcher.get_db_connection')
    def test_context_window(self, mock_get_conn, mock_statute, ny_state_config, issue_config):
        """Context is extracted around the match, not the full document."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        mock_statute.return_value = NoOpStatuteChecker()
        # Put the match in the middle of a large document
        padding = 'x' * 500
        content = f'{padding}wet signature{padding}'
        rows = _make_db_rows([{'id': 1, 'content': content}])
        mock_get_conn.return_value = _make_mock_conn(rows)

        searcher = ComplianceIssueSearcher(ny_state_config, issue_config, with_statutes=False)
        matches = searcher.search()

        assert len(matches) == 1
        # Context should be shorter than full content (300 chars each side + match)
        assert len(matches[0]['context']) < len(content)
        assert 'wet signature' in matches[0]['context']
        # Full content should be the whole thing
        assert matches[0]['full_content'] == content
