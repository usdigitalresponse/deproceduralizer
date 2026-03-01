"""Tests for JenAI document query filtering logic."""
import pytest
from unittest.mock import patch, MagicMock

from scripts.jenai_pipeline.db.document_queries import (
    get_sections_for_analysis,
    EXCLUDED_SECTION_TYPES,
)


@pytest.fixture
def mock_db():
    """Mock DB connection that captures executed SQL."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cursor.description = [
        ('id',), ('citation',), ('title',), ('content',), ('jurisdiction',),
        ('summary',), ('url',), ('hierarchy_level',), ('parent_id',),
    ]
    mock_cursor.fetchall.return_value = []

    with patch('scripts.jenai_pipeline.db.document_queries.get_db_connection', return_value=mock_conn):
        yield mock_cursor


def _get_executed_sql(mock_cursor) -> str:
    """Extract the SQL string from the mock cursor's execute call."""
    assert mock_cursor.execute.called, "Expected cursor.execute to be called"
    return mock_cursor.execute.call_args[0][0]


def _get_executed_params(mock_cursor) -> list:
    """Extract the params from the mock cursor's execute call."""
    return mock_cursor.execute.call_args[0][1]


class TestDefaultExclusions:
    """By default, reserved/definitions/scope sections and short content are excluded."""

    def test_excludes_section_types_by_default(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny')
        sql = _get_executed_sql(mock_db)
        assert 'section_type' in sql
        assert 'NOT IN' in sql

    def test_excluded_types_in_params(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny')
        params = _get_executed_params(mock_db)
        for section_type in EXCLUDED_SECTION_TYPES:
            assert section_type in params

    def test_always_has_base_content_filter(self, mock_db):
        """Base >50 char filter always applies regardless of include_all_types."""
        get_sections_for_analysis(jurisdiction='ny')
        sql = _get_executed_sql(mock_db)
        assert 'LENGTH(rd.content) > 50' in sql


class TestIncludeAllTypes:
    """--include-all-types disables the section_type filter."""

    def test_no_section_type_filter(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', include_all_types=True)
        sql = _get_executed_sql(mock_db)
        assert 'section_type' not in sql

    def test_no_section_type_exclusion_in_params(self, mock_db):
        """include_all_types should not add section type exclusion params."""
        get_sections_for_analysis(jurisdiction='ny', include_all_types=True)
        params = _get_executed_params(mock_db)
        for section_type in EXCLUDED_SECTION_TYPES:
            assert section_type not in params


class TestForceRerun:
    """--force skips the 'already analyzed' filter."""

    def test_exclude_analyzed_by_default(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny')
        sql = _get_executed_sql(mock_db)
        assert 'jenai_analyses' in sql

    def test_include_analyzed_when_not_excluded(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', exclude_analyzed=False)
        sql = _get_executed_sql(mock_db)
        assert 'jenai_analyses' not in sql


class TestTitleFiltering:
    """Title filtering uses correct prefix per state."""

    def test_ny_uses_nycrr_prefix(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', title=18)
        sql = _get_executed_sql(mock_db)
        assert 'nycrr_title' in sql

    def test_nj_uses_njac_prefix(self, mock_db):
        get_sections_for_analysis(jurisdiction='nj', title=3)
        sql = _get_executed_sql(mock_db)
        assert 'njac_title' in sql

    def test_no_title_filter_when_none(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny')
        sql = _get_executed_sql(mock_db)
        assert 'nycrr_title' not in sql
        assert 'njac_title' not in sql


class TestPartFiltering:
    """Part filtering uses correct prefix per state."""

    def test_ny_uses_nycrr_part(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', part='413')
        sql = _get_executed_sql(mock_db)
        assert 'nycrr_part' in sql
        params = _get_executed_params(mock_db)
        assert '413' in params

    def test_nj_uses_njac_part(self, mock_db):
        get_sections_for_analysis(jurisdiction='nj', part='5')
        sql = _get_executed_sql(mock_db)
        assert 'njac_part' in sql

    def test_no_part_filter_when_none(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny')
        sql = _get_executed_sql(mock_db)
        assert 'nycrr_part' not in sql

    def test_title_and_part_together(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', title=18, part='413')
        sql = _get_executed_sql(mock_db)
        assert 'nycrr_title' in sql
        assert 'nycrr_part' in sql


class TestDocumentIdFiltering:
    """--document-id targets specific documents."""

    def test_single_document_id(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', document_ids=[81899])
        sql = _get_executed_sql(mock_db)
        assert 'rd.id IN' in sql
        params = _get_executed_params(mock_db)
        assert 81899 in params

    def test_multiple_document_ids(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny', document_ids=[81899, 78696])
        sql = _get_executed_sql(mock_db)
        assert 'rd.id IN' in sql
        params = _get_executed_params(mock_db)
        assert 81899 in params
        assert 78696 in params

    def test_no_document_id_filter_when_none(self, mock_db):
        get_sections_for_analysis(jurisdiction='ny')
        sql = _get_executed_sql(mock_db)
        assert 'rd.id IN' not in sql
