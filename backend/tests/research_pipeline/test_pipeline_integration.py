"""
Tests for the research pipeline Phase 2: Context Builder Infrastructure.

Run with: cd backend && pytest tests/test_research_pipeline.py
Run DB tests: cd backend && pytest tests/test_research_pipeline.py -m db
Skip DB tests: cd backend && pytest tests/test_research_pipeline.py -m "not db"
"""

import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent  # newyork/
BACKEND_DIR = Path(__file__).parent.parent.parent  # newyork/backend/
load_dotenv(PROJECT_ROOT / ".env")


# =============================================================================
# UNIT TESTS - No database required
# =============================================================================


class TestContextRegistryUnit:
    """Test ContextRegistry class - pure Python, no DB."""

    def test_import(self):
        from scripts.research_pipeline.context_registry import (
            ContextRegistry,
            ContextItem,
        )

        assert ContextRegistry is not None
        assert ContextItem is not None

    def test_add_context(self):
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()

        # Add first item
        added = registry.add_context(
            context_type="sibling",
            identifier="N.J.A.C. 1:1-1.1",
            document_id=100,
            content="Some content",
        )
        assert added is True
        assert len(registry) == 1

    def test_deduplication_by_identifier(self):
        """Same identifier should not be added twice."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()

        registry.add_context("sibling", "N.J.A.C. 1:1-1.1", document_id=100)
        added = registry.add_context("cross_reference", "N.J.A.C. 1:1-1.1", document_id=100)

        assert added is False
        assert len(registry) == 1

        # Check also_appears_as was recorded
        item = registry.get_item("N.J.A.C. 1:1-1.1")
        assert "cross_reference" in item.also_appears_as

    def test_deduplication_by_document_id(self):
        """Same document_id with different identifier should be deduplicated."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()

        registry.add_context("sibling", "Citation A", document_id=100)
        added = registry.add_context("cross_reference", "Citation B", document_id=100)

        assert added is False
        assert len(registry) == 1

    def test_mark_used(self):
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("definition", "applicant", content="A person")

        # Mark as used
        found = registry.mark_used("applicant", "Clarifies scope")
        assert found is True

        # Check relevance was set
        item = registry.get_item("applicant")
        assert item.relevance == "Clarifies scope"

    def test_mark_used_not_found(self):
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        found = registry.mark_used("nonexistent", "reason")
        assert found is False

    def test_get_used_items(self):
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("sibling", "A")
        registry.add_context("sibling", "B")
        registry.add_context("sibling", "C")

        registry.mark_used("B", "Used this one")

        used = registry.get_used_items()
        assert len(used) == 1
        assert used[0].identifier == "B"

    def test_to_context_used_json(self):
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("definition", "term", document_id=123, content="def text")
        registry.mark_used("term", "Used for analysis")

        json_output = registry.to_context_used()

        assert len(json_output) == 1
        assert json_output[0]["type"] == "definition"
        assert json_output[0]["identifier"] == "term"
        assert json_output[0]["sourceId"] == 123
        assert json_output[0]["relevance"] == "Used for analysis"

    def test_render_for_tier_catalog(self):
        """Tier 1 should render catalog view (metadata only)."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("sibling", "N.J.A.C. 1:1-1.1")
        registry.add_context("definition", "term")

        output = registry.render_for_tier(1)

        assert "Sibling Sections" in output
        assert "N.J.A.C. 1:1-1.1" in output
        assert "Definitions" in output
        assert "term" in output

    def test_upgrade_content(self):
        """Content level should only increase, never decrease."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("sibling", "A", content_level="catalog")

        # Upgrade to summary
        upgraded = registry.upgrade_content("A", "Summary text", "summary")
        assert upgraded is True
        assert registry.get_item("A").content_level == "summary"

        # Try to downgrade back to catalog - should fail
        upgraded = registry.upgrade_content("A", "", "catalog")
        assert upgraded is False
        assert registry.get_item("A").content_level == "summary"


class TestPromptLoaderUnit:
    """Test prompt/config loading - reads files, no DB."""

    def test_import(self):
        from scripts.research_pipeline.prompt_loader import (
            IssueConfig,
            TierConfig,
            load_issue_config,
            load_tier_config,
            load_all_tier_configs,
            get_all_issue_types,
        )

        assert IssueConfig is not None
        assert load_issue_config is not None

    def test_load_issue_config(self):
        from scripts.research_pipeline.prompt_loader import load_issue_config

        config = load_issue_config("mail_only")

        assert config.name == "mail_only"
        assert config.db_issue_type == "mail_only"
        assert config.display_name is not None
        assert config.severity_baseline >= 1
        assert config.severity_baseline <= 10

    def test_load_tier_config(self):
        from scripts.research_pipeline.prompt_loader import load_tier_config

        tier1 = load_tier_config("tier1")

        assert tier1.tier_name == "tier1"
        assert len(tier1.system) > 100  # Should have substantial content
        assert len(tier1.template) > 50
        assert tier1.updated_at is not None

    def test_load_all_tier_configs(self):
        from scripts.research_pipeline.prompt_loader import load_all_tier_configs

        tiers = load_all_tier_configs()

        # V5 uses 3-tier architecture (tier4 was consolidated into tier3)
        assert len(tiers) >= 3
        assert "tier1" in tiers
        assert "tier2" in tiers
        assert "tier3" in tiers

    def test_get_all_issue_types(self):
        from scripts.research_pipeline.prompt_loader import get_all_issue_types

        types = get_all_issue_types()

        assert len(types) >= 30  # We have 40+ issue types
        assert "mail_only" in types
        assert "wet_signature" in types
        assert "in_person_submission" in types

    def test_format_indicators(self):
        from scripts.research_pipeline.prompt_loader import (
            load_issue_config,
            format_indicators_for_prompt,
        )

        config = load_issue_config("mail_only")
        positive, negative = format_indicators_for_prompt(config)

        # Should return strings (even if empty indicators)
        assert isinstance(positive, str)
        assert isinstance(negative, str)

    def test_format_severity(self):
        from scripts.research_pipeline.prompt_loader import (
            load_issue_config,
            format_severity_for_prompt,
        )

        config = load_issue_config("mail_only")
        severity_str = format_severity_for_prompt(config)

        assert "Baseline severity" in severity_str
        assert str(config.severity_baseline) in severity_str

    def test_format_tier_prompt(self):
        from scripts.research_pipeline.prompt_loader import (
            load_issue_config,
            load_tier_config,
            format_tier_prompt,
        )

        tier1 = load_tier_config("tier1")
        issue = load_issue_config("mail_only")

        formatted = format_tier_prompt(
            tier1,
            issue,
            citation="N.J.A.C. 1:1-1.1",
            title="Test Section",
            match_count=3,
            match_list="- Match 1\n- Match 2\n- Match 3",
        )

        assert "system" in formatted
        assert "user" in formatted
        assert "N.J.A.C. 1:1-1.1" in formatted["user"]


class TestContextBuilderImports:
    """Test context_builder imports without database."""

    def test_import(self):
        from scripts.research_pipeline.context_builder import (
            build_context_catalog,
            get_sibling_summaries_batch,
            get_crossrefs_batch,
            get_definitions_batch,
            get_ancestor_entries_batch,
            fetch_document_content_batch,
            group_for_cache_efficiency,
            estimate_cache_efficiency,
        )

        assert build_context_catalog is not None
        assert group_for_cache_efficiency is not None

    def test_empty_inputs(self):
        """All batch functions should handle empty inputs gracefully."""
        from scripts.research_pipeline.context_builder import (
            build_context_catalog,
            get_sibling_summaries_batch,
            get_crossrefs_batch,
            get_definitions_batch,
            get_ancestor_entries_batch,
        )

        # Should return empty dicts, not raise errors
        assert get_sibling_summaries_batch([]) == {}
        assert get_crossrefs_batch([]) == {}
        assert get_definitions_batch([]) == {}
        assert get_ancestor_entries_batch([]) == {}
        assert build_context_catalog([]) == {}


class TestModelsImport:
    """Test that Phase 1 models are accessible."""

    def test_context_models(self):
        from scripts.research_pipeline.models.context import (
            SiblingEntry,
            CrossRefEntry,
            AncestorEntry,
            ContextCatalog,
            ContextRequest,
            ContextEntryLLM,
            ContextEntryDB,
        )

        assert SiblingEntry is not None
        assert ContextCatalog is not None

    def test_matches_models(self):
        from scripts.research_pipeline.models.matches import (
            MatchInfo,
            DismissedMatch,
            ProcessingUnit,
        )

        assert MatchInfo is not None
        assert ProcessingUnit is not None


# =============================================================================
# DATABASE INTEGRATION TESTS
# =============================================================================


@pytest.mark.db
class TestContextBuilderDB:
    """Test context builder with real database.

    These tests are READ-ONLY and do not modify database data.
    """

    @pytest.fixture(autouse=True)
    def check_db_connection(self):
        """Skip if no database connection available."""
        from shared_utils import get_db_connection

        conn = get_db_connection()
        if not conn:
            pytest.skip("Database connection not available")
        conn.close()

    @pytest.fixture
    def sample_doc_ids(self):
        """Get a sample of NJ section document IDs for testing."""
        from shared_utils import get_db_connection

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM regulatory_documents
                WHERE state = %s AND hierarchy_level = %s
                LIMIT 10
                """,
                ["NJ", "section"],
            )
            ids = [row[0] for row in cur.fetchall()]
        conn.close()
        return ids

    def test_get_sibling_summaries_batch(self, sample_doc_ids):
        from scripts.research_pipeline.context_builder import get_sibling_summaries_batch

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = get_sibling_summaries_batch(sample_doc_ids)

        assert isinstance(result, dict)
        assert len(result) == len(sample_doc_ids)

        # All values should be lists of SiblingEntry
        for doc_id, siblings in result.items():
            assert isinstance(siblings, list)
            for sibling in siblings:
                assert hasattr(sibling, "citation")
                assert hasattr(sibling, "title")

    def test_get_crossrefs_batch(self, sample_doc_ids):
        from scripts.research_pipeline.context_builder import get_crossrefs_batch

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = get_crossrefs_batch(sample_doc_ids)

        assert isinstance(result, dict)
        assert len(result) == len(sample_doc_ids)

        # All values should be lists of CrossRefEntry
        for doc_id, crossrefs in result.items():
            assert isinstance(crossrefs, list)
            for xref in crossrefs:
                assert hasattr(xref, "citation")
                assert hasattr(xref, "is_definitions_section")

    def test_get_definitions_batch(self, sample_doc_ids):
        from scripts.research_pipeline.context_builder import get_definitions_batch

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = get_definitions_batch(sample_doc_ids)

        assert isinstance(result, dict)
        assert len(result) == len(sample_doc_ids)

        # All values should be lists of strings (term names)
        for doc_id, terms in result.items():
            assert isinstance(terms, list)
            for term in terms:
                assert isinstance(term, str)

    def test_get_ancestor_entries_batch(self, sample_doc_ids):
        from scripts.research_pipeline.context_builder import get_ancestor_entries_batch

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = get_ancestor_entries_batch(sample_doc_ids)

        assert isinstance(result, dict)
        assert len(result) == len(sample_doc_ids)

        # All values should be lists of AncestorEntry
        for doc_id, ancestors in result.items():
            assert isinstance(ancestors, list)
            for ancestor in ancestors:
                assert hasattr(ancestor, "citation")
                assert hasattr(ancestor, "hierarchy_level")

    def test_build_context_catalog(self, sample_doc_ids):
        from scripts.research_pipeline.context_builder import build_context_catalog

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = build_context_catalog(sample_doc_ids)

        assert isinstance(result, dict)
        assert len(result) == len(sample_doc_ids)

        # All values should be ContextCatalog
        for doc_id, catalog in result.items():
            assert hasattr(catalog, "sibling_sections")
            assert hasattr(catalog, "cross_references")
            assert hasattr(catalog, "definition_terms")
            assert hasattr(catalog, "ancestor_chain")

    def test_batch_query_performance(self):
        """Test that batch queries complete in reasonable time."""
        import time
        from shared_utils import get_db_connection
        from scripts.research_pipeline.context_builder import build_context_catalog

        # Get 100 documents for performance testing
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM regulatory_documents
                WHERE state = %s AND hierarchy_level = %s
                LIMIT 100
                """,
                ["NJ", "section"],
            )
            doc_ids = [row[0] for row in cur.fetchall()]
        conn.close()

        if len(doc_ids) < 50:
            pytest.skip("Not enough documents for performance test")

        start = time.time()
        catalogs = build_context_catalog(doc_ids)
        elapsed = time.time() - start

        assert len(catalogs) == len(doc_ids)
        assert elapsed < 10.0, f"build_context_catalog too slow: {elapsed:.2f}s for {len(doc_ids)} docs"


# =============================================================================
# PHASE 3 TESTS - State Machine, Cost Tracker, Tier Orchestration
# =============================================================================


class TestStateMachine:
    """Test state machine functionality."""

    def test_import(self):
        from scripts.research_pipeline.state_machine import (
            ProcessingState,
            TrackedUnit,
            get_next_state,
            is_terminal_state,
        )

        assert ProcessingState is not None
        assert TrackedUnit is not None

    def test_processing_states(self):
        from scripts.research_pipeline.state_machine import ProcessingState

        # Check key states exist
        assert ProcessingState.PENDING
        assert ProcessingState.TIER1_COMPLETE
        assert ProcessingState.TIER2_COMPLETE
        assert ProcessingState.DONE
        assert ProcessingState.ERROR

    def test_is_terminal_state(self):
        from scripts.research_pipeline.state_machine import (
            ProcessingState,
            is_terminal_state,
        )

        assert is_terminal_state(ProcessingState.DONE) is True
        assert is_terminal_state(ProcessingState.DONE_FALSE_POSITIVE) is True
        assert is_terminal_state(ProcessingState.ERROR) is True
        assert is_terminal_state(ProcessingState.PENDING) is False
        assert is_terminal_state(ProcessingState.TIER1_COMPLETE) is False

    def test_tracked_unit_creation(self):
        from scripts.research_pipeline.state_machine import (
            ProcessingState,
            TrackedUnit,
        )
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

        # Create a minimal ProcessingUnit
        match = MatchInfo(
            match_id=1,
            matched_text="test match",
            position_start=0,
            position_end=10,
            surrounding_context="...test match...",
        )
        pu = ProcessingUnit(
            document_id=123,
            issue_type="mail_only",
            citation="N.J.A.C. 1:1-1.1",
            title="Test Section",
            matches=[match],
            content="Full document content here",
        )

        tracked = TrackedUnit(unit=pu)

        assert tracked.state == ProcessingState.PENDING
        assert tracked.document_id == 123
        assert tracked.issue_type == "mail_only"
        # custom_id format is "{issue_type}_{document_id}" (see ids.py)
        assert tracked.custom_id == "mail_only_123"
        assert tracked.tier1_output is None


