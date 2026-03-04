"""
Tests for batch query variants and PreFetchedContextData.

Tests:
- get_subchapter_info_batch: single query for multiple subchapter IDs
- get_children_of_parents_batch: single query for multiple parent IDs
- get_definitions_for_scopes_batch: single query for multiple scope IDs
- build_batch_context_for_subchapters: batch version produces correct structure
- PreFetchedContextData: eliminates redundant fetches in build_context_catalog/build_proactive_context
"""

from unittest.mock import Mock, patch, MagicMock

import psycopg
import pytest

from scripts.research_pipeline.models.context import SiblingEntry, AncestorEntry


# =============================================================================
# Helper: mock connection + cursor
# =============================================================================


def _mock_conn_with_rows(rows):
    """Create a mock connection whose cursor returns the given rows."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows
    mock_cursor.fetchone.return_value = rows[0] if rows else None
    mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
    return mock_conn, mock_cursor


# =============================================================================
# get_subchapter_info_batch Tests
# =============================================================================


class TestGetSubchapterInfoBatch:
    """Tests for get_subchapter_info_batch."""

    def test_empty_input_returns_empty(self):
        from scripts.research_pipeline.context.queries import get_subchapter_info_batch
        assert get_subchapter_info_batch([]) == {}

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_returns_info_for_multiple_ids(self, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_subchapter_info_batch

        rows = [
            (100, "10 NYCRR 2.1", "Subchapter Title A", "Short A", "Summary A"),
            (200, "10 NYCRR 3.1", "Subchapter Title B", "Short B", "Summary B"),
        ]
        mock_conn, mock_cursor = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_subchapter_info_batch([100, 200])

        assert len(result) == 2
        assert result[100]["citation"] == "10 NYCRR 2.1"
        assert result[100]["title"] == "Subchapter Title A"
        assert result[200]["citation"] == "10 NYCRR 3.1"

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_fills_defaults_for_missing_ids(self, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_subchapter_info_batch

        # Only return data for ID 100, not 200
        rows = [(100, "10 NYCRR 2.1", "Title", None, None)]
        mock_conn, _ = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_subchapter_info_batch([100, 200])

        assert 200 in result
        assert result[200] == {"id": 200, "citation": "", "title": ""}

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_single_query_executed(self, mock_get_conn):
        """Verifies only one SQL query is executed for the batch."""
        from scripts.research_pipeline.context.queries import get_subchapter_info_batch

        mock_conn, mock_cursor = _mock_conn_with_rows([])
        mock_get_conn.return_value = mock_conn

        get_subchapter_info_batch([1, 2, 3])

        assert mock_cursor.execute.call_count == 1
        sql = mock_cursor.execute.call_args[0][0]
        assert "ANY(%s)" in sql


# =============================================================================
# get_children_of_parents_batch Tests
# =============================================================================


class TestGetChildrenOfParentsBatch:
    """Tests for get_children_of_parents_batch."""

    def test_empty_input_returns_empty(self):
        from scripts.research_pipeline.context.queries import get_children_of_parents_batch
        assert get_children_of_parents_batch([]) == {}

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_returns_children_grouped_by_parent(self, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_children_of_parents_batch

        rows = [
            # (parent_id, id, citation, title, short_title, summary, section_type)
            (100, 101, "10 NYCRR 2.1-1", "Section 1", None, "Summary", ""),
            (100, 102, "10 NYCRR 2.1-2", "Section 2", None, None, ""),
            (200, 201, "10 NYCRR 3.1-1", "Section A", None, None, "exemptions"),
        ]
        mock_conn, _ = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_children_of_parents_batch([100, 200])

        assert len(result[100]) == 2
        assert len(result[200]) == 1
        assert result[100][0].document_id == 101
        assert result[100][1].document_id == 102
        assert result[200][0].document_id == 201

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_empty_parent_returns_empty_list(self, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_children_of_parents_batch

        # No children for parent 300
        rows = [(100, 101, "cit", "title", None, None, "")]
        mock_conn, _ = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_children_of_parents_batch([100, 300])

        assert result[300] == []

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_sibling_entry_flags(self, mock_get_conn):
        """Verifies waiver/exemption flags from section_type and title."""
        from scripts.research_pipeline.context.queries import get_children_of_parents_batch

        rows = [
            (100, 101, "cit1", "Waiver Provisions", None, None, ""),
            (100, 102, "cit2", "Exemptions and Exclusions", None, None, "exemptions"),
            (100, 103, "cit3", "Normal Section", None, None, ""),
        ]
        mock_conn, _ = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_children_of_parents_batch([100])

        assert result[100][0].is_waiver_section is True
        assert result[100][1].is_exemption_section is True
        assert result[100][2].is_waiver_section is False
        assert result[100][2].is_exemption_section is False

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    def test_single_query_executed(self, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_children_of_parents_batch

        mock_conn, mock_cursor = _mock_conn_with_rows([])
        mock_get_conn.return_value = mock_conn

        get_children_of_parents_batch([1, 2, 3])

        assert mock_cursor.execute.call_count == 1
        sql = mock_cursor.execute.call_args[0][0]
        assert "ANY(%s)" in sql


# =============================================================================
# get_definitions_for_scopes_batch Tests
# =============================================================================


class TestGetDefinitionsForScopesBatch:
    """Tests for get_definitions_for_scopes_batch."""

    def test_empty_input_returns_empty(self):
        from scripts.research_pipeline.context.queries import get_definitions_for_scopes_batch
        assert get_definitions_for_scopes_batch([]) == {}

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    @patch("scripts.research_pipeline.context.queries.get_ancestors_batch")
    def test_returns_terms_with_inherited_definitions(self, mock_ancestors, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_definitions_for_scopes_batch

        # Scope 100 has ancestor 50 (chapter) which also has definitions
        mock_ancestors.return_value = {
            100: [{"id": 50, "title": "Chapter", "hierarchy_level": "chapter"}],
            200: [],
        }

        rows = [
            (100, "applicant"),
            (100, "facility"),
            (50, "department"),       # inherited from ancestor
            (200, "licensee"),
        ]
        mock_conn, _ = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_definitions_for_scopes_batch([100, 200])

        # Scope 100 should include its own terms + ancestor's terms
        assert "applicant" in result[100]
        assert "facility" in result[100]
        assert "department" in result[100]  # inherited

        # Scope 200 should only have its own terms
        assert result[200] == ["licensee"]

    @patch("scripts.research_pipeline.context.queries.get_db_connection")
    @patch("scripts.research_pipeline.context.queries.get_ancestors_batch")
    def test_returns_sorted_terms(self, mock_ancestors, mock_get_conn):
        from scripts.research_pipeline.context.queries import get_definitions_for_scopes_batch

        mock_ancestors.return_value = {100: []}
        rows = [
            (100, "zebra"),
            (100, "apple"),
            (100, "mango"),
        ]
        mock_conn, _ = _mock_conn_with_rows(rows)
        mock_get_conn.return_value = mock_conn

        result = get_definitions_for_scopes_batch([100])

        assert result[100] == ["apple", "mango", "zebra"]


# =============================================================================
# build_batch_context_for_subchapters Tests
# =============================================================================


class TestBuildBatchContextForSubchapters:
    """Tests for the plural batch context builder."""

    @patch("scripts.research_pipeline.context.proactive._get_fetch_document_content_batch")
    @patch("scripts.research_pipeline.context.proactive.get_definitions_for_scopes_batch")
    @patch("scripts.research_pipeline.context.proactive.get_children_of_parents_batch")
    @patch("scripts.research_pipeline.context.proactive.get_ancestor_entries_batch")
    @patch("scripts.research_pipeline.context.proactive.get_subchapter_info_batch")
    def test_returns_context_for_all_subchapters(
        self, mock_infos, mock_ancestors, mock_children, mock_defs, mock_fetcher_getter,
    ):
        from scripts.research_pipeline.context.proactive import build_batch_context_for_subchapters

        mock_infos.return_value = {
            10: {"id": 10, "citation": "10 NYCRR 2", "title": "Subchapter A"},
            20: {"id": 20, "citation": "10 NYCRR 3", "title": "Subchapter B"},
        }
        mock_ancestors.return_value = {10: [], 20: []}
        mock_children.return_value = {10: [], 20: []}
        mock_defs.return_value = {10: [], 20: []}

        mock_fetcher = Mock(return_value={})
        mock_fetcher_getter.return_value = mock_fetcher

        result = build_batch_context_for_subchapters([10, 20])

        assert 10 in result
        assert 20 in result
        # Each should have the expected keys
        for sid in [10, 20]:
            assert "subchapter_citation" in result[sid]
            assert "ancestor_summaries" in result[sid]
            assert "sibling_catalog" in result[sid]
            assert "sibling_count" in result[sid]
            assert "sibling_catalog_truncated" in result[sid]
            assert "keyword_sibling_summaries" in result[sid]
            assert "definition_terms" in result[sid]

    @patch("scripts.research_pipeline.context.proactive._get_fetch_document_content_batch")
    @patch("scripts.research_pipeline.context.proactive.get_definitions_for_scopes_batch")
    @patch("scripts.research_pipeline.context.proactive.get_children_of_parents_batch")
    @patch("scripts.research_pipeline.context.proactive.get_ancestor_entries_batch")
    @patch("scripts.research_pipeline.context.proactive.get_subchapter_info_batch")
    def test_sibling_count_reflects_children(
        self, mock_infos, mock_ancestors, mock_children, mock_defs, mock_fetcher_getter,
    ):
        from scripts.research_pipeline.context.proactive import build_batch_context_for_subchapters

        mock_infos.return_value = {
            10: {"id": 10, "citation": "cit", "title": "Title"},
        }
        mock_ancestors.return_value = {10: []}
        mock_children.return_value = {
            10: [
                SiblingEntry(document_id=101, citation="c1", title="Sec 1"),
                SiblingEntry(document_id=102, citation="c2", title="Sec 2"),
                SiblingEntry(document_id=103, citation="c3", title="Sec 3"),
            ],
        }
        mock_defs.return_value = {10: ["term_a", "term_b"]}

        mock_fetcher = Mock(return_value={})
        mock_fetcher_getter.return_value = mock_fetcher

        result = build_batch_context_for_subchapters([10])

        assert result[10]["sibling_count"] == "3"
        assert result[10]["definition_terms"] == "term_a, term_b"

    def test_empty_input_returns_empty(self):
        from scripts.research_pipeline.context.proactive import build_batch_context_for_subchapters
        assert build_batch_context_for_subchapters([]) == {}

    @patch("scripts.research_pipeline.context.proactive._get_fetch_document_content_batch")
    @patch("scripts.research_pipeline.context.proactive.get_definitions_for_scopes_batch")
    @patch("scripts.research_pipeline.context.proactive.get_children_of_parents_batch")
    @patch("scripts.research_pipeline.context.proactive.get_ancestor_entries_batch")
    @patch("scripts.research_pipeline.context.proactive.get_subchapter_info_batch")
    def test_single_content_fetch_for_all_subchapters(
        self, mock_infos, mock_ancestors, mock_children, mock_defs, mock_fetcher_getter,
    ):
        """Verifies fetch_document_content_batch is called once for all subchapters."""
        from scripts.research_pipeline.context.proactive import build_batch_context_for_subchapters

        ancestor_a = AncestorEntry(document_id=50, citation="c50", title="Chapter", hierarchy_level="chapter")
        ancestor_b = AncestorEntry(document_id=60, citation="c60", title="Title", hierarchy_level="title")

        mock_infos.return_value = {
            10: {"id": 10, "citation": "c10", "title": "A"},
            20: {"id": 20, "citation": "c20", "title": "B"},
        }
        mock_ancestors.return_value = {10: [ancestor_a], 20: [ancestor_b]}
        mock_children.return_value = {10: [], 20: []}
        mock_defs.return_value = {10: [], 20: []}

        mock_fetcher = Mock(return_value={})
        mock_fetcher_getter.return_value = mock_fetcher

        build_batch_context_for_subchapters([10, 20])

        # fetch_document_content_batch should be called once (not once per subchapter)
        assert mock_fetcher.call_count == 1
        # Should include ancestor IDs from both subchapters
        fetched_ids = set(mock_fetcher.call_args[0][0])
        assert 50 in fetched_ids
        assert 60 in fetched_ids


# =============================================================================
# PreFetchedContextData Tests
# =============================================================================


class TestPreFetchedContextData:
    """Tests for PreFetchedContextData eliminating redundant fetches."""

    def test_dataclass_defaults_to_empty_dicts(self):
        from scripts.research_pipeline.context.catalog import PreFetchedContextData

        pf = PreFetchedContextData()
        assert pf.raw_ancestors == {}
        assert pf.siblings == {}
        assert pf.crossrefs == {}
        assert pf.definitions == {}
        assert pf.ancestor_entries == {}

    @patch("scripts.research_pipeline.context.catalog.get_ancestor_entries_batch")
    @patch("scripts.research_pipeline.context.catalog.get_definitions_batch")
    @patch("scripts.research_pipeline.context.catalog.get_ancestors_batch")
    @patch("scripts.research_pipeline.context.catalog.get_crossrefs_batch")
    @patch("scripts.research_pipeline.context.catalog.get_sibling_summaries_batch")
    def test_build_context_catalog_skips_queries_when_prefetched(
        self, mock_siblings, mock_crossrefs, mock_ancestors, mock_defs, mock_ancestor_entries,
    ):
        """When pre_fetched is provided, those query functions are NOT called."""
        from scripts.research_pipeline.context.catalog import (
            PreFetchedContextData,
            build_context_catalog,
        )

        doc_ids = [1, 2]
        pf = PreFetchedContextData(
            raw_ancestors={1: [], 2: []},
            siblings={1: [], 2: []},
            crossrefs={1: [], 2: []},
            definitions={1: [], 2: []},
            ancestor_entries={1: [], 2: []},
        )

        result = build_context_catalog(doc_ids, pre_fetched=pf)

        # None of the query functions should be called
        mock_siblings.assert_not_called()
        mock_crossrefs.assert_not_called()
        mock_ancestors.assert_not_called()
        mock_defs.assert_not_called()
        mock_ancestor_entries.assert_not_called()

        # Should still return catalogs for each doc
        assert 1 in result
        assert 2 in result

    @patch("scripts.research_pipeline.context.catalog.get_ancestor_entries_batch")
    @patch("scripts.research_pipeline.context.catalog.get_definitions_batch")
    @patch("scripts.research_pipeline.context.catalog.get_ancestors_batch")
    @patch("scripts.research_pipeline.context.catalog.get_crossrefs_batch")
    @patch("scripts.research_pipeline.context.catalog.get_sibling_summaries_batch")
    def test_build_context_catalog_fetches_when_no_prefetch(
        self, mock_siblings, mock_crossrefs, mock_ancestors, mock_defs, mock_ancestor_entries,
    ):
        """Without pre_fetched, all query functions are called."""
        from scripts.research_pipeline.context.catalog import build_context_catalog

        mock_siblings.return_value = {}
        mock_crossrefs.return_value = {}
        mock_ancestors.return_value = {}
        mock_defs.return_value = {}
        mock_ancestor_entries.return_value = {}

        build_context_catalog([1, 2])

        mock_siblings.assert_called_once()
        mock_crossrefs.assert_called_once()
        mock_ancestors.assert_called_once()

    @patch("scripts.research_pipeline.context.proactive.get_immediate_siblings_batch")
    @patch("scripts.research_pipeline.context.proactive.get_definitions_batch")
    @patch("scripts.research_pipeline.context.proactive.get_ancestor_entries_batch")
    @patch("scripts.research_pipeline.context.proactive.get_ancestors_batch")
    @patch("scripts.research_pipeline.context.proactive.get_crossrefs_batch")
    @patch("scripts.research_pipeline.context.proactive.get_sibling_summaries_batch")
    @patch("scripts.research_pipeline.context.proactive._get_fetch_document_content_batch")
    def test_build_proactive_context_skips_queries_when_prefetched(
        self, mock_fetcher_getter, mock_siblings, mock_crossrefs, mock_ancestors,
        mock_ancestor_entries, mock_defs, mock_immediate,
    ):
        """When pre_fetched is provided, shared queries are skipped."""
        from scripts.research_pipeline.context.catalog import PreFetchedContextData
        from scripts.research_pipeline.context.proactive import build_proactive_context

        mock_fetcher = Mock(return_value={})
        mock_fetcher_getter.return_value = mock_fetcher

        # immediate_siblings is NOT in pre_fetched (it's unique to proactive)
        mock_immediate.return_value = {}

        doc_ids = [1]
        pf = PreFetchedContextData(
            raw_ancestors={1: []},
            siblings={1: []},
            crossrefs={1: []},
            definitions={1: []},
            ancestor_entries={1: []},
        )

        build_proactive_context(doc_ids, pre_fetched=pf)

        # Shared queries should NOT be called
        mock_siblings.assert_not_called()
        mock_crossrefs.assert_not_called()
        mock_ancestors.assert_not_called()
        mock_ancestor_entries.assert_not_called()
        mock_defs.assert_not_called()

        # immediate_siblings is always fetched (not in pre_fetched)
        mock_immediate.assert_called_once()
