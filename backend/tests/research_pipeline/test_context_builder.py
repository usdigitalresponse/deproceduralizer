"""
Context builder tests for the V5 research pipeline.

Tests:
- ContextRegistry class (deduplication, content levels, rendering)
- Context builder helper functions (is_excludable, get_keyword_category, etc.)
- Cache efficiency ordering
- Format proactive context
"""

import pytest


class TestContextRegistry:
    """Test ContextRegistry class - pure Python, no DB."""

    def test_add_context(self):
        """Adding context should return True and increase count."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()

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
        """mark_used should set relevance on context item."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        registry.add_context("definition", "applicant", content="A person")

        found = registry.mark_used("applicant", "Clarifies scope")
        assert found is True

        item = registry.get_item("applicant")
        assert item.relevance == "Clarifies scope"

    def test_mark_used_not_found(self):
        """mark_used should return False for nonexistent items."""
        from scripts.research_pipeline.context_registry import ContextRegistry

        registry = ContextRegistry()
        found = registry.mark_used("nonexistent", "reason")
        assert found is False

    def test_get_used_items(self):
        """get_used_items should return only items marked as used."""
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
        """to_context_used should return proper JSON structure."""
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


class TestContextBuilderImports:
    """Test context_builder imports without database."""

    def test_batch_functions_handle_empty_inputs(self):
        """All batch functions should handle empty inputs gracefully."""
        from scripts.research_pipeline.context_builder import (
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


class TestIsExcludable:
    """Test is_excludable helper function."""

    def test_excludable_definitions(self):
        """is_excludable should exclude definition sections."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Definitions") is True
        assert is_excludable("Defined Terms") is True
        assert is_excludable("Section 1.1 Definitions") is True

    def test_excludable_toc(self):
        """is_excludable should exclude table of contents."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Table of Contents") is True
        assert is_excludable("Contents") is True

    def test_excludable_reserved(self):
        """is_excludable should exclude reserved/repealed sections."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Reserved") is True
        assert is_excludable("Repealed") is True

    def test_excludable_appendix(self):
        """is_excludable should exclude appendices."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("Appendix A") is True
        assert is_excludable("Appendices") is True

    def test_excludable_empty(self):
        """is_excludable should exclude empty/None titles."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("") is True
        assert is_excludable(None) is True

    def test_excludable_normal_titles(self):
        """is_excludable should NOT exclude normal section titles."""
        from scripts.research_pipeline.context_builder import is_excludable

        assert is_excludable("License Requirements") is False
        assert is_excludable("Exemptions") is False
        assert is_excludable("Electronic Submission") is False
        assert is_excludable("Application Procedures") is False


class TestGetKeywordCategory:
    """Test get_keyword_category helper function."""

    def test_exemption_keywords(self):
        """get_keyword_category should return 'exemption' for exemption keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Exemptions") == "exemption"
        assert get_keyword_category("Waiver Provisions") == "exemption"
        assert get_keyword_category("Exceptions to Requirements") == "exemption"
        assert get_keyword_category("This does not apply to...") == "exemption"

    def test_alternatives_keywords(self):
        """get_keyword_category should return 'alternatives' for alternative keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Electronic Submission") == "alternatives"
        assert get_keyword_category("Online Application") == "alternatives"
        assert get_keyword_category("Digital Procedures") == "alternatives"
        assert get_keyword_category("Remote Processing") == "alternatives"
        assert get_keyword_category("Alternative Methods") == "alternatives"

    def test_scope_keywords(self):
        """get_keyword_category should return 'scope' for scope keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Applicability") == "scope"
        assert get_keyword_category("Scope of Regulations") == "scope"
        assert get_keyword_category("General Provisions") == "scope"
        assert get_keyword_category("Purpose") == "scope"

    def test_enforcement_keywords(self):
        """get_keyword_category should return 'enforcement' for enforcement keywords."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("Enforcement") == "enforcement"
        assert get_keyword_category("Penalty Provisions") == "enforcement"
        assert get_keyword_category("Violations") == "enforcement"
        assert get_keyword_category("Fines and Sanctions") == "enforcement"

    def test_priority_when_multiple_match(self):
        """get_keyword_category should return highest priority category when multiple match."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        # "Electronic Exemptions" matches both exemption and alternatives
        # exemption has higher priority
        assert get_keyword_category("Electronic Exemptions") == "exemption"

    def test_none_for_non_matching(self):
        """get_keyword_category should return None for non-matching titles."""
        from scripts.research_pipeline.context_builder import get_keyword_category

        assert get_keyword_category("License Requirements") is None
        assert get_keyword_category("Fee Schedule") is None
        assert get_keyword_category(None) is None
        assert get_keyword_category("") is None


class TestGetSummaryOrFallback:
    """Test get_summary_or_fallback helper function."""

    def test_uses_summary_when_available(self):
        """get_summary_or_fallback should use summary when available."""
        from scripts.research_pipeline.context_builder import get_summary_or_fallback

        text, is_fallback = get_summary_or_fallback(
            summary="A proper summary of the section.",
            content="Full content here that is much longer...",
            title="Section Title",
        )

        assert text == "A proper summary of the section."
        assert is_fallback is False

    def test_uses_content_excerpt_when_no_summary(self):
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

    def test_uses_title_when_no_summary_or_content(self):
        """get_summary_or_fallback should use title when no summary or content."""
        from scripts.research_pipeline.context_builder import get_summary_or_fallback

        text, is_fallback = get_summary_or_fallback(
            summary=None,
            content="",  # Empty content
            title="Section Title Here",
        )

        assert text == "[Title only]: Section Title Here"
        assert is_fallback is True

    def test_ignores_short_summary(self):
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


class TestCacheEfficiencyOrdering:
    """Test cache efficiency ordering functions."""

    def test_group_for_cache_efficiency_import(self):
        """Ensure group_for_cache_efficiency is importable."""
        from scripts.research_pipeline.pipeline_runner import _sort_for_cache_efficiency
        from scripts.research_pipeline.context_builder import group_for_cache_efficiency

        assert _sort_for_cache_efficiency is not None
        assert group_for_cache_efficiency is not None


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


class TestPrioritizeSummaries:
    """Test prioritize_summaries function."""

    def test_includes_preceding(self):
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

    def test_includes_following(self):
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

        # Should include following sibling
        assert len(items) >= 1
        assert any(item[2] == "following" for item in items)