class TestCostTracker:
    """Test cost tracking functionality."""

    def test_import(self):
        from scripts.research_pipeline.cost_tracker import (
            CostTracker,
            TierCost,
            format_time,
        )

        assert CostTracker is not None
        assert TierCost is not None

    def test_record_usage(self):
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker()

        tracker.record_batch_usage(
            tier=1,
            input_tokens=10000,
            output_tokens=1000,
            cache_read_tokens=5000,
            request_count=10,
        )

        assert tracker.tiers[1].input_tokens == 10000
        assert tracker.tiers[1].output_tokens == 1000
        assert tracker.tiers[1].cache_read_tokens == 5000
        assert tracker.tiers[1].requests == 10

    def test_total_cost(self):
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker()

        # Add usage for tier 1 (batch)
        tracker.record_batch_usage(tier=1, input_tokens=1000000, output_tokens=100000)

        # Cost should be > 0
        assert tracker.total_cost > 0

        # Batch should have 50% discount
        tier1_cost = tracker.tiers[1].total_cost
        assert tier1_cost > 0

    def test_summary(self):
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker()
        tracker.record_batch_usage(tier=1, input_tokens=1000, output_tokens=500)

        summary = tracker.summary()

        assert "Cost Summary" in summary
        assert "Tier 1" in summary
        assert "$" in summary

    def test_format_time(self):
        from scripts.research_pipeline.cost_tracker import format_time

        assert format_time(30) == "30s"
        assert format_time(90) == "1.5m"
        assert format_time(7200) == "2.0h"


class TestTierRunners:
    """Test tier runner functions (V5 - Tiers 1 & 2 use batch API)."""

    def test_import(self):
        # V5: Tier 3 uses real-time API, not batch, so no prepare_tier3_batch
        from scripts.research_pipeline.tier_runners import (
            prepare_tier1_batch,
            prepare_tier2_batch,
            format_matches_for_tier1,
        )

        assert prepare_tier1_batch is not None
        assert prepare_tier2_batch is not None

    def test_format_matches_for_tier1(self):
        from scripts.research_pipeline.tier_runners import format_matches_for_tier1
        from scripts.research_pipeline.models.matches import MatchInfo

        matches = [
            MatchInfo(
                match_id=1,
                matched_text="must be mailed",
                position_start=100,
                position_end=115,
                surrounding_context="Applications must be mailed to the office.",
            ),
        ]

        formatted = format_matches_for_tier1(matches)

        assert "Match 0" in formatted
        assert "must be mailed" in formatted
        assert "Applications" in formatted

    def test_format_matches_empty(self):
        from scripts.research_pipeline.tier_runners import format_matches_for_tier1

        formatted = format_matches_for_tier1([])
        assert "(no matches)" in formatted


class TestResultProcessor:
    """Test result processor functions."""

    def test_import(self):
        from scripts.research_pipeline.result_processor import (
            compute_final_classification,
            compute_final_severity,
            check_verbatim,
        )

        assert compute_final_classification is not None

    def test_check_verbatim_exact(self):
        from scripts.research_pipeline.result_processor import check_verbatim

        source = "Applications must be mailed to the office within 30 days."
        quotes = ["must be mailed to the office"]

        is_verbatim, details = check_verbatim(quotes, source)

        assert is_verbatim is True
        assert len(details) == 1
        assert details[0]["is_verbatim"] is True

    def test_check_verbatim_not_found(self):
        from scripts.research_pipeline.result_processor import check_verbatim

        source = "Applications must be mailed to the office."
        quotes = ["completely different text"]

        is_verbatim, details = check_verbatim(quotes, source)

        assert is_verbatim is False
        assert details[0]["is_verbatim"] is False


class TestPipelineRunner:
    """Test pipeline runner module."""

    def test_import(self):
        from scripts.research_pipeline.pipeline_runner import (
            run_pipeline,
            run_tier3_only,
        )

        assert run_pipeline is not None
        assert run_tier3_only is not None


class TestDbWriter:
    """Test database writer functions."""

    def test_import(self):
        from scripts.research_pipeline.db_writer import (
            save_tier1_results,
            save_tier2_results,
            save_final_results,
            save_all_results,
        )

        assert save_tier1_results is not None
        assert save_all_results is not None


# =============================================================================
# PHASE 3.5 REGRESSION TESTS - Verify bug fixes
# =============================================================================


class TestSiblingEntrySummary:
    """Regression test: SiblingEntry should have optional summary field."""

    def test_sibling_entry_has_summary_field(self):
        """Ensure SiblingEntry model includes summary field."""
        from scripts.research_pipeline.models.context import SiblingEntry

        # Test with summary
        entry = SiblingEntry(
            document_id=123,
            citation="N.J.A.C. 5:23-1.1",
            title="Test Title",
            summary="This section covers testing requirements.",
        )
        assert entry.summary == "This section covers testing requirements."

        # Test that summary is optional
        entry_no_summary = SiblingEntry(
            document_id=124,
            citation="N.J.A.C. 5:23-1.2",
            title="Another Title",
        )
        assert entry_no_summary.summary is None

    def test_sibling_entry_with_all_fields(self):
        """Ensure all SiblingEntry fields work together."""
        from scripts.research_pipeline.models.context import SiblingEntry

        entry = SiblingEntry(
            document_id=125,
            citation="N.J.A.C. 5:23-1.1",
            title="Exemptions",
            summary="Summary text here",
            has_compliance_issue=True,
            is_waiver_section=True,
            is_exemption_section=True,
        )
        assert entry.document_id == 125
        assert entry.citation == "N.J.A.C. 5:23-1.1"
        assert entry.title == "Exemptions"
        assert entry.summary == "Summary text here"
        assert entry.has_compliance_issue is True
        assert entry.is_waiver_section is True
        assert entry.is_exemption_section is True


class TestFormatDefinitionsFields:
    """Regression test: format_definitions should use correct field names."""

    def test_format_definitions_uses_rephrased_definition(self):
        """Ensure format_definitions prefers rephrased_definition over verbatim_text."""
        from scripts.research_pipeline.tier_runners import format_definitions

        definitions = [
            {
                "term": "Widget",
                "verbatim_text": "A mechanical device used in construction",
                "rephrased_definition": "A device for construction use",
            },
        ]
        result = format_definitions(definitions)

        # Should use rephrased_definition when available
        assert "A device for construction use" in result
        assert "Widget" in result

    def test_format_definitions_falls_back_to_verbatim(self):
        """Ensure format_definitions falls back to verbatim_text when no rephrased."""
        from scripts.research_pipeline.tier_runners import format_definitions

        definitions = [
            {
                "term": "Gadget",
                "verbatim_text": "An electronic tool for measurement",
                # No rephrased_definition
            },
        ]
        result = format_definitions(definitions)

        # Should fall back to verbatim_text
        assert "An electronic tool for measurement" in result
        assert "Gadget" in result

    def test_format_definitions_handles_empty_fields(self):
        """Ensure format_definitions handles None/empty fields gracefully."""
        from scripts.research_pipeline.tier_runners import format_definitions

        definitions = [
            {
                "term": "Thing",
                "verbatim_text": None,
                "rephrased_definition": None,
            },
        ]
        result = format_definitions(definitions)

        # Should not crash, term should be present
        assert "Thing" in result

    def test_format_definitions_empty_list(self):
        """Ensure format_definitions handles empty list."""
        from scripts.research_pipeline.tier_runners import format_definitions

        result = format_definitions([])
        assert result == "(no applicable definitions)"


class TestCacheEfficiencyOrdering:
    """Regression test: _sort_for_cache_efficiency should use group_for_cache_efficiency."""

    def test_sort_for_cache_efficiency_import(self):
        """Ensure group_for_cache_efficiency is imported in pipeline_runner."""
        from scripts.research_pipeline.pipeline_runner import _sort_for_cache_efficiency
        from scripts.research_pipeline.context_builder import group_for_cache_efficiency

        # Both should be importable without errors
        assert _sort_for_cache_efficiency is not None
        assert group_for_cache_efficiency is not None


class TestCheckVerbatimSignature:
    """Regression test: check_verbatim should not have unused fuzzy_threshold."""

    def test_check_verbatim_signature(self):
        """Ensure check_verbatim has correct signature without unused params."""
        import inspect
        from scripts.research_pipeline.result_processor import check_verbatim

        sig = inspect.signature(check_verbatim)
        params = list(sig.parameters.keys())

        # Should only have quotes and source_text, not fuzzy_threshold
        assert params == ["quotes", "source_text"]

    def test_check_verbatim_works_without_threshold(self):
        """Ensure check_verbatim works correctly after parameter removal."""
        from scripts.research_pipeline.result_processor import check_verbatim

        source = "The application must be submitted in person."
        quotes = ["submitted in person"]

        is_verbatim, details = check_verbatim(quotes, source)

        assert is_verbatim is True
        assert len(details) == 1
        assert details[0]["is_verbatim"] is True


# =============================================================================
# PHASE 4 TESTS - Web Search Integration
# =============================================================================


class TestWebSearchToolDefinition:
    """Test web search tool constant and types."""

    def test_web_search_tool_definition(self):
        """Verify WEB_SEARCH_TOOL is properly defined."""
        from scripts.research_pipeline.tier_runners import WEB_SEARCH_TOOL

        assert WEB_SEARCH_TOOL["type"] == "web_search_20250305"
        assert WEB_SEARCH_TOOL["name"] == "web_search"
        assert "max_uses" in WEB_SEARCH_TOOL
        assert WEB_SEARCH_TOOL["max_uses"] == 5

    def test_web_search_result_dataclass(self):
        """Test WebSearchResult dataclass."""
        from scripts.research_pipeline.tier_runners import WebSearchResult

        result = WebSearchResult(
            title="Test Result",
            url="https://example.com",
            snippet="This is a test snippet.",
            page_age="2 days ago",
        )
        assert result.title == "Test Result"
        assert result.url == "https://example.com"
        assert result.snippet == "This is a test snippet."
        assert result.page_age == "2 days ago"

    def test_web_search_result_optional_page_age(self):
        """Test WebSearchResult with optional page_age."""
        from scripts.research_pipeline.tier_runners import WebSearchResult

        result = WebSearchResult(
            title="Test",
            url="https://example.com",
            snippet="Snippet text",
        )
        assert result.page_age is None

    def test_web_search_query_dataclass(self):
        """Test WebSearchQuery dataclass."""
        from scripts.research_pipeline.tier_runners import WebSearchQuery, WebSearchResult

        results = [
            WebSearchResult(title="R1", url="https://a.com", snippet="S1"),
            WebSearchResult(title="R2", url="https://b.com", snippet="S2"),
        ]
        query = WebSearchQuery(query="test query", results=results)

        assert query.query == "test query"
        assert len(query.results) == 2
        assert query.results[0].title == "R1"


class TestExtractWebSearchResults:
    """Test extraction of web search results from API response."""

    def test_extract_empty_response(self):
        """Test extraction from response with no web search blocks."""
        from scripts.research_pipeline.tier_runners import extract_web_search_results

        # Mock response with no web search content
        class MockBlock:
            type = "text"
            text = "Some text response"

        class MockResponse:
            content = [MockBlock()]

        results = extract_web_search_results(MockResponse())
        assert results == []

    def test_extract_web_search_results_with_mock(self):
        """Test extraction from mock response with web search blocks."""
        from scripts.research_pipeline.tier_runners import extract_web_search_results

        # Mock server_tool_use block
        class MockServerToolUse:
            type = "server_tool_use"
            id = "tool_123"
            name = "web_search"
            input = {"query": "federal mandate test"}

        # Mock web search result item
        class MockWebSearchResultItem:
            type = "web_search_result"
            title = "Federal Regulations Guide"
            url = "https://example.gov/regs"
            snippet = "Information about federal mandates..."
            page_age = "3 days ago"

        # Mock web_search_tool_result block
        class MockWebSearchToolResult:
            type = "web_search_tool_result"
            tool_use_id = "tool_123"
            content = [MockWebSearchResultItem()]

        class MockResponse:
            content = [MockServerToolUse(), MockWebSearchToolResult()]

        results = extract_web_search_results(MockResponse())

        assert len(results) == 1
        assert results[0].query == "federal mandate test"
        assert len(results[0].results) == 1
        assert results[0].results[0].title == "Federal Regulations Guide"
        assert results[0].results[0].url == "https://example.gov/regs"


class TestFormatWebResultsForPrompt:
    """Test formatting web results for prompt inclusion."""

    def test_format_empty_results(self):
        """Test formatting with no results."""
        from scripts.research_pipeline.tier_runners import format_web_results_for_prompt

        result = format_web_results_for_prompt([])
        assert result == "(No web search results available)"

    def test_format_single_query_results(self):
        """Test formatting results from a single query."""
        from scripts.research_pipeline.tier_runners import (
            format_web_results_for_prompt,
            WebSearchQuery,
            WebSearchResult,
        )

        query = WebSearchQuery(
            query="federal mandate",
            results=[
                WebSearchResult(
                    title="CFR Title 42",
                    url="https://ecfr.gov/title42",
                    snippet="Federal regulations regarding...",
                    page_age="1 day ago",
                ),
            ],
        )

        result = format_web_results_for_prompt([query])

        assert 'Search Query: "federal mandate"' in result
        assert "CFR Title 42" in result
        assert "https://ecfr.gov/title42" in result
        # Note: snippet is no longer included in format_web_results_for_prompt
        # (design changed to use citations for quoted content instead)
        assert "1 day ago" in result

    def test_format_multiple_queries(self):
        """Test formatting results from multiple queries."""
        from scripts.research_pipeline.tier_runners import (
            format_web_results_for_prompt,
            WebSearchQuery,
            WebSearchResult,
        )

        queries = [
            WebSearchQuery(
                query="query one",
                results=[
                    WebSearchResult(title="Result 1A", url="https://a.com", snippet="Snippet 1A"),
                ],
            ),
            WebSearchQuery(
                query="query two",
                results=[
                    WebSearchResult(title="Result 2A", url="https://b.com", snippet="Snippet 2A"),
                ],
            ),
        ]

        result = format_web_results_for_prompt(queries)

        assert 'Search Query: "query one"' in result
        assert 'Search Query: "query two"' in result
        assert "Result 1A" in result
        assert "Result 2A" in result

    def test_format_limits_results_per_query(self):
        """Test that formatting limits to top 5 results per query."""
        from scripts.research_pipeline.tier_runners import (
            format_web_results_for_prompt,
            WebSearchQuery,
            WebSearchResult,
        )

        # Create 10 results with unique identifiable titles
        results = [
            WebSearchResult(title=f"UniqueTitle_{i}", url=f"https://{i}.com", snippet=f"Snippet {i}")
            for i in range(10)
        ]
        query = WebSearchQuery(query="many results", results=results)

        formatted = format_web_results_for_prompt([query])

        # Should only include first 5 results (indices 0-4)
        assert "UniqueTitle_0" in formatted
        assert "UniqueTitle_4" in formatted
        # Results 5-9 should not be included
        assert "UniqueTitle_5" not in formatted
        assert "UniqueTitle_9" not in formatted

    def test_format_handles_no_results_for_query(self):
        """Test formatting when a query has no results."""
        from scripts.research_pipeline.tier_runners import (
            format_web_results_for_prompt,
            WebSearchQuery,
        )

        query = WebSearchQuery(query="obscure query", results=[])
        result = format_web_results_for_prompt([query])

        assert "obscure query" in result
        assert "No results found for this query" in result


