"""
Tests for fetch_document_content_batch with guidance routing.

Run with: cd backend && pytest tests/research_pipeline/test_fetchers.py -v
"""

import pytest
from unittest.mock import MagicMock, Mock, patch, call


def _mock_conn_with_side_effects(side_effects):
    """Create a mock connection whose cursor returns different rows per execute call."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.side_effect = side_effects
    mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
    return mock_conn, mock_cursor


class TestFetchDocumentContentBatch:
    """Tests for fetch_document_content_batch with dual-table routing."""

    @patch("scripts.research_pipeline.context.fetchers.get_db_connection")
    def test_both_tables_queried(self, mock_get_conn):
        """Given both document_ids and guidance_document_ids, both tables are queried."""
        from scripts.research_pipeline.context.fetchers import fetch_document_content_batch

        reg_rows = [(1, "reg content", "18 NYCRR 413.2", "Child Care", None, "Summary A")]
        guidance_rows = [(2, "guidance content", "OCFS-ADM-01", "ADM Title", "Summary B")]

        mock_conn, mock_cursor = _mock_conn_with_side_effects([reg_rows, guidance_rows])
        mock_get_conn.return_value = mock_conn

        result = fetch_document_content_batch(document_ids=[1], guidance_document_ids=[2])

        assert 1 in result
        assert result[1]["content"] == "reg content"
        assert result[1]["citation"] == "18 NYCRR 413.2"

        assert 2 in result
        assert result[2]["content"] == "guidance content"
        assert result[2]["citation"] == "OCFS-ADM-01"

        # Both queries executed
        assert mock_cursor.execute.call_count == 2

    @patch("scripts.research_pipeline.context.fetchers.get_db_connection")
    def test_guidance_only(self, mock_get_conn):
        """Given only guidance_document_ids, only guidance table is queried."""
        from scripts.research_pipeline.context.fetchers import fetch_document_content_batch

        guidance_rows = [(5, "guidance text", "GIS-2024-01", "GIS Title", "Summary")]

        mock_conn, mock_cursor = _mock_conn_with_side_effects([guidance_rows])
        mock_get_conn.return_value = mock_conn

        result = fetch_document_content_batch(document_ids=[], guidance_document_ids=[5])

        assert 5 in result
        assert result[5]["content"] == "guidance text"
        # Only guidance query executed (no reg query since document_ids is empty)
        assert mock_cursor.execute.call_count == 1
        executed_sql = mock_cursor.execute.call_args[0][0]
        assert "guidance_documents" in executed_sql

    @patch("scripts.research_pipeline.context.fetchers.get_db_connection")
    def test_regulation_only(self, mock_get_conn):
        """Given guidance_document_ids=None, only regulatory table is queried."""
        from scripts.research_pipeline.context.fetchers import fetch_document_content_batch

        reg_rows = [(10, "reg text", "NJAC 1:1", "Section Title", "Short", "Summary")]

        mock_conn, mock_cursor = _mock_conn_with_side_effects([reg_rows])
        mock_get_conn.return_value = mock_conn

        result = fetch_document_content_batch(document_ids=[10], guidance_document_ids=None)

        assert 10 in result
        assert result[10]["content"] == "reg text"
        assert mock_cursor.execute.call_count == 1
        executed_sql = mock_cursor.execute.call_args[0][0]
        assert "regulatory_documents" in executed_sql

    def test_empty_inputs_returns_empty(self):
        """Given no IDs at all, returns empty dict without DB calls."""
        from scripts.research_pipeline.context.fetchers import fetch_document_content_batch

        result = fetch_document_content_batch(document_ids=[], guidance_document_ids=None)
        assert result == {}