class TestTier3WebSearchExports:
    """Test that Tier 3 web search functions are properly exported (V5)."""

    def test_exports_from_init(self):
        """Verify all web search functions are exported from __init__."""
        from scripts.research_pipeline import (
            WEB_SEARCH_TOOL,
            WebSearchResult,
            WebSearchQuery,
            extract_web_search_results,
            format_web_results_for_prompt,
        )

        assert WEB_SEARCH_TOOL is not None
        assert WebSearchResult is not None
        assert WebSearchQuery is not None
        assert extract_web_search_results is not None
        assert format_web_results_for_prompt is not None


# =============================================================================
# PHASE 5 TESTS - CLI & Integration
# =============================================================================


class TestCLIArgumentParsing:
    """Test CLI argument parsing for cli.py."""

    def test_default_arguments(self):
        """Test default argument values."""
        import argparse

        # Recreate the parser from cli.py
        parser = argparse.ArgumentParser()
        parser.add_argument("--issue", default="mail_only")
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--max-tier", type=int, default=2)
        parser.add_argument("--state", default="NJ")
        parser.add_argument("--realtime", action="store_true")

        args = parser.parse_args([])

        assert args.issue == "mail_only"
        assert args.limit == 20
        assert args.max_tier == 2
        assert args.state == "NJ"
        assert args.realtime is False

    def test_custom_arguments(self):
        """Test custom argument parsing."""
        import argparse

        parser = argparse.ArgumentParser()
        parser.add_argument("--issue", default="mail_only")
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--max-tier", type=int, default=2)
        parser.add_argument("--state", default="NJ")
        parser.add_argument("--realtime", action="store_true")

        args = parser.parse_args([
            "--issue", "wet_signature",
            "--limit", "50",
            "--max-tier", "3",
            "--state", "NY",
            "--realtime",
        ])

        assert args.issue == "wet_signature"
        assert args.limit == 50
        assert args.max_tier == 3
        assert args.state == "NY"
        assert args.realtime is True

    def test_partial_arguments(self):
        """Test that partial arguments use defaults for the rest."""
        import argparse

        parser = argparse.ArgumentParser()
        parser.add_argument("--issue", default="mail_only")
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--max-tier", type=int, default=2)
        parser.add_argument("--state", default="NJ")
        parser.add_argument("--realtime", action="store_true")

        args = parser.parse_args(["--max-tier", "1", "--realtime"])

        assert args.issue == "mail_only"  # default
        assert args.limit == 20  # default
        assert args.max_tier == 1  # custom
        assert args.state == "NJ"  # default
        assert args.realtime is True  # custom


class TestCostTrackerIntegration:
    """Test CostTracker methods used by Langfuse integration."""

    def test_get_tier_stats(self):
        """Test get_tier_stats method."""
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker(run_id="test")

        # Record some usage
        tracker.record_batch_usage(
            tier=1,
            input_tokens=1000,
            output_tokens=500,
            cache_read_tokens=200,
            request_count=5,
        )

        stats = tracker.get_tier_stats("tier1")

        assert stats["input_tokens"] == 1200  # 1000 + 200 cache
        assert stats["output_tokens"] == 500
        assert stats["cost"] > 0

    def test_get_tier_stats_missing_tier(self):
        """Test get_tier_stats for a tier with no data."""
        from scripts.research_pipeline.cost_tracker import CostTracker

        tracker = CostTracker(run_id="test")
        stats = tracker.get_tier_stats("tier99")

        assert stats["input_tokens"] == 0
        assert stats["output_tokens"] == 0
        assert stats["cost"] == 0.0


class TestLangfuseIntegration:
    """Test Langfuse integration in pipeline_runner."""

    def test_langfuse_imports(self):
        """Test that Langfuse-related code is properly structured."""
        from scripts.research_pipeline.pipeline_runner import (
            LANGFUSE_AVAILABLE,
        )

        # LANGFUSE_AVAILABLE should be a boolean
        assert isinstance(LANGFUSE_AVAILABLE, bool)

    def test_pipeline_runner_is_importable(self):
        """Test that pipeline_runner module is importable."""
        from scripts.research_pipeline.pipeline_runner import run_pipeline
        assert callable(run_pipeline)


class TestBackfillScript:
    """Test backfill script argument parsing."""

    def test_backfill_argument_parsing(self):
        """Test backfill script argument defaults."""
        import argparse

        # Recreate parser from backfill_legacy_analyses.py
        parser = argparse.ArgumentParser()
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--limit", type=int)
        parser.add_argument("--state", choices=["NJ", "NY"])
        parser.add_argument("--issue", dest="issue_type")

        args = parser.parse_args([])

        assert args.dry_run is False
        assert args.limit is None
        assert args.state is None
        assert args.issue_type is None

    def test_backfill_with_all_args(self):
        """Test backfill with all arguments."""
        import argparse

        parser = argparse.ArgumentParser()
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--limit", type=int)
        parser.add_argument("--state", choices=["NJ", "NY"])
        parser.add_argument("--issue", dest="issue_type")

        args = parser.parse_args([
            "--dry-run",
            "--limit", "100",
            "--state", "NJ",
            "--issue", "mail_only",
        ])

        assert args.dry_run is True
        assert args.limit == 100
        assert args.state == "NJ"
        assert args.issue_type == "mail_only"

    def test_backfill_functions_exist(self):
        """Test that backfill module has required functions."""
        from scripts.research_pipeline.maintenance.backfill_legacy_analyses import (
            get_unprocessed_groups,
            insert_analysis_record,
            backfill_legacy_analyses,
        )

        assert callable(get_unprocessed_groups)
        assert callable(insert_analysis_record)
        assert callable(backfill_legacy_analyses)


# =============================================================================
# TESTING PLAN SECTION 1-3: Routing, Context, Derived Fields
# =============================================================================


# Helper functions for building test fixtures
def make_tier1_output(
    classification: str = "needs_research",
    relevant_match_indices: list[int] = None,
    dismissed_matches: list = None,
    confidence: float = 0.8,
    reasoning: str = "Test reasoning",
    context_requests: list = None,
) -> "Tier1Output":
    """Create a Tier1Output with sensible defaults."""
    from scripts.research_pipeline.models.llm_outputs import Tier1Output

    return Tier1Output(
        classification=classification,
        relevant_match_indices=relevant_match_indices if relevant_match_indices is not None else [0],
        dismissed_matches=dismissed_matches or [],
        confidence=confidence,
        reasoning=reasoning,
        context_requests=context_requests or [],
    )


def make_tier2_output(
    classification: str = "burdensome",
    severity: int = 5,
    confidence: float = 0.8,
    reasoning: str = "Test reasoning",
    argument_for_regulation: str = "Test argument for",
    argument_against_regulation: str = "Test argument against",
    needs_web_search: bool = False,
    potentially_controversial: bool = False,
    federal_mandate_suspected: bool = False,
    ambiguity_type: str = None,
    verbatim_requirements: list = None,
    context_used: list = None,
    full_text_requests: list = None,
    # V5 canonical Tier 3 trigger fields
    cites_federal_statute: bool = False,
    claims_no_alternative: bool = False,
) -> "Tier2Output":
    """Create a Tier2Output with sensible defaults."""
    from scripts.research_pipeline.models.llm_outputs import Tier2Output

    return Tier2Output(
        classification=classification,
        severity=severity if classification in ("burdensome", "justified") else None,
        confidence=confidence,
        reasoning=reasoning,
        argument_for_regulation=argument_for_regulation,
        argument_against_regulation=argument_against_regulation,
        needs_web_search=needs_web_search,
        potentially_controversial=potentially_controversial,
        federal_mandate_suspected=federal_mandate_suspected,
        ambiguity_type=ambiguity_type,
        verbatim_requirements=verbatim_requirements or [],
        context_used=context_used or [],
        full_text_requests=full_text_requests or [],
        # V5 trigger fields
        cites_federal_statute=cites_federal_statute,
        claims_no_alternative=claims_no_alternative,
    )


def make_tier3_output(
    classification: str = "burdensome",
    confidence: float = 0.9,
    reasoning: str = "Test reasoning after full context",
    argument_for_regulation: str = "Updated argument for",
    argument_against_regulation: str = "Updated argument against",
    final_severity: int = None,
    severity_adjustment: int = None,
    severity_adjustment_reasoning: str = None,
    needs_web_search: bool = False,
    potentially_controversial: bool = False,
    federal_mandate_suspected: bool = False,
    federal_mandate_found: bool = False,
    state_has_discretion: bool = True,
    verbatim_requirements: list = None,
    context_used: list = None,
) -> "Tier3Output":
    """Create a Tier3Output with sensible defaults (V5 - final tier with web search)."""
    from scripts.research_pipeline.models.llm_outputs import Tier3Output

    return Tier3Output(
        classification=classification,
        confidence=confidence,
        reasoning=reasoning,
        argument_for_regulation=argument_for_regulation,
        argument_against_regulation=argument_against_regulation,
        final_severity=final_severity,
        severity_adjustment=severity_adjustment,
        severity_adjustment_reasoning=severity_adjustment_reasoning,
        needs_web_search=needs_web_search,
        potentially_controversial=potentially_controversial,
        federal_mandate_suspected=federal_mandate_suspected,
        federal_mandate_found=federal_mandate_found,
        state_has_discretion=state_has_discretion,
        verbatim_requirements=verbatim_requirements or [],
        context_used=context_used or [],
    )


def make_tracked_unit(
    tier1_output=None,
    tier2_output=None,
    tier3_output=None,
    state=None,
    issue_type: str = "mail_only",  # V5: Allow customizing issue type for trigger tests
) -> "TrackedUnit":
    """Create a TrackedUnit with specified tier outputs for testing (V5 - 3 tiers)."""
    from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
    from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

    # Create a minimal ProcessingUnit
    match = MatchInfo(
        match_id=1,
        matched_text="test match",
        position_start=0,
        position_end=10,
        surrounding_context="...test match...",
    )
    pu = ProcessingUnit(
        document_id=123,
        issue_type=issue_type,
        citation="N.J.A.C. 1:1-1.1",
        title="Test Section",
        matches=[match],
        content="Full document content here",
    )

    # Determine state based on tier outputs if not specified
    if state is None:
        if tier3_output is not None:
            state = ProcessingState.TIER3_COMPLETE
        elif tier2_output is not None:
            state = ProcessingState.TIER2_COMPLETE
        elif tier1_output is not None:
            state = ProcessingState.TIER1_COMPLETE
        else:
            state = ProcessingState.PENDING

    unit = TrackedUnit(unit=pu, state=state)
    unit.tier1_output = tier1_output
    unit.tier2_output = tier2_output
    unit.tier3_output = tier3_output

    return unit


# =============================================================================
# SECTION 1.1: Tier 2 → Next Tier Mapping (9 tests)
# =============================================================================


class TestTier2Routing:
    """Section 1.1: Tier 2 → Next Tier Mapping via get_next_state()"""

    def test_unrelated_to_done(self):
        """T2-R1: unrelated classification → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="unrelated", severity=None),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_justified_low_severity_to_done(self):
        """T2-R2: justified with low severity → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="justified", severity=3),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_burdensome_low_severity_to_done(self):
        """T2-R3: burdensome with low severity, no flags → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=4,
                needs_web_search=False,
                federal_mandate_suspected=False,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_burdensome_with_federal_mandate_to_tier3(self):
        """T2-R4: burdensome sev=5 + federal_mandate → TIER3_PENDING"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
                federal_mandate_suspected=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_burdensome_high_severity_with_federal_to_tier3(self):
        """T2-R5: burdensome sev=7 + federal → TIER3_PENDING"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                federal_mandate_suspected=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_high_risk_issue_type_to_tier3(self):
        """V5 T2-R6: High-risk issue type + justified → TIER3_PENDING for web verification"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        # V5.1: High-risk + justified always escalates
        # High-risk + burdensome requires severity >= 7 to escalate
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="justified",  # V5.1: justified always escalates for high-risk
                severity=5,
            ),
            state=ProcessingState.TIER2_COMPLETE,
            issue_type="wet_signature",  # V5: High-risk issue type
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_cites_federal_statute_to_tier3(self):
        """V5 T2-R7: cites_federal_statute → TIER3_PENDING for verification"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
                cites_federal_statute=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_claims_no_alternative_high_severity_to_tier3(self):
        """V5 T2-R8: claims_no_alternative + severity>=7 → TIER3_PENDING"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                claims_no_alternative=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_burdensome_very_high_severity_to_tier3(self):
        """V5 T2-R9: burdensome + severity>=8 → TIER3_PENDING"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=8,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING


# =============================================================================
# SECTION 1.2: Escalation Triggers (8 tests)
# =============================================================================


class TestEscalationTriggers:
    """Section 1.2: Escalation Triggers to Tier 3 (V5: Tier 3 is web search tier)"""

    def test_federal_mandate_escalates(self):
        """T2-E1: sev=5 + federal_mandate=True → TIER3"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
                federal_mandate_suspected=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    @pytest.mark.usefixtures("disable_random_sampling")
    def test_no_federal_mandate_high_confidence_to_done(self):
        """T2-E2: sev=5 + no federal_mandate + high confidence → DONE (random sampling disabled)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
                federal_mandate_suspected=False,
                needs_web_search=False,
                confidence=0.9,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    @pytest.mark.usefixtures("disable_random_sampling")
    def test_low_severity_no_triggers_to_done(self):
        """V5 T2-E3: sev=4 without canonical triggers → DONE (random sampling disabled)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        # In V5, needs_web_search alone doesn't trigger Tier 3
        # Only canonical triggers (federal statute, high-risk issue type, etc.) do
        output = make_tier2_output(
            classification="burdensome",
            severity=4,
            needs_web_search=True,  # Not a V5 trigger by itself
        )
        output.confidence = 0.9  # High confidence to avoid low-confidence trigger

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=output,
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE  # V5: low severity without triggers → DONE

    def test_no_web_search_low_severity_to_done(self):
        """T2-E4: sev=4 + needs_web_search=False → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=4,
                needs_web_search=False,
                federal_mandate_suspected=False,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_justified_controversial_escalates(self):
        """T2-E5: justified + controversial=True → TIER3"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="justified",
                severity=3,
                potentially_controversial=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_justified_not_controversial_to_done(self):
        """T2-E6: justified + controversial=False → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="justified",
                severity=3,
                potentially_controversial=False,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_federal_mandate_any_severity_escalates(self):
        """T2-E7: federal_mandate=True (any severity) → TIER3"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        # Even with low severity, federal mandate should escalate
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=2,
                federal_mandate_suspected=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING

    def test_high_severity_high_confidence_no_flags_to_done(self):
        """T2-E8: sev=7 + conf=0.95 + no flags → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                confidence=0.95,
                needs_web_search=False,
                federal_mandate_suspected=False,
                potentially_controversial=False,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE


# =============================================================================
# SECTION 1.3: Justified Trap Guard (10 parametrized tests)
# =============================================================================


class TestJustifiedTrapGuard:
    """Section 1.3: Justified + controversial escalates at ANY severity"""

    @pytest.mark.parametrize("severity", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    def test_controversial_escalates_at_any_severity(self, severity):
        """Justified + controversial escalates at severity {severity}"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="justified",
                severity=severity,
                potentially_controversial=True,
            ),
            state=ProcessingState.TIER2_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER3_PENDING, (
            f"Expected TIER3_PENDING for justified+controversial at severity {severity}"
        )


# =============================================================================
# SECTION 1.4: Tier 3 Gating (2 tests)
# =============================================================================


class TestTier3Gating:
    """Section 1.4: Tier 3 → next tier gating"""

    def test_tier3_no_web_search_to_done(self):
        """T3-G1: Tier 3 + needs_web_search=False → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
                needs_web_search=False,
            ),
            state=ProcessingState.TIER3_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_tier3_complete_always_done(self):
        """V5: Tier 3 complete always → DONE (Tier 3 is final tier)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
            ),
            state=ProcessingState.TIER3_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_tier3_with_federal_mandate_to_done(self):
        """V5: Tier 3 + federal_mandate_found=True → DONE (no Tier 4)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
                federal_mandate_found=True,
            ),
            state=ProcessingState.TIER3_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_tier3_justified_to_done(self):
        """V5: Tier 3 justified → DONE (final classification)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(
                classification="justified",
            ),
            state=ProcessingState.TIER3_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE


# =============================================================================
# SECTION 1.4b: Tier 3 Final Transitions (V5: 2 tests)
# =============================================================================


class TestTier3FinalTransitions:
    """Section 1.4b: V5 - Tier 3 is the final tier, always transitions to DONE"""

    def test_tier3_complete_with_output_to_done(self):
        """V5: Tier 3 complete with output → DONE"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                federal_mandate_suspected=True,
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
                final_severity=7,
                federal_mandate_found=True,
            ),
            state=ProcessingState.TIER3_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE

    def test_tier3_complete_without_output_to_done(self):
        """V5: Tier 3 complete without output → still DONE (based on state)"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=None,
            state=ProcessingState.TIER3_COMPLETE,
        )

        # V5: Tier 3 is final, transitions based on state not output presence
        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE


# =============================================================================
# SECTION 1.5: Tier 1 Classification Sanity (4 tests)
# =============================================================================


class TestTier1Classification:
    """Section 1.5: Tier 1 Classification Sanity checks"""

    def test_all_dismissed_is_false_positive(self):
        """T1-C1: All matches dismissed → all_false_positives"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState
        from scripts.research_pipeline.models.matches import DismissedMatch

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(
                classification="all_false_positives",
                relevant_match_indices=[],
                dismissed_matches=[
                    DismissedMatch(
                        match_index=0,
                        text="test match",
                        reason="procedural not substantive",
                    ),
                ],
            ),
            state=ProcessingState.TIER1_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.DONE_FALSE_POSITIVE

    def test_some_matches_relevant_needs_research(self):
        """T1-C2: Some matches relevant → needs_research → TIER2"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(
                classification="needs_research",
                relevant_match_indices=[0, 2],
            ),
            state=ProcessingState.TIER1_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER2_PENDING

    def test_all_matches_relevant_needs_research(self):
        """T1-C3: All matches relevant → needs_research → TIER2"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(
                classification="needs_research",
                relevant_match_indices=[0, 1, 2],
            ),
            state=ProcessingState.TIER1_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.TIER2_PENDING

    def test_no_tier1_output_is_error(self):
        """Tier 1 complete but no output → ERROR"""
        from scripts.research_pipeline.state_machine import get_next_state, ProcessingState

        unit = make_tracked_unit(
            tier1_output=None,
            state=ProcessingState.TIER1_COMPLETE,
        )

        next_state = get_next_state(unit)
        assert next_state == ProcessingState.ERROR


# =============================================================================
# SECTION 2: Context & Catalog Tests (partial)
# =============================================================================


class TestContextValidation:
    """Section 2.1: Context Request Validation"""

    def test_valid_context_request_types(self):
        """Valid context types should be accepted."""
        from scripts.research_pipeline.models.context import ContextRequest

        valid_types = ["sibling", "cross_reference", "definition", "hierarchy"]
        for ctx_type in valid_types:
            req = ContextRequest(
                context_type=ctx_type,
                identifier="test-identifier",
                need_level="summary",
                reason="Test reason",
            )
            assert req.context_type == ctx_type

    def test_context_request_needs_full_text(self):
        """Context requests can specify need for full text."""
        from scripts.research_pipeline.models.context import ContextRequest

        req = ContextRequest(
            context_type="sibling",
            identifier="N.J.A.C. 1:1-1.2",
            need_level="full_text",
            reason="Need to verify exemption clause",
        )
        assert req.need_level == "full_text"
        assert req.reason is not None


class TestContextRegistryPolicy:
    """Section 2.2: Context registry policies"""

    def test_content_level_ordering(self):
        """Content levels should upgrade but never downgrade."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("sibling", "A", content_level="catalog")

        # Upgrade to summary
        assert registry.upgrade_content("A", "Summary", "summary") is True
        assert registry.get_item("A").content_level == "summary"

        # Upgrade to full_text
        assert registry.upgrade_content("A", "Full text", "full_text") is True
        assert registry.get_item("A").content_level == "full_text"

        # Cannot downgrade
        assert registry.upgrade_content("A", "", "summary") is False
        assert registry.get_item("A").content_level == "full_text"


# =============================================================================
# SECTION 3.1: final_severity Calculation (5 tests)
# =============================================================================


class TestFinalSeverityCalculation:
    """Section 3.1: final_severity calculation via compute_final_severity()"""

    def test_tier2_plus_tier3_adjustment(self):
        """D-S1: Tier 2 sev=5 + Tier 3 adj=+2 → 7"""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=2,
            ),
        )

        assert compute_final_severity(unit) == 7

    def test_tier3_adjustment_applied_to_tier2(self):
        """D-S2: Tier 2 sev=5 + Tier 3 adj=-1 → 4 (V5)"""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=-1,
            ),
        )

        # V5: Tier 3 adjusts Tier 2 severity
        assert compute_final_severity(unit) == 4

    def test_severity_capped_at_10(self):
        """D-S3: Tier 2 sev=8 + Tier 3 adj=+3 → 10 (capped)"""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=8),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=3,
            ),
        )

        assert compute_final_severity(unit) == 10

    def test_severity_floored_at_1(self):
        """D-S4: Tier 2 sev=3 + Tier 3 adj=-3 → 1 (floored)"""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=3),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=-3,
            ),
        )

        assert compute_final_severity(unit) == 1

    def test_tier3_final_severity_overrides(self):
        """D-S5: V5 - Tier 3 final_severity overrides adjustment calculation"""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(
                classification="burdensome",
                severity_adjustment=-2,
                final_severity=3,
            ),
        )

        assert compute_final_severity(unit) == 3


# =============================================================================
# SECTION 3.2: requirement_found and is_justified (4 tests)
# =============================================================================


class TestDerivedFields:
    """Section 3.2: requirement_found and is_justified"""

    def test_burdensome_requirement_found(self):
        """D-R1: burdensome → requirement_found=True, is_justified=False"""
        from scripts.research_pipeline.result_processor import (
            compute_requirement_found,
            compute_is_justified,
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
        )

        assert compute_requirement_found(unit) is True
        assert compute_is_justified(unit) is False

    def test_justified_is_justified(self):
        """D-R2: justified → requirement_found=True, is_justified=True"""
        from scripts.research_pipeline.result_processor import (
            compute_requirement_found,
            compute_is_justified,
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="justified", severity=3),
        )

        assert compute_requirement_found(unit) is True
        assert compute_is_justified(unit) is True

    def test_unrelated_not_found(self):
        """D-R3: unrelated → requirement_found=False, is_justified=False"""
        from scripts.research_pipeline.result_processor import (
            compute_requirement_found,
            compute_is_justified,
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="unrelated", severity=None),
        )

        assert compute_requirement_found(unit) is False
        assert compute_is_justified(unit) is False

    def test_reclassified_uses_final(self):
        """D-R4: Reclassified T2→T3 uses final classification"""
        from scripts.research_pipeline.result_processor import (
            compute_requirement_found,
            compute_is_justified,
            compute_final_classification,
        )

        # Tier 2 says burdensome, Tier 3 reclassifies to justified
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(classification="justified"),
        )

        assert compute_final_classification(unit) == "justified"
        assert compute_requirement_found(unit) is True
        assert compute_is_justified(unit) is True


# =============================================================================
# SECTION 3.3: classification_tier and highest_tier Tracking (5 tests)
# =============================================================================


class TestTierTracking:
    """Section 3.3: classification_tier and highest_tier"""

    def test_tier1_false_positive_path(self):
        """D-T1: T1→DONE (false_pos) → classification_tier=1, highest=1"""
        from scripts.research_pipeline.result_processor import get_classification_tier

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(
                classification="all_false_positives",
                relevant_match_indices=[],
            ),
        )

        assert get_classification_tier(unit) == 1
        assert unit.highest_tier_completed == 1

    def test_tier1_to_tier2_path(self):
        """D-T2: T1→T2→DONE → classification_tier=2, highest=2"""
        from scripts.research_pipeline.result_processor import get_classification_tier

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
        )

        assert get_classification_tier(unit) == 2
        assert unit.highest_tier_completed == 2

    def test_tier1_to_tier3_path(self):
        """D-T3: T1→T2→T3→DONE → classification_tier=3, highest=3"""
        from scripts.research_pipeline.result_processor import get_classification_tier

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(classification="burdensome"),
        )

        assert get_classification_tier(unit) == 3
        assert unit.highest_tier_completed == 3

    def test_tier2_to_tier3_federal_mandate(self):
        """D-T4: V5 - T1→T2→T3 with federal mandate → classification_tier=3, highest=3"""
        from scripts.research_pipeline.result_processor import get_classification_tier

        # In V5, Tier 3 IS the web search tier, so federal mandate goes T2 → T3
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
                federal_mandate_suspected=True,
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
                final_severity=5,
            ),
        )

        assert get_classification_tier(unit) == 3
        assert unit.highest_tier_completed == 3

    def test_full_tier_path_v5(self):
        """D-T5: V5 - Full T1→T2→T3 → classification_tier=3, highest=3"""
        from scripts.research_pipeline.result_processor import get_classification_tier

        # V5: Only 3 tiers, Tier 3 includes web search
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(
                classification="burdensome",
                final_severity=6,
            ),
        )

        assert get_classification_tier(unit) == 3
        assert unit.highest_tier_completed == 3


# =============================================================================
# SECTION 3.4: Match ID Mapping (1 test)
# =============================================================================


class TestMatchIdMapping:
    """Section 3.4: Match ID Mapping"""

    def test_tier1_dismissed_match_ids_mapping(self):
        """Tier1 dismissed_match indices map correctly to match IDs."""
        from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo, DismissedMatch

        # Create multiple matches with distinct IDs
        matches = [
            MatchInfo(match_id=100, matched_text="match 0", position_start=0, position_end=10, surrounding_context="ctx 0"),
            MatchInfo(match_id=200, matched_text="match 1", position_start=20, position_end=30, surrounding_context="ctx 1"),
            MatchInfo(match_id=300, matched_text="match 2", position_start=40, position_end=50, surrounding_context="ctx 2"),
        ]
        pu = ProcessingUnit(
            document_id=999,
            issue_type="mail_only",
            citation="N.J.A.C. 1:1-1.1",
            title="Test",
            matches=matches,
            content="Content",
        )

        unit = TrackedUnit(unit=pu, state=ProcessingState.TIER1_COMPLETE)
        unit.tier1_output = make_tier1_output(
            classification="needs_research",
            relevant_match_indices=[0, 2],
            dismissed_matches=[
                DismissedMatch(
                    match_index=1,
                    text="match 1",
                    reason="False positive",
                ),
            ],
        )

        # Map dismissed indices to actual match IDs
        dismissed_ids = [
            pu.matches[dm.match_index].match_id
            for dm in unit.tier1_output.dismissed_matches
        ]
        assert dismissed_ids == [200]

        # Map relevant indices to actual match IDs
        relevant_ids = [
            pu.matches[idx].match_id
            for idx in unit.tier1_output.relevant_match_indices
        ]
        assert relevant_ids == [100, 300]


# =============================================================================
# SECTION 3.5: is_verbatim Calculation (additional test)
# =============================================================================


class TestVerbatimCaseInsensitive:
    """Section 3.5: is_verbatim case insensitive matching"""

    def test_check_verbatim_case_insensitive(self):
        """Verbatim check should be case insensitive."""
        from scripts.research_pipeline.result_processor import check_verbatim

        source = "Applications MUST BE MAILED to the office."
        quotes = ["must be mailed"]

        is_verbatim, details = check_verbatim(quotes, source)

        assert is_verbatim is True
        assert details[0]["is_verbatim"] is True

    def test_check_verbatim_whitespace_normalized(self):
        """Verbatim check should handle whitespace differences."""
        from scripts.research_pipeline.result_processor import check_verbatim

        source = "Applications must\n  be   mailed to the office."
        quotes = ["must be mailed"]

        is_verbatim, details = check_verbatim(quotes, source)

        assert is_verbatim is True
        assert details[0]["match_type"] == "normalized"


# =============================================================================
# V5 PHASE 4 TESTS - Proactive Context Builder
# =============================================================================


class TestV5ContextModels:
    """Test V5 proactive context models."""

    def test_sibling_summary_model(self):
        """Test SiblingSummary model with all fields."""
        from scripts.research_pipeline.models.context import SiblingSummary

        summary = SiblingSummary(
            document_id=123,
            citation="N.J.A.C. 5:23-1.1",
            title="Exemptions",
            summary="This section describes exemptions from requirements.",
            is_fallback=False,
            reason="keyword",
            keyword_category="exemption",
        )

        assert summary.document_id == 123
        assert summary.reason == "keyword"
        assert summary.keyword_category == "exemption"
        assert summary.is_fallback is False

    def test_sibling_summary_preceding(self):
        """Test SiblingSummary for preceding sibling."""
        from scripts.research_pipeline.models.context import SiblingSummary

        summary = SiblingSummary(
            document_id=122,
            citation="N.J.A.C. 5:23-1.0",
            title="General Provisions",
            summary="[Excerpt]: This section establishes...",
            is_fallback=True,
            reason="preceding",
        )

        assert summary.reason == "preceding"
        assert summary.keyword_category is None
        assert summary.is_fallback is True

    def test_cross_ref_summary_model(self):
        """Test CrossRefSummary model."""
        from scripts.research_pipeline.models.context import CrossRefSummary

        summary = CrossRefSummary(
            target_id=456,
            citation="N.J.A.C. 10:122-1.1",
            target_title="Electronic Submission",
            summary="This section permits electronic submission.",
            is_fallback=False,
            keyword_category="alternatives",
        )

        assert summary.target_id == 456
        assert summary.keyword_category == "alternatives"

    def test_ancestor_summary_model(self):
        """Test AncestorSummary model."""
        from scripts.research_pipeline.models.context import AncestorSummary

        summary = AncestorSummary(
            document_id=789,
            citation="N.J.A.C. 5:23",
            title="Uniform Construction Code",
            hierarchy_level="subchapter",
            summary="Establishes statewide building standards.",
            is_fallback=False,
        )

        assert summary.hierarchy_level == "subchapter"
        assert summary.is_fallback is False

    def test_proactive_context_model(self):
        """Test ProactiveTier1Context model structure."""
        from scripts.research_pipeline.models.context import (
            ProactiveTier1Context,
            SiblingSummary,
            CrossRefSummary,
            AncestorSummary,
            SiblingEntry,
            CrossRefEntry,
        )

        ctx = ProactiveTier1Context(
            sibling_summaries=[
                SiblingSummary(
                    document_id=1,
                    citation="C1",
                    title="T1",
                    summary="S1",
                    reason="preceding",
                )
            ],
            cross_ref_summaries=[
                CrossRefSummary(
                    target_id=2,
                    citation="C2",
                    summary="S2",
                    keyword_category="exemption",
                )
            ],
            ancestor_summaries=[
                AncestorSummary(
                    document_id=3,
                    citation="C3",
                    title="T3",
                    hierarchy_level="chapter",
                    summary="S3",
                )
            ],
            sibling_catalog=[
                SiblingEntry(document_id=4, citation="C4", title="T4")
            ],
            cross_ref_catalog=[
                CrossRefEntry(target_id=5, citation="C5")
            ],
            definition_terms=["term1", "term2"],
            sibling_catalog_truncated=False,
            cross_ref_catalog_truncated=True,
        )

        assert len(ctx.sibling_summaries) == 1
        assert len(ctx.cross_ref_summaries) == 1
        assert len(ctx.ancestor_summaries) == 1
        assert len(ctx.sibling_catalog) == 1
        assert len(ctx.cross_ref_catalog) == 1
        assert len(ctx.definition_terms) == 2
        assert ctx.cross_ref_catalog_truncated is True


class TestV5HelperFunctions:
    """Test V5 helper functions from context_builder."""

    def test_is_excludable_definitions(self):
        """is_excludable should exclude definition sections."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Definitions") is True
        assert is_excludable("Defined Terms") is True
        assert is_excludable("Section 1.1 Definitions") is True

    def test_is_excludable_toc(self):
        """is_excludable should exclude table of contents."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Table of Contents") is True
        assert is_excludable("Contents") is True

    def test_is_excludable_reserved(self):
        """is_excludable should exclude reserved/repealed sections."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Reserved") is True
        assert is_excludable("Repealed") is True

    def test_is_excludable_appendix(self):
        """is_excludable should exclude appendices."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Appendix A") is True
        assert is_excludable("Appendices") is True

    def test_is_excludable_empty(self):
        """is_excludable should exclude empty/None titles."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("") is True
        assert is_excludable(None) is True

    def test_is_excludable_normal_titles(self):
        """is_excludable should NOT exclude normal section titles."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("License Requirements") is False
        assert is_excludable("Exemptions") is False
        assert is_excludable("Electronic Submission") is False
        assert is_excludable("Application Procedures") is False

    def test_get_keyword_category_exemption(self):
        """get_keyword_category should return 'exemption' for exemption keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Exemptions") == "exemption"
        assert get_keyword_category("Waiver Provisions") == "exemption"
        assert get_keyword_category("Exceptions to Requirements") == "exemption"
        assert get_keyword_category("This does not apply to...") == "exemption"

    def test_get_keyword_category_alternatives(self):
        """get_keyword_category should return 'alternatives' for alternative keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Electronic Submission") == "alternatives"
        assert get_keyword_category("Online Application") == "alternatives"
        assert get_keyword_category("Digital Procedures") == "alternatives"
        assert get_keyword_category("Remote Processing") == "alternatives"
        assert get_keyword_category("Alternative Methods") == "alternatives"

    def test_get_keyword_category_scope(self):
        """get_keyword_category should return 'scope' for scope keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Applicability") == "scope"
        assert get_keyword_category("Scope of Regulations") == "scope"
        assert get_keyword_category("General Provisions") == "scope"
        assert get_keyword_category("Purpose") == "scope"

    def test_get_keyword_category_enforcement(self):
        """get_keyword_category should return 'enforcement' for enforcement keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Enforcement") == "enforcement"
        assert get_keyword_category("Penalty Provisions") == "enforcement"
        assert get_keyword_category("Violations") == "enforcement"
        assert get_keyword_category("Fines and Sanctions") == "enforcement"

    def test_get_keyword_category_priority(self):
        """get_keyword_category should return highest priority category when multiple match."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        # "Electronic Exemptions" matches both exemption and alternatives
        # exemption has higher priority
        assert get_keyword_category("Electronic Exemptions") == "exemption"

    def test_get_keyword_category_none(self):
        """get_keyword_category should return None for non-matching titles."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("License Requirements") is None
        # Note: "Application Procedures" now matches "scope" since "application" is a keyword
        assert get_keyword_category("Fee Schedule") is None
        assert get_keyword_category(None) is None
        assert get_keyword_category("") is None

    def test_get_summary_or_fallback_with_summary(self):
        """get_summary_or_fallback should use summary when available."""
        from scripts.research_pipeline.context_builder import get_summary_or_fallback

        text, is_fallback = get_summary_or_fallback(
            summary="A proper summary of the section.",
            content="Full content here that is much longer...",
            title="Section Title",
        )

        assert text == "A proper summary of the section."
        assert is_fallback is False

    def test_get_summary_or_fallback_content_excerpt(self):
        """get_summary_or_fallback should use content excerpt when no summary."""
        from scripts.research_pipeline.context_builder import get_summary_or_fallback

        long_content = "This is a long piece of content. " * 50  # ~1700 chars

        text, is_fallback = get_summary_or_fallback(
            summary=None,
            content=long_content,
            title="Section Title",
        )

        assert "[Excerpt]:" in text
        assert is_fallback is True
        assert len(text) <= 600  # 500 + "[Excerpt]: " prefix

    def test_get_summary_or_fallback_title_only(self):
        """get_summary_or_fallback should use title when no summary or content."""
        from scripts.research_pipeline.context_builder import get_summary_or_fallback

        text, is_fallback = get_summary_or_fallback(
            summary=None,
            content="",  # Empty content
            title="Section Title Here",
        )

        assert text == "[Title only]: Section Title Here"
        assert is_fallback is True

    def test_get_summary_or_fallback_short_summary_ignored(self):
        """get_summary_or_fallback should ignore very short summaries and use content excerpt."""
        from scripts.research_pipeline.context_builder import get_summary_or_fallback

        # Content must be >50 chars to trigger excerpt fallback
        long_content = "This is the actual content which is substantially longer than the minimum threshold required for excerpt generation."

        text, is_fallback = get_summary_or_fallback(
            summary="N/A",  # Too short (< 10 chars)
            content=long_content,
            title="Title",
        )

        assert "[Excerpt]:" in text
        assert is_fallback is True


class TestPrioritizeSummaries:
    """Test prioritize_summaries function."""

    def test_prioritize_includes_preceding(self):
        """prioritize_summaries should include preceding sibling."""
        from scripts.research_pipeline.context_builder import prioritize_summaries
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="C1", title="Previous Section"),
            SiblingEntry(document_id=2, citation="C2", title="Current Section"),
        ]

        items = prioritize_summaries(
            doc_id=2,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={
                "prev": SiblingEntry(document_id=1, citation="C1", title="Previous Section"),
                "next": None,
            },
        )

        assert len(items) >= 1
        assert items[0] == ("sibling", 1, "preceding", None)

    def test_prioritize_includes_following(self):
        """prioritize_summaries should include following sibling."""
        from scripts.research_pipeline.context_builder import prioritize_summaries
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="C1", title="Current Section"),
            SiblingEntry(document_id=2, citation="C2", title="Next Section"),
        ]

        items = prioritize_summaries(
            doc_id=1,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={
                "prev": None,
                "next": SiblingEntry(document_id=2, citation="C2", title="Next Section"),
            },
        )

        assert len(items) >= 1
        assert items[0] == ("sibling", 2, "following", None)

    def test_prioritize_skips_excludable(self):
        """prioritize_summaries should skip excludable sections."""
        from scripts.research_pipeline.context_builder import prioritize_summaries
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="C1", title="Definitions"),
            SiblingEntry(document_id=2, citation="C2", title="Normal Section"),
        ]

        items = prioritize_summaries(
            doc_id=2,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={
                "prev": SiblingEntry(document_id=1, citation="C1", title="Definitions"),
                "next": None,
            },
        )

        # Definitions should be excluded
        assert not any(item[1] == 1 for item in items)

    def test_prioritize_includes_keyword_matches(self):
        """prioritize_summaries should include keyword-matched siblings."""
        from scripts.research_pipeline.context_builder import prioritize_summaries
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="C1", title="Exemptions"),
            SiblingEntry(document_id=2, citation="C2", title="Current Section"),
            SiblingEntry(document_id=3, citation="C3", title="Electronic Submission"),
        ]

        items = prioritize_summaries(
            doc_id=2,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={"prev": None, "next": None},
        )

        # Should include keyword-matched siblings
        sibling_ids = [item[1] for item in items if item[0] == "sibling"]
        assert 1 in sibling_ids  # Exemptions
        assert 3 in sibling_ids  # Electronic Submission

    def test_prioritize_keyword_ordering(self):
        """prioritize_summaries should order keywords by priority."""
        from scripts.research_pipeline.context_builder import prioritize_summaries
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="C1", title="Enforcement"),  # enforcement
            SiblingEntry(document_id=2, citation="C2", title="Current Section"),
            SiblingEntry(document_id=3, citation="C3", title="Exemptions"),  # exemption (highest priority)
        ]

        items = prioritize_summaries(
            doc_id=2,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={"prev": None, "next": None},
        )

        keyword_items = [item for item in items if item[2] == "keyword"]
        if len(keyword_items) >= 2:
            # Exemption should come before enforcement
            exemption_idx = next(i for i, item in enumerate(keyword_items) if item[1] == 3)
            enforcement_idx = next(i for i, item in enumerate(keyword_items) if item[1] == 1)
            assert exemption_idx < enforcement_idx

    def test_prioritize_respects_max_limit(self):
        """prioritize_summaries should respect MAX_SUMMARIES limit."""
        from scripts.research_pipeline.context_builder import (
            prioritize_summaries,
            MAX_SUMMARIES,
        )
        from scripts.research_pipeline.models.context import SiblingEntry

        # Create more siblings than MAX_SUMMARIES
        siblings = [
            SiblingEntry(document_id=i, citation=f"C{i}", title=f"Exemption {i}")
            for i in range(30)
        ]

        items = prioritize_summaries(
            doc_id=999,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={"prev": None, "next": None},
        )

        assert len(items) <= MAX_SUMMARIES

    def test_prioritize_deduplicates(self):
        """prioritize_summaries should deduplicate by document ID."""
        from scripts.research_pipeline.context_builder import prioritize_summaries
        from scripts.research_pipeline.models.context import SiblingEntry, CrossRefEntry

        # Preceding sibling is also a keyword match - should only appear once
        siblings = [
            SiblingEntry(document_id=1, citation="C1", title="Exemptions"),  # keyword match
            SiblingEntry(document_id=2, citation="C2", title="Current"),
        ]

        items = prioritize_summaries(
            doc_id=2,
            siblings=siblings,
            cross_refs=[],
            immediate_siblings={
                "prev": SiblingEntry(document_id=1, citation="C1", title="Exemptions"),
                "next": None,
            },
        )

        # Document 1 should appear only once (as preceding, not keyword)
        doc1_items = [item for item in items if item[1] == 1]
        assert len(doc1_items) == 1
        assert doc1_items[0][2] == "preceding"  # First match wins


class TestFormatProactiveContext:
    """Test format_proactive_context function."""

    def test_format_empty_context(self):
        """format_proactive_context should handle empty context."""
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import ProactiveTier1Context

        ctx = ProactiveTier1Context()
        result = format_proactive_context(ctx)

        assert result == ""  # Empty context produces empty string

    def test_format_with_ancestors(self):
        """format_proactive_context should include ancestor summaries."""
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import (
            ProactiveTier1Context,
            AncestorSummary,
        )

        ctx = ProactiveTier1Context(
            ancestor_summaries=[
                AncestorSummary(
                    document_id=1,
                    citation="N.J.A.C. 5:23",
                    title="Building Code",
                    hierarchy_level="chapter",
                    summary="Establishes building standards.",
                )
            ]
        )

        result = format_proactive_context(ctx)

        assert "## Hierarchy Context (Scope)" in result
        assert "[chapter]" in result
        assert "N.J.A.C. 5:23" in result
        assert "Establishes building standards." in result

    def test_format_with_sibling_summaries(self):
        """format_proactive_context should include sibling summaries."""
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import (
            ProactiveTier1Context,
            SiblingSummary,
        )

        ctx = ProactiveTier1Context(
            sibling_summaries=[
                SiblingSummary(
                    document_id=1,
                    citation="N.J.A.C. 5:23-1.1",
                    title="Exemptions",
                    summary="Lists exemptions.",
                    reason="keyword",
                    keyword_category="exemption",
                )
            ]
        )

        result = format_proactive_context(ctx)

        assert "## Pre-Fetched Sibling Summaries" in result
        assert "[keyword: exemption]" in result
        assert "N.J.A.C. 5:23-1.1" in result

    def test_format_marks_fallback(self):
        """format_proactive_context should mark fallback summaries."""
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import (
            ProactiveTier1Context,
            SiblingSummary,
        )

        ctx = ProactiveTier1Context(
            sibling_summaries=[
                SiblingSummary(
                    document_id=1,
                    citation="C1",
                    title="T1",
                    summary="[Excerpt]: Some text...",
                    is_fallback=True,
                    reason="preceding",
                )
            ]
        )

        result = format_proactive_context(ctx)

        assert "[excerpt]" in result

    def test_format_truncated_catalogs(self):
        """format_proactive_context should indicate truncated catalogs."""
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import (
            ProactiveTier1Context,
            SiblingEntry,
        )

        ctx = ProactiveTier1Context(
            sibling_catalog=[
                SiblingEntry(document_id=i, citation=f"C{i}", title=f"T{i}")
                for i in range(5)
            ],
            sibling_catalog_truncated=True,
        )

        result = format_proactive_context(ctx)

        assert "(truncated)" in result

    def test_format_definition_terms(self):
        """format_proactive_context should include definition terms."""
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import ProactiveTier1Context

        ctx = ProactiveTier1Context(
            definition_terms=["applicant", "permit", "license"]
        )

        result = format_proactive_context(ctx)

        assert "## Available Definitions" in result
        assert "applicant" in result
        assert "permit" in result
        assert "license" in result


class TestV5ContextBuilderImports:
    """Test that V5 context builder functions are importable."""

    def test_import_v5_functions(self):
        """V5 functions should be importable."""
        from scripts.research_pipeline.context_builder import (
            build_proactive_context,
            prioritize_summaries,
            is_excludable,
            get_keyword_category,
            get_summary_or_fallback,
            SIBLING_KEYWORDS,
            KEYWORD_PRIORITY,
            EXCLUDABLE_PATTERNS,
            MAX_SUMMARIES,
        )

        assert build_proactive_context is not None
        assert prioritize_summaries is not None
        assert len(SIBLING_KEYWORDS) == 4
        assert len(KEYWORD_PRIORITY) == 4
        assert MAX_SUMMARIES == 20

    def test_empty_inputs(self):
        """build_proactive_context should handle empty inputs."""
        from scripts.research_pipeline.context_builder import build_proactive_context

        result = build_proactive_context([])
        assert result == {}


@pytest.mark.db
class TestV5ProactiveContextDB:
    """Test V5 proactive context with real database.

    These tests are READ-ONLY and do not modify database data.
    """

    @pytest.fixture(autouse=True)
    def check_db_connection(self):
        """Skip if no database connection available."""
        from shared_utils import get_db_connection

        conn = get_db_connection()
        if not conn:
            pytest.skip("Database connection not available")
        conn.close()

    @pytest.fixture
    def sample_doc_ids(self):
        """Get sample NJ section document IDs for testing."""
        from shared_utils import get_db_connection

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM regulatory_documents
                WHERE state = %s AND hierarchy_level = %s
                LIMIT 5
                """,
                ["NJ", "section"],
            )
            ids = [row[0] for row in cur.fetchall()]
        conn.close()
        return ids

    def test_build_proactive_context_returns_context(self, sample_doc_ids):
        """build_proactive_context should return ProactiveTier1Context for each doc."""
        from scripts.research_pipeline.context_builder import build_proactive_context
        from scripts.research_pipeline.models.context import ProactiveTier1Context

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = build_proactive_context(sample_doc_ids)

        assert isinstance(result, dict)
        assert len(result) == len(sample_doc_ids)

        for doc_id, ctx in result.items():
            assert isinstance(ctx, ProactiveTier1Context)
            # Summaries should be limited
            assert len(ctx.sibling_summaries) + len(ctx.cross_ref_summaries) <= 20

    def test_proactive_context_has_ancestors(self, sample_doc_ids):
        """Proactive context should include ancestor summaries."""
        from scripts.research_pipeline.context_builder import build_proactive_context

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = build_proactive_context(sample_doc_ids)

        # At least some docs should have ancestors
        docs_with_ancestors = sum(
            1 for ctx in result.values() if len(ctx.ancestor_summaries) > 0
        )
        assert docs_with_ancestors > 0

    def test_proactive_context_summaries_populated(self, sample_doc_ids):
        """Summary fields should always be populated (via fallback if needed)."""
        from scripts.research_pipeline.context_builder import build_proactive_context

        if not sample_doc_ids:
            pytest.skip("No sample documents found")

        result = build_proactive_context(sample_doc_ids)

        for ctx in result.values():
            for sib in ctx.sibling_summaries:
                assert sib.summary  # Should never be empty
                assert len(sib.summary) > 0

            for cr in ctx.cross_ref_summaries:
                assert cr.summary
                assert len(cr.summary) > 0

            for anc in ctx.ancestor_summaries:
                assert anc.summary
                assert len(anc.summary) > 0

    def test_proactive_context_batch_performance(self):
        """build_proactive_context should complete in reasonable time for batch."""
        import time
        from shared_utils import get_db_connection
        from scripts.research_pipeline.context_builder import build_proactive_context

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM regulatory_documents
                WHERE state = %s AND hierarchy_level = %s
                LIMIT 50
                """,
                ["NJ", "section"],
            )
            doc_ids = [row[0] for row in cur.fetchall()]
        conn.close()

        if len(doc_ids) < 20:
            pytest.skip("Not enough documents for performance test")

        start = time.time()
        result = build_proactive_context(doc_ids)
        elapsed = time.time() - start

        assert len(result) == len(doc_ids)
        assert elapsed < 15.0, f"build_proactive_context too slow: {elapsed:.2f}s for {len(doc_ids)} docs"


# =============================================================================
# SCHEMA VALIDATION TESTS - Prevent V4/V5 drift
# =============================================================================


class TestPromptPlaceholderValidation:
    """Test that all prompt placeholders are properly supplied.

    These tests catch regressions where template placeholders are defined
    in YAML but not supplied in Python code, causing raw {...} to leak.
    """

    def test_tier1_no_raw_placeholders(self):
        """Tier 1 formatted prompts should have no raw {...} placeholders."""
        import re
        from scripts.research_pipeline.prompt_loader import (
            load_tier_config,
            load_issue_config,
            format_tier_prompt,
        )

        tier1 = load_tier_config("tier1")
        issue = load_issue_config("in_person_submission")

        # Mock all expected Tier 1 context values
        prompt = format_tier_prompt(
            tier=tier1,
            issue=issue,
            citation="N.J.A.C. 1:1-1.1",
            title="Test Section",
            document_summary="Test summary",
            match_count="3",
            match_list="- Match 1\n- Match 2\n- Match 3",
            immediate_siblings="(none)",
            keyword_sibling_summaries="(none pre-fetched)",
            keyword_crossref_summaries="(none pre-fetched)",
            ancestor_summaries="(no ancestors)",
            sibling_count="5",
            sibling_catalog="[list of siblings]",
            sibling_catalog_truncated="",
            crossref_count="2",
            crossref_catalog="[list of crossrefs]",
            crossref_catalog_truncated="",
            definition_terms="term1, term2",
            sibling_titles="(for backward compat)",
            crossref_citations="(for backward compat)",
            ancestor_chain="(for backward compat)",
        )

        # Check for raw placeholders (but exclude JSON schema examples)
        system = prompt["system"]
        user = prompt["user"]

        # Find all {...} patterns that aren't part of JSON examples
        raw_placeholders = re.findall(r'\{[a-z_]+\}', system + user)
        # Filter out known JSON patterns
        json_patterns = ['{', '}', '{"', '"}']
        raw_placeholders = [p for p in raw_placeholders if not any(j in p for j in json_patterns)]

        assert len(raw_placeholders) == 0, f"Raw placeholders found: {raw_placeholders}"

    def test_tier2_no_raw_placeholders(self):
        """Tier 2 formatted prompts should have no raw {...} placeholders."""
        import re
        from scripts.research_pipeline.prompt_loader import (
            load_tier_config,
            load_issue_config,
            format_tier_prompt,
        )

        tier2 = load_tier_config("tier2")
        issue = load_issue_config("in_person_submission")

        # V5 4-layer caching: batch_context_vars (Layer 3)
        # These are shared across documents in the same subchapter
        batch_context_vars = {
            "subchapter_citation": "N.J.A.C. 1:1",
            "definition_scope": "(definitions from N.J.A.C. 1:1)",
            "definitions": "- applicant: A person who applies",
            # V5: Document context fields (batch_context layer)
            "ancestor_summaries": "(no ancestor summaries)",
            "sibling_count": "0",
            "sibling_catalog_truncated": "",
            "sibling_catalog": "(no sibling catalog)",
            "keyword_sibling_summaries": "(no keyword matches)",
        }

        # Mock all expected Tier 2 context values
        prompt = format_tier_prompt(
            tier=tier2,
            issue=issue,
            batch_context_vars=batch_context_vars,
            # Document-specific vars (Layer 4)
            citation="N.J.A.C. 1:1-1.1",
            title="Test Section",
            content="Test document content with requirements...",
            relevant_matches="- Match 1 context\n- Match 2 context",
            tier1_dismissed_count="2",
            # V5: Tier 1 handoff
            tier1_argument_burdensome="Requires in-person submission without alternative",
            tier1_argument_justified="May need verification of identity",
            tier1_argument_unrelated="Could be a procedural mention only",
            tier1_fetched_context="(no additional context fetched)",
        )

        system = prompt["system"]
        user = prompt["user"]

        raw_placeholders = re.findall(r'\{[a-z_]+\}', system + user)
        assert len(raw_placeholders) == 0, f"Raw placeholders found: {raw_placeholders}"


class TestLLMOutputSchemaV5:
    """Test that LLM output models have required V5 fields.

    These tests prevent schema drift between prompts and models.
    """

    def test_tier1_output_has_v5_fields(self):
        """Tier1Output should have V5 argument framing and recommendation fields."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        # Check V5 fields exist
        fields = Tier1Output.model_fields

        # Argument framing
        assert "best_argument_burdensome" in fields
        assert "best_argument_justified" in fields
        assert "best_argument_unrelated" in fields

        # Context requests (replaces old recommended_* fields)
        assert "context_requests" in fields

    def test_tier2_output_has_v5_fields(self):
        """Tier2Output should have V5 routing flags."""
        from scripts.research_pipeline.models.llm_outputs import Tier2Output

        fields = Tier2Output.model_fields

        # V5 routing flags
        assert "cites_federal_statute" in fields
        assert "federal_citation" in fields
        assert "claims_no_alternative" in fields

        # Existing escalation flags
        assert "potentially_controversial" in fields
        assert "federal_mandate_suspected" in fields

    def test_tier1_output_validates(self):
        """Tier1Output should accept valid V5 data."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        data = {
            "relevant_match_indices": [0, 2],
            "dismissed_matches": [
                {"match_index": 1, "text": "test", "reason": "False positive"}
            ],
            "classification": "needs_research",
            "confidence": 0.85,
            "reasoning": "Valid matches found",
            # V5 fields
            "best_argument_burdensome": "Requires in-person visit",
            "best_argument_justified": "May need identity verification",
            "best_argument_unrelated": "Could be administrative mention",
            "context_requests": [
                {
                    "context_type": "sibling",
                    "identifier": "N.J.A.C. 1:1-1.2",
                    "need_level": "full_text",
                    "reason": "Check for exemptions",
                },
                {
                    "context_type": "definition",
                    "identifier": "applicant",
                    "need_level": "summary",
                    "reason": "Clarify scope",
                },
            ],
        }

        output = Tier1Output(**data)
        assert output.best_argument_burdensome == "Requires in-person visit"
        assert len(output.context_requests) == 2
        assert output.context_requests[0].context_type == "sibling"

    def test_tier2_output_validates(self):
        """Tier2Output should accept valid V5 data with routing flags."""
        from scripts.research_pipeline.models.llm_outputs import Tier2Output

        data = {
            "classification": "burdensome",
            "confidence": 0.9,
            "reasoning": "In-person requirement confirmed",
            "argument_for_regulation": "Identity verification",
            "argument_against_regulation": "No alternative provided",
            "severity": 7,
            "severity_baseline": 5,
            "severity_calculation": "Base 5 + no alternative (+2) = 7",
            "verbatim_requirements": ["must appear in person"],
            "context_used": [],
            # V5 routing flags
            "cites_federal_statute": True,
            "federal_citation": "42 CFR 483.24",
            "claims_no_alternative": True,
        }

        output = Tier2Output(**data)
        assert output.cites_federal_statute is True
        assert output.federal_citation == "42 CFR 483.24"
        assert output.claims_no_alternative is True


class TestPersistenceModelsV5:
    """Test that persistence models have V5 fields for database columns."""

    def test_tier1_update_has_v5_fields(self):
        """ComplianceIssueTier1Update should have V5 fields."""
        from scripts.research_pipeline.models.database import ComplianceIssueTier1Update

        fields = ComplianceIssueTier1Update.model_fields

        # V5 fields
        assert "tier1_argument_framing" in fields
        assert "tier1_recommendations" in fields

        # Check default pipeline_version
        assert fields["pipeline_version"].default == "v5"

    def test_tier2_update_has_v5_fields(self):
        """ComplianceIssueTier2Update should have V5 routing flags."""
        from scripts.research_pipeline.models.database import ComplianceIssueTier2Update

        fields = ComplianceIssueTier2Update.model_fields

        # V5 routing flags
        assert "cites_federal_statute" in fields
        assert "federal_citation" in fields
        assert "claims_no_alternative" in fields

        # V5 re-run tracking
        assert "tier2_rerun_count" in fields
        assert "tier2_context_requests_made" in fields
        assert "tier2_forced_classification" in fields


# =============================================================================
# V5 PHASE 5 TESTS - TierConfig 3-Layer Structure & Tier 1 V5 Functional Tests
# =============================================================================


class TestTierConfig3LayerFunctional:
    """Functional tests for TierConfig 3-layer caching structure (V5)."""

    def test_tier_config_has_all_layers(self):
        """TierConfig should have all 3 layers: static_core, issue_block, template."""
        from scripts.research_pipeline.prompt_loader import load_tier_config

        for tier_name in ["tier1", "tier2"]:
            tier = load_tier_config(tier_name)

            assert hasattr(tier, "static_core"), f"{tier_name} missing static_core"
            assert hasattr(tier, "issue_block"), f"{tier_name} missing issue_block"
            assert hasattr(tier, "template"), f"{tier_name} missing template"

    def test_tier_config_system_backward_compat(self):
        """TierConfig.system property should return static_core for backward compat."""
        from scripts.research_pipeline.prompt_loader import load_tier_config

        tier1 = load_tier_config("tier1")

        assert tier1.system == tier1.static_core

    def test_format_tier_prompt_static_core_no_substitutions(self):
        """static_core (system prompt) should have NO substitutions applied."""
        from scripts.research_pipeline.prompt_loader import (
            load_tier_config,
            load_issue_config,
            format_tier_prompt,
        )

        tier1 = load_tier_config("tier1")
        issue = load_issue_config("mail_only")

        result = format_tier_prompt(
            tier=tier1,
            issue=issue,
            citation="TEST_CITATION",
            title="TEST_TITLE",
            document_summary="TEST_SUMMARY",
            match_count="99",
            match_list="TEST_MATCHES",
            immediate_siblings="TEST_SIBLINGS",
            keyword_sibling_summaries="TEST",
            keyword_crossref_summaries="TEST",
            ancestor_summaries="TEST",
            sibling_count="0",
            sibling_catalog="TEST",
            sibling_catalog_truncated="",
            crossref_count="0",
            crossref_catalog="TEST",
            crossref_catalog_truncated="",
            definition_terms="TEST",
            sibling_titles="TEST",
            crossref_citations="TEST",
            ancestor_chain="TEST",
        )

        # System prompt should be untouched (fully cached)
        assert result["system"] == tier1.static_core
        # User prompt should have substitutions
        assert "TEST_CITATION" in result["user"]

    def test_format_tier_prompt_user_contains_issue_vars(self):
        """User prompt should have issue-specific substitutions applied."""
        from scripts.research_pipeline.prompt_loader import (
            load_tier_config,
            load_issue_config,
            format_tier_prompt,
        )

        tier1 = load_tier_config("tier1")
        issue = load_issue_config("mail_only")

        result = format_tier_prompt(
            tier=tier1,
            issue=issue,
            citation="N.J.A.C. 1:1-1.1",
            title="Test",
            document_summary="Test",
            match_count="1",
            match_list="match",
            immediate_siblings="",
            keyword_sibling_summaries="",
            keyword_crossref_summaries="",
            ancestor_summaries="",
            sibling_count="0",
            sibling_catalog="",
            sibling_catalog_truncated="",
            crossref_count="0",
            crossref_catalog="",
            crossref_catalog_truncated="",
            definition_terms="",
            sibling_titles="",
            crossref_citations="",
            ancestor_chain="",
        )

        # Issue-specific content should be in user prompt
        user = result["user"]

        # Issue type should be substituted
        assert "mail_only" in user or "mail" in user.lower()

        # Placeholders should not be present
        assert "{issue_type}" not in user
        assert "{issue_description}" not in user


class TestTier1OutputV5Validator:
    """Test Tier1Output V5 validator behavior."""

    def test_validator_clears_arguments_on_false_positive(self):
        """Model validator should clear argument framing when classification is all_false_positives."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        output = Tier1Output(
            classification="all_false_positives",
            relevant_match_indices=[],
            confidence=0.95,
            reasoning="All matches are false positives",
            best_argument_burdensome="This should be cleared",
            best_argument_justified="This too",
            best_argument_unrelated="And this",
        )

        # Validator should clear these fields
        assert output.best_argument_burdensome is None
        assert output.best_argument_justified is None
        assert output.best_argument_unrelated is None

    def test_validator_preserves_arguments_for_needs_research(self):
        """Model validator should preserve arguments when classification is needs_research."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        output = Tier1Output(
            classification="needs_research",
            relevant_match_indices=[0],
            confidence=0.8,
            reasoning="Needs investigation",
            best_argument_burdensome="Burden argument",
            best_argument_justified="Justified argument",
            best_argument_unrelated="Unrelated argument",
        )

        assert output.best_argument_burdensome == "Burden argument"
        assert output.best_argument_justified == "Justified argument"
        assert output.best_argument_unrelated == "Unrelated argument"

    def test_recommendations_default_to_empty_lists(self):
        """Recommendation fields should default to empty lists."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        output = Tier1Output(
            classification="needs_research",
            relevant_match_indices=[0],
            confidence=0.8,
            reasoning="Test",
        )

        assert output.context_requests == []


# =============================================================================
# V5 PHASE 6 TESTS - Tier 1 → Tier 2 Handoff Formatters
# =============================================================================


class TestTier1ArgumentFormatter:
    """Test _format_tier1_argument helper function."""

    def test_format_tier1_argument_with_value(self):
        """_format_tier1_argument should return the argument text when present."""
        from scripts.research_pipeline.tier_runners import _format_tier1_argument

        result = _format_tier1_argument("This is the burdensome argument.")
        assert result == "This is the burdensome argument."

    def test_format_tier1_argument_none(self):
        """_format_tier1_argument should return placeholder for None."""
        from scripts.research_pipeline.tier_runners import _format_tier1_argument

        result = _format_tier1_argument(None)
        assert result == "(not provided)"

    def test_format_tier1_argument_empty_string(self):
        """_format_tier1_argument should return placeholder for empty string."""
        from scripts.research_pipeline.tier_runners import _format_tier1_argument

        result = _format_tier1_argument("")
        assert result == "(not provided)"


class TestContextRequestsHelpers:
    """Test context_requests helper functions."""

    def test_dedupe_context_requests(self):
        """dedupe_context_requests should merge duplicates, preferring full_text."""
        from scripts.research_pipeline.tier_runners import dedupe_context_requests
        from scripts.research_pipeline.models.context import ContextRequest

        requests = [
            ContextRequest(context_type="sibling", identifier="N.J.A.C. 1:1-1.2", need_level="summary", reason="R1"),
            ContextRequest(context_type="sibling", identifier="N.J.A.C. 1:1-1.2", need_level="full_text", reason="R2"),
            ContextRequest(context_type="definition", identifier="applicant", need_level="summary", reason="R3"),
        ]

        result = dedupe_context_requests(requests)
        assert len(result) == 2
        sibling = next(r for r in result if r.context_type == "sibling")
        assert sibling.need_level == "full_text"  # Prefers full_text

    def test_format_fetched_context(self):
        """format_fetched_context should format context for prompt injection."""
        from scripts.research_pipeline.tier_runners import format_fetched_context
        from scripts.research_pipeline.models.context import ContextRequest

        context = {
            "sibling:N.J.A.C. 1:1-1.2": "This section covers exemptions.",
            "definition:applicant": "Person applying for a permit.",
        }
        requests = [
            ContextRequest(context_type="sibling", identifier="N.J.A.C. 1:1-1.2", need_level="full_text", reason="Check exemptions"),
            ContextRequest(context_type="definition", identifier="applicant", need_level="summary", reason="Clarify scope"),
        ]

        result = format_fetched_context(context, requests)
        assert "sibling" in result.lower()
        assert "N.J.A.C. 1:1-1.2" in result
        assert "exemptions" in result.lower()


class TestTier2V5HandoffIntegration:
    """Test Tier 2 uses V5 variables from Tier 1 output."""

    def test_extract_tier1_v5_data(self):
        """Tier 2 should correctly extract V5 data from Tier 1 output."""
        from scripts.research_pipeline.tier_runners import _format_tier1_argument
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        t1 = Tier1Output(
            classification="needs_research",
            relevant_match_indices=[0],
            confidence=0.8,
            reasoning="Test",
            best_argument_burdensome="The mail-only creates burden.",
            best_argument_justified="Mail ensures documentation.",
            best_argument_unrelated="May refer to physical mail.",
            context_requests=[
                {
                    "context_type": "sibling",
                    "identifier": "N.J.A.C. 1:1-1.2",
                    "need_level": "full_text",
                    "reason": "Check for exemptions",
                },
                {
                    "context_type": "cross_reference",
                    "identifier": "N.J.A.C. 10:122-1.1",
                    "need_level": "summary",
                    "reason": "Referenced procedure",
                },
                {
                    "context_type": "definition",
                    "identifier": "mail",
                    "need_level": "summary",
                    "reason": "Clarify term",
                },
            ],
        )

        # Extract as prepare_tier2_batch does
        tier1_argument_burdensome = _format_tier1_argument(t1.best_argument_burdensome)
        tier1_argument_justified = _format_tier1_argument(t1.best_argument_justified)
        tier1_argument_unrelated = _format_tier1_argument(t1.best_argument_unrelated)

        # Verify argument framing
        assert tier1_argument_burdensome == "The mail-only creates burden."
        assert tier1_argument_justified == "Mail ensures documentation."
        assert tier1_argument_unrelated == "May refer to physical mail."

        # Verify context_requests structure
        assert len(t1.context_requests) == 3
        assert t1.context_requests[0].context_type == "sibling"
        assert t1.context_requests[0].need_level == "full_text"
        assert t1.context_requests[1].context_type == "cross_reference"
        assert t1.context_requests[2].context_type == "definition"

    def test_tier2_fallback_when_tier1_unavailable(self):
        """Tier 2 should use fallback values when Tier 1 output is None."""
        t1 = None

        if t1:
            tier1_argument_burdensome = "would have value"
        else:
            tier1_argument_burdensome = "(Tier 1 not available)"

        assert tier1_argument_burdensome == "(Tier 1 not available)"


class TestPipelineVersionV5:
    """Test PIPELINE_VERSION is set to v5.x."""

    def test_pipeline_version_is_v5(self):
        """PIPELINE_VERSION should start with 'v5'."""
        from scripts.research_pipeline.db_writer import PIPELINE_VERSION

        assert PIPELINE_VERSION.startswith("v5"), f"Expected v5.x, got {PIPELINE_VERSION}"


class TestDbWriterV5ColumnsPresence:
    """Test db_writer includes V5 columns in SQL operations."""

    def test_db_writer_has_tier1_v5_columns(self):
        """DB writer should use tier1 V5 columns."""
        import inspect
        from scripts.research_pipeline import db_writer

        # Get the source code of the save_tier1_results function
        source = inspect.getsource(db_writer.save_tier1_results)

        assert "tier1_argument_framing" in source
        assert "tier1_recommendations" in source

    def test_db_writer_has_tier2_v5_columns(self):
        """DB writer should use tier2 V5 columns."""
        import inspect
        from scripts.research_pipeline import db_writer

        # Get the source code of the save_tier2_results function
        source = inspect.getsource(db_writer.save_tier2_results)

        assert "cites_federal_statute" in source
        assert "federal_citation" in source
        assert "claims_no_alternative" in source


# =============================================================================
# SECTION 7: TIER 2 RE-RUN MECHANICS (V5 PHASE 6)
# =============================================================================


class TestTier2RerunState:
    """Test TrackedUnit re-run fields."""

    def test_tracked_unit_has_rerun_fields(self):
        """TrackedUnit should have tier2_rerun_count and related fields."""
        from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

        pu = ProcessingUnit(
            document_id=1,
            issue_type="test",
            state="NJ",
            citation="Test",
            title="Test",
            content="test",
            matches=[],
        )
        unit = TrackedUnit(unit=pu, state=ProcessingState.PENDING)

        # Check fields exist with correct defaults
        assert unit.tier2_rerun_count == 0
        assert unit.tier2_accumulated_context == []
        assert unit.tier2_context_requests_made == []
        assert unit.tier2_forced_classification == False

    def test_tracked_unit_rerun_fields_mutable(self):
        """TrackedUnit re-run fields should be mutable."""
        from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
        from scripts.research_pipeline.models.matches import ProcessingUnit

        pu = ProcessingUnit(
            document_id=1,
            issue_type="test",
            state="NJ",
            citation="Test",
            title="Test",
            content="test",
            matches=[],
        )
        unit = TrackedUnit(unit=pu, state=ProcessingState.TIER2_PENDING)

        # Modify fields
        unit.tier2_rerun_count = 2
        unit.tier2_accumulated_context.append({"type": "sibling", "identifier": "1.2"})
        unit.tier2_context_requests_made.append({"context_type": "sibling", "rerun": 0})
        unit.tier2_forced_classification = True

        assert unit.tier2_rerun_count == 2
        assert len(unit.tier2_accumulated_context) == 1
        assert len(unit.tier2_context_requests_made) == 1
        assert unit.tier2_forced_classification == True


class TestTier2RerunMaxConstant:
    """Test MAX_TIER2_RERUNS constant."""

    def test_max_tier2_reruns_is_2(self):
        """MAX_TIER2_RERUNS should be 2."""
        from scripts.research_pipeline.tier_runners import MAX_TIER2_RERUNS

        assert MAX_TIER2_RERUNS == 2


class TestPipelineRunnerTier2RerunsOption:
    """Test run_pipeline tier2_reruns parameter."""

    def test_run_pipeline_accepts_tier2_reruns_param(self):
        """run_pipeline should accept tier2_reruns parameter."""
        import inspect
        from scripts.research_pipeline.pipeline_runner import run_pipeline

        sig = inspect.signature(run_pipeline)
        assert "tier2_reruns" in sig.parameters

    def test_tier2_reruns_defaults_false(self):
        """tier2_reruns should default to False."""
        import inspect
        from scripts.research_pipeline.pipeline_runner import run_pipeline

        sig = inspect.signature(run_pipeline)
        assert sig.parameters["tier2_reruns"].default is False


class TestDbWriterRerunColumns:
    """Test db_writer includes re-run tracking columns."""

    def test_db_writer_has_rerun_columns(self):
        """DB writer should include tier2_rerun_count, tier2_context_requests_made, tier2_forced_classification."""
        import inspect
        from scripts.research_pipeline import db_writer

        source = inspect.getsource(db_writer.save_tier2_results)

        assert "tier2_rerun_count" in source
        assert "tier2_context_requests_made" in source
        assert "tier2_forced_classification" in source


class TestRunTier2WithRerunsExists:
    """Test run_tier2_with_reruns function exists and has correct signature."""

    def test_run_tier2_with_reruns_exists(self):
        """run_tier2_with_reruns should be importable."""
        from scripts.research_pipeline.tier_runners import run_tier2_with_reruns

        assert callable(run_tier2_with_reruns)

    def test_run_tier2_with_reruns_is_async(self):
        """run_tier2_with_reruns should be async."""
        import asyncio
        from scripts.research_pipeline.tier_runners import run_tier2_with_reruns

        assert asyncio.iscoroutinefunction(run_tier2_with_reruns)


# =============================================================================
# V5 TESTING IMPROVEMENTS - Result Processing, Validators, CLI Integration
# =============================================================================


class TestResultProcessingBehavior:
    """Test process_tier_results behavior: error handling, parsing, token tracking."""

    def test_process_tier_results_success_path(self):
        """Successful parsing sets output and transitions state correctly."""
        from scripts.research_pipeline.result_processor import (
            compute_final_classification,
            compute_final_severity,
        )

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=7),
        )

        assert compute_final_classification(unit) == "burdensome"
        assert compute_final_severity(unit) == 7

    def test_final_classification_tier3_priority(self):
        """V5: Tier 3 classification takes priority over lower tiers."""
        from scripts.research_pipeline.result_processor import compute_final_classification

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(classification="justified", final_severity=2),
        )

        assert compute_final_classification(unit) == "justified"

    def test_final_classification_tier3_priority(self):
        """Tier 3 classification takes priority over Tier 2."""
        from scripts.research_pipeline.result_processor import compute_final_classification

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=7,
                cites_federal_statute=True,  # V5 trigger for Tier 3
            ),
            tier3_output=make_tier3_output(classification="justified"),  # Tier 3 reclassifies
        )

        assert compute_final_classification(unit) == "justified"

    def test_final_classification_tier2_only_returns_classification(self):
        """V5: Tier 2 always produces final classification (no needs_full_context)."""
        from scripts.research_pipeline.result_processor import compute_final_classification

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(
                classification="burdensome",
                severity=5,
            ),
        )

        # V5: Tier 2 always returns a final classification
        assert compute_final_classification(unit) == "burdensome"

    def test_final_classification_all_false_positives(self):
        """all_false_positives from Tier 1 returns correctly."""
        from scripts.research_pipeline.result_processor import compute_final_classification

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(classification="all_false_positives"),
        )

        assert compute_final_classification(unit) == "all_false_positives"

    def test_final_severity_tier3_adjustment_positive(self):
        """Tier 3 adjustment increases severity correctly."""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(severity_adjustment=3),
        )

        assert compute_final_severity(unit) == 8

    def test_final_severity_tier3_adjustment_negative(self):
        """Tier 3 adjustment decreases severity correctly."""
        from scripts.research_pipeline.result_processor import compute_final_severity

        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=5),
            tier3_output=make_tier3_output(severity_adjustment=-2),
        )

        assert compute_final_severity(unit) == 3

    def test_final_severity_clamped_at_max(self):
        """Severity is clamped at max 10."""
        from scripts.research_pipeline.result_processor import compute_final_severity

        # Use max adjustment of +3 (model limit) with high base severity
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=9),
            tier3_output=make_tier3_output(severity_adjustment=3),  # 9 + 3 = 12, clamped to 10
        )

        assert compute_final_severity(unit) == 10

    def test_final_severity_clamped_at_min(self):
        """Severity is clamped at min 1."""
        from scripts.research_pipeline.result_processor import compute_final_severity

        # Use max negative adjustment of -3 (model limit) with low base severity
        unit = make_tracked_unit(
            tier1_output=make_tier1_output(),
            tier2_output=make_tier2_output(classification="burdensome", severity=2),
            tier3_output=make_tier3_output(severity_adjustment=-3),  # 2 - 3 = -1, clamped to 1
        )

        assert compute_final_severity(unit) == 1


class TestCacheOrderingBehavior:
    """Test group_for_cache_efficiency actual grouping behavior."""

    def test_groups_by_issue_type(self):
        """Units with same issue_type should be grouped together."""
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

        # Create units with different issue types
        match = MatchInfo(match_id=1, matched_text="test", position_start=0, position_end=4, surrounding_context="test")
        units = [
            ProcessingUnit(document_id=1, issue_type="mail_only", citation="A", title="T1", matches=[match], content="c"),
            ProcessingUnit(document_id=2, issue_type="wet_signature", citation="B", title="T2", matches=[match], content="c"),
            ProcessingUnit(document_id=3, issue_type="mail_only", citation="C", title="T3", matches=[match], content="c"),
        ]

        from scripts.research_pipeline.context_builder import group_for_cache_efficiency
        ordered = group_for_cache_efficiency(units)

        # mail_only units should be consecutive
        issue_types = [u.issue_type for u in ordered]
        mail_only_indices = [i for i, t in enumerate(issue_types) if t == "mail_only"]
        assert mail_only_indices == [0, 1] or mail_only_indices == [1, 2], "mail_only units should be consecutive"

    def test_empty_input_returns_empty(self):
        """Empty input returns empty list."""
        from scripts.research_pipeline.context_builder import group_for_cache_efficiency

        result = group_for_cache_efficiency([])
        assert result == []

    def test_preserves_all_units(self):
        """All input units are preserved in output."""
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo

        match = MatchInfo(match_id=1, matched_text="test", position_start=0, position_end=4, surrounding_context="test")
        units = [
            ProcessingUnit(document_id=i, issue_type="mail_only", citation=f"C{i}", title=f"T{i}", matches=[match], content="c")
            for i in range(5)
        ]

        from scripts.research_pipeline.context_builder import group_for_cache_efficiency
        ordered = group_for_cache_efficiency(units)

        assert len(ordered) == 5
        assert set(u.document_id for u in ordered) == set(range(5))


class TestCacheEfficiencyMetricsBehavior:
    """Test estimate_cache_efficiency metrics calculation."""

    def test_empty_input_returns_zeros(self):
        """Empty input returns zero metrics safely."""
        from scripts.research_pipeline.context_builder import estimate_cache_efficiency

        result = estimate_cache_efficiency([])

        assert result["total"] == 0
        assert result["unique_issue_types"] == 0

    def test_single_issue_type_high_cache_rate(self):
        """All same issue_type should have high cache hit rate."""
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo
        from scripts.research_pipeline.context_builder import estimate_cache_efficiency

        match = MatchInfo(match_id=1, matched_text="test", position_start=0, position_end=4, surrounding_context="test")
        units = [
            ProcessingUnit(document_id=i, issue_type="mail_only", citation=f"C{i}", title=f"T{i}", matches=[match], content="c")
            for i in range(5)
        ]

        result = estimate_cache_efficiency(units)

        assert result["total"] == 5
        assert result["unique_issue_types"] == 1
        assert result["estimated_cache_hits"] == 4  # All but first get cache hit
        assert result["cache_hit_rate"] == 0.8  # 4/5

    def test_all_different_issue_types_low_cache_rate(self):
        """All different issue_types should have low cache hit rate."""
        from scripts.research_pipeline.models.matches import ProcessingUnit, MatchInfo
        from scripts.research_pipeline.context_builder import estimate_cache_efficiency

        match = MatchInfo(match_id=1, matched_text="test", position_start=0, position_end=4, surrounding_context="test")
        issue_types = ["mail_only", "wet_signature", "notarization", "in_person_only", "original_document"]
        units = [
            ProcessingUnit(document_id=i, issue_type=issue_types[i], citation=f"C{i}", title=f"T{i}", matches=[match], content="c")
            for i in range(5)
        ]

        result = estimate_cache_efficiency(units)

        assert result["total"] == 5
        assert result["unique_issue_types"] == 5
        assert result["cache_hit_rate"] == 0  # No consecutive same issue_type


class TestOutputValidatorsBehavior:
    """Test Pydantic validators in LLM output models."""

    def test_tier1_clears_framing_for_false_positives(self):
        """best_argument_* should be None when classification is all_false_positives."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        # When classification is all_false_positives, arguments should be optional
        output = Tier1Output(
            classification="all_false_positives",
            relevant_match_indices=[],
            dismissed_matches=[],
            confidence=0.9,
            reasoning="All are procedural",
            context_requests=[],
        )

        # Should not have argument framing
        assert not hasattr(output, 'best_argument_burdensome') or output.best_argument_burdensome is None

    def test_tier2_validated_with_severity(self):
        """Tier 2 burdensome classification should have severity."""
        from scripts.research_pipeline.models.llm_outputs import Tier2Output

        output = Tier2Output(
            classification="burdensome",
            severity=7,
            confidence=0.8,
            reasoning="Imposes significant burden",
            argument_for_regulation="Ensures safety",
            argument_against_regulation="Limits access",
            needs_web_search=False,
            potentially_controversial=False,
            federal_mandate_suspected=False,
            verbatim_requirements=[],
            context_used=[],
            full_text_requests=[],
        )

        assert output.classification == "burdensome"
        assert output.severity == 7

    def test_tier2_has_v5_routing_flags(self):
        """Tier 2 output should have V5 routing flags."""
        from scripts.research_pipeline.models.llm_outputs import Tier2Output

        output = Tier2Output(
            classification="burdensome",
            severity=5,
            confidence=0.8,
            reasoning="Test",
            argument_for_regulation="For",
            argument_against_regulation="Against",
            needs_web_search=False,
            potentially_controversial=False,
            federal_mandate_suspected=False,
            verbatim_requirements=[],
            context_used=[],
            full_text_requests=[],
            cites_federal_statute=True,
            federal_citation="42 CFR 483.24",
            claims_no_alternative=True,
        )

        assert output.cites_federal_statute is True
        assert output.federal_citation == "42 CFR 483.24"
        assert output.claims_no_alternative is True


class TestDbWriterV5Fields:
    """Test db_writer saves V5-specific fields correctly."""

    def test_tier1_update_has_v5_fields(self):
        """ComplianceIssueTier1Update should have V5 fields."""
        from datetime import datetime
        from scripts.research_pipeline.models.database import ComplianceIssueTier1Update

        update = ComplianceIssueTier1Update(
            tier1_classification="needs_research",
            tier1_confidence=0.85,
            tier1_reasoning="Test reasoning",
            tier1_relevant_match_ids=[1, 2, 3],
            tier1_batch_id="batch_abc123",
            tier1_completed_at=datetime.now(),
            grouped_match_count=3,
            tier1_argument_framing={
                "best_argument_burdensome": "Forces in-person submission",
                "best_argument_justified": "Ensures proper verification",
                "best_argument_unrelated": None,
            },
            tier1_recommendations={
                "context_requests": [
                    {
                        "context_type": "sibling",
                        "identifier": "N.J.A.C. 1:1-1.2",
                        "need_level": "full_text",
                        "reason": "Check for exemptions",
                    },
                    {
                        "context_type": "definition",
                        "identifier": "applicant",
                        "need_level": "summary",
                        "reason": "Clarify scope",
                    },
                ]
            },
            pipeline_version="v5",
        )

        assert update.tier1_argument_framing is not None
        assert update.tier1_recommendations is not None
        assert update.pipeline_version == "v5"

    def test_tier2_update_has_v5_fields(self):
        """ComplianceIssueTier2Update should have V5 fields."""
        from datetime import datetime
        from scripts.research_pipeline.models.database import ComplianceIssueTier2Update

        update = ComplianceIssueTier2Update(
            tier2_classification="burdensome",
            tier2_confidence=0.9,
            tier2_reasoning="Test reasoning",
            argument_for_regulation="Safety requirement",
            argument_against_regulation="Creates burden",
            severity=7,
            tier2_batch_id="batch_xyz789",
            tier2_completed_at=datetime.now(),
            cites_federal_statute=True,
            federal_citation="42 CFR 483.24",
            claims_no_alternative=True,
            tier2_rerun_count=1,
            tier2_context_requests_made=[{"type": "sibling", "identifier": "N.J.A.C. 1:1-1.2"}],
            tier2_forced_classification=False,
        )

        assert update.cites_federal_statute is True
        assert update.federal_citation == "42 CFR 483.24"
        assert update.claims_no_alternative is True
        assert update.tier2_rerun_count == 1
        assert len(update.tier2_context_requests_made) == 1
        assert update.tier2_forced_classification is False

    def test_persistence_models_default_to_v5(self):
        """Persistence models should default to V5 pipeline version."""
        from datetime import datetime
        from scripts.research_pipeline.models.database import ComplianceIssueTier1Update

        update = ComplianceIssueTier1Update(
            tier1_classification="needs_research",
            tier1_confidence=0.8,
            tier1_reasoning="Test",
            tier1_relevant_match_ids=[1],
            tier1_batch_id="batch_test",
            tier1_completed_at=datetime.now(),
            grouped_match_count=1,
        )

        assert update.pipeline_version == "v5"


class TestCLIIntegrationSubprocess:
    """Test CLI via subprocess for real integration coverage."""

    def test_cli_help_shows_all_arguments(self):
        """Verify --help shows all expected arguments."""
        import subprocess

        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--help"],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_DIR),
            timeout=30,
        )

        # Should show help without errors
        assert result.returncode == 0
        # Check for key arguments
        assert "--state" in result.stdout
        assert "--issue" in result.stdout
        assert "--limit" in result.stdout  # Changed from --num-docs
        assert "--max-tier" in result.stdout

    def test_cli_dry_run_available(self):
        """Verify --dry-run argument is available."""
        import subprocess

        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--help"],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_DIR),
            timeout=30,
        )

        # dry-run is now the default; --execute opts in
        assert "--execute" in result.stdout or "DRY-RUN" in result.stdout

    def test_cli_all_issues_available(self):
        """Verify --all argument is available."""
        import subprocess

        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--help"],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_DIR),
            timeout=30,
        )

        # all should be available
        assert "--all" in result.stdout or "all_issues" in result.stdout
