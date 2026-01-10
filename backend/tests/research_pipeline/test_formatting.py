"""
Unit tests for the formatting module.

These tests verify the formatting functions work correctly for prompt generation.
"""

import pytest


class TestFormatItemList:
    """Test the generic format_item_list function."""

    def test_empty_list(self):
        from scripts.research_pipeline.formatting import format_item_list

        result = format_item_list(
            items=[],
            extract_fn=lambda x: x,
            empty_message="(none)"
        )
        assert result == "(none)"

    def test_single_item(self):
        from scripts.research_pipeline.formatting import format_item_list

        result = format_item_list(
            items=["item1"],
            extract_fn=lambda x: x,
        )
        assert result == "- item1"

    def test_multiple_items(self):
        from scripts.research_pipeline.formatting import format_item_list

        result = format_item_list(
            items=["item1", "item2", "item3"],
            extract_fn=lambda x: x,
        )
        assert "- item1" in result
        assert "- item2" in result
        assert "- item3" in result

    def test_custom_prefix(self):
        from scripts.research_pipeline.formatting import format_item_list

        result = format_item_list(
            items=["item1"],
            extract_fn=lambda x: x,
            prefix="* "
        )
        assert result == "* item1"

    def test_limit(self):
        from scripts.research_pipeline.formatting import format_item_list

        result = format_item_list(
            items=["a", "b", "c", "d", "e"],
            extract_fn=lambda x: x,
            limit=3,
        )
        assert "- a" in result
        assert "- b" in result
        assert "- c" in result
        assert "- d" not in result
        assert "2 more" in result

    def test_extract_fn(self):
        from scripts.research_pipeline.formatting import format_item_list

        items = [{"name": "foo"}, {"name": "bar"}]
        result = format_item_list(
            items=items,
            extract_fn=lambda x: x["name"],
        )
        assert "- foo" in result
        assert "- bar" in result


class TestFormatDefinitionTerms:
    """Test the format_definition_terms function."""

    def test_empty_terms(self):
        from scripts.research_pipeline.formatting import format_definition_terms

        result = format_definition_terms([])
        assert result == "(no applicable definitions)"

    def test_few_terms(self):
        from scripts.research_pipeline.formatting import format_definition_terms

        result = format_definition_terms(["term1", "term2", "term3"])
        assert result == "term1, term2, term3"

    def test_many_terms_truncated(self):
        from scripts.research_pipeline.formatting import format_definition_terms

        terms = [f"term{i}" for i in range(20)]
        result = format_definition_terms(terms, limit=15)
        assert "term0" in result
        assert "term14" in result
        assert "term15" not in result
        assert "5 more" in result


class TestFormatSiblingTitles:
    """Test the format_sibling_titles function."""

    def test_empty_siblings(self):
        from scripts.research_pipeline.formatting import format_sibling_titles

        result = format_sibling_titles([])
        assert result == "(none)"

    def test_with_siblings(self):
        from scripts.research_pipeline.formatting import format_sibling_titles
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="1.1", title="First"),
            SiblingEntry(document_id=2, citation="1.2", title="Second"),
        ]
        result = format_sibling_titles(siblings)
        assert "1.1: First" in result
        assert "1.2: Second" in result

    def test_untitled_sibling(self):
        from scripts.research_pipeline.formatting import format_sibling_titles
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = [
            SiblingEntry(document_id=1, citation="1.1", title=""),
        ]
        result = format_sibling_titles(siblings)
        assert "(untitled)" in result


class TestFormatCrossrefCitations:
    """Test the format_crossref_citations function."""

    def test_empty_crossrefs(self):
        from scripts.research_pipeline.formatting import format_crossref_citations

        result = format_crossref_citations([])
        assert result == "(none)"

    def test_with_crossrefs(self):
        from scripts.research_pipeline.formatting import format_crossref_citations
        from scripts.research_pipeline.models.context import CrossRefEntry

        crossrefs = [
            CrossRefEntry(target_id=1, citation="1.1", target_title="Target A"),
            CrossRefEntry(target_id=2, citation="1.2", target_title="Target B", is_definitions_section=True),
        ]
        result = format_crossref_citations(crossrefs)
        assert "1.1" in result
        assert "Target A" in result
        assert "[definitions]" in result


class TestFormatAncestorChain:
    """Test the format_ancestor_chain function."""

    def test_empty_ancestors(self):
        from scripts.research_pipeline.formatting import format_ancestor_chain

        result = format_ancestor_chain([])
        assert result == "(no ancestors)"

    def test_with_ancestors(self):
        from scripts.research_pipeline.formatting import format_ancestor_chain
        from scripts.research_pipeline.models.context import AncestorEntry

        ancestors = [
            AncestorEntry(document_id=1, citation="Title 1", title="Main Title", hierarchy_level="title"),
            AncestorEntry(document_id=2, citation="Chapter 2", title="Chapter", hierarchy_level="chapter"),
        ]
        result = format_ancestor_chain(ancestors)
        assert "[title]" in result
        assert "Title 1" in result
        assert "[chapter]" in result


class TestFormatCatalog:
    """Test the format_catalog function."""

    def test_empty_catalog(self):
        from scripts.research_pipeline.formatting import format_catalog

        result = format_catalog([])
        assert result == "(none)"

    def test_with_items(self):
        from scripts.research_pipeline.formatting import format_catalog
        from scripts.research_pipeline.models.context import SiblingEntry

        items = [
            SiblingEntry(document_id=1, citation="1.1", title="First"),
            SiblingEntry(document_id=2, citation="1.2", title="Second"),
        ]
        result = format_catalog(items)
        assert "- 1.1: First" in result
        assert "- 1.2: Second" in result


class TestFormatMatchesForTier1:
    """Test the format_matches_for_tier1 function."""

    def test_empty_matches(self):
        from scripts.research_pipeline.formatting import format_matches_for_tier1

        result = format_matches_for_tier1([])
        assert result == "(no matches)"

    def test_with_matches(self):
        from scripts.research_pipeline.formatting import format_matches_for_tier1
        from scripts.research_pipeline.models.matches import MatchInfo

        matches = [
            MatchInfo(
                matched_text="mail only",
                surrounding_context="...must be submitted via mail only...",
                position_start=100,
                position_end=109,
            ),
        ]
        result = format_matches_for_tier1(matches)
        assert "Match 0:" in result
        assert "mail only" in result
        assert "must be submitted" in result


class TestFormatMatchesForTier2:
    """Test the format_matches_for_tier2 function."""

    def test_empty_matches(self):
        from scripts.research_pipeline.formatting import format_matches_for_tier2

        result = format_matches_for_tier2([])
        assert result == "(no relevant matches)"

    def test_with_matches(self):
        from scripts.research_pipeline.formatting import format_matches_for_tier2
        from scripts.research_pipeline.models.matches import MatchInfo

        matches = [
            MatchInfo(
                matched_text="mail only",
                surrounding_context="context",
                position_start=100,
                position_end=109,
            ),
        ]
        result = format_matches_for_tier2(matches)
        assert "mail only" in result
        assert "position 100" in result


class TestFormatImmediateSiblings:
    """Test the format_immediate_siblings function."""

    def test_empty_siblings(self):
        from scripts.research_pipeline.formatting import format_immediate_siblings

        result = format_immediate_siblings({})
        assert result == "(no immediate siblings found)"

    def test_with_prev_only(self):
        from scripts.research_pipeline.formatting import format_immediate_siblings
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = {
            'prev': SiblingEntry(document_id=1, citation="1.0", title="Previous"),
        }
        result = format_immediate_siblings(siblings)
        assert "Previous Section:" in result
        assert "1.0" in result

    def test_with_both(self):
        from scripts.research_pipeline.formatting import format_immediate_siblings
        from scripts.research_pipeline.models.context import SiblingEntry

        siblings = {
            'prev': SiblingEntry(document_id=1, citation="1.0", title="Previous"),
            'next': SiblingEntry(document_id=2, citation="1.2", title="Next"),
        }
        result = format_immediate_siblings(siblings)
        assert "Previous Section:" in result
        assert "Next Section:" in result


class TestFormatDefinitions:
    """Test the format_definitions function."""

    def test_empty_definitions(self):
        from scripts.research_pipeline.formatting import format_definitions

        result = format_definitions([])
        assert result == "(no applicable definitions)"

    def test_with_definitions(self):
        from scripts.research_pipeline.formatting import format_definitions

        definitions = [
            {"term": "applicant", "verbatim_text": "A person who applies"},
            {"term": "permit", "rephrased_definition": "An official document"},
        ]
        result = format_definitions(definitions)
        assert "**applicant**:" in result
        assert "A person who applies" in result
        assert "**permit**:" in result
        assert "An official document" in result


class TestFormatFetchedContext:
    """Test the format_fetched_context function."""

    def test_empty_context(self):
        from scripts.research_pipeline.formatting import format_fetched_context

        result = format_fetched_context({}, [])
        assert result == "(no additional context fetched)"

    def test_with_context(self):
        from scripts.research_pipeline.formatting import format_fetched_context
        from scripts.research_pipeline.models.context import ContextRequest

        context = {"N.J.A.C. 1:1-1.1": "Summary of section"}
        requests = [
            ContextRequest(
                context_type="sibling",
                identifier="N.J.A.C. 1:1-1.1",
                need_level="summary",
                reason="Check for exemptions",
            )
        ]
        result = format_fetched_context(context, requests)
        assert "Siblings" in result
        assert "N.J.A.C. 1:1-1.1" in result
        assert "[summary]" in result
        assert "Check for exemptions" in result


class TestFormatTier1Argument:
    """Test the format_tier1_argument function."""

    def test_none_argument(self):
        from scripts.research_pipeline.formatting import format_tier1_argument

        result = format_tier1_argument(None)
        assert result == "(not provided)"

    def test_empty_argument(self):
        from scripts.research_pipeline.formatting import format_tier1_argument

        result = format_tier1_argument("")
        assert result == "(not provided)"

    def test_with_argument(self):
        from scripts.research_pipeline.formatting import format_tier1_argument

        result = format_tier1_argument("This is a compelling argument")
        assert result == "This is a compelling argument"


class TestFormatSiblingSummaries:
    """Test the format_sibling_summaries function."""

    def test_empty_summaries(self):
        from scripts.research_pipeline.formatting import format_sibling_summaries

        result = format_sibling_summaries([])
        assert result == "(none pre-fetched)"

    def test_with_summaries(self):
        from scripts.research_pipeline.formatting import format_sibling_summaries
        from scripts.research_pipeline.models.context import SiblingSummary

        summaries = [
            SiblingSummary(
                document_id=1,
                citation="1.1",
                title="Exemptions",
                summary="Describes exemption conditions",
                reason="keyword",
                keyword_category="exemption",
            ),
        ]
        result = format_sibling_summaries(summaries)
        assert "1.1" in result
        assert "[keyword: exemption]" in result
        assert "Describes exemption conditions" in result

    def test_filter_by_reason(self):
        from scripts.research_pipeline.formatting import format_sibling_summaries
        from scripts.research_pipeline.models.context import SiblingSummary

        summaries = [
            SiblingSummary(
                document_id=1,
                citation="1.1",
                title="Exemptions",
                summary="Describes exemption conditions",
                reason="keyword",
                keyword_category="exemption",
            ),
            SiblingSummary(
                document_id=2,
                citation="1.2",
                title="Other",
                summary="Something else",
                reason="preceding",  # Valid reason: preceding, following, or keyword
            ),
        ]
        result = format_sibling_summaries(summaries, filter_reason="keyword")
        assert "1.1" in result
        assert "1.2" not in result


class TestFormatCrossrefSummaries:
    """Test the format_crossref_summaries function."""

    def test_empty_summaries(self):
        from scripts.research_pipeline.formatting import format_crossref_summaries

        result = format_crossref_summaries([])
        assert result == "(none pre-fetched)"

    def test_with_summaries(self):
        from scripts.research_pipeline.formatting import format_crossref_summaries
        from scripts.research_pipeline.models.context import CrossRefSummary

        summaries = [
            CrossRefSummary(
                target_id=1,
                citation="1.1",
                target_title="Definitions",
                summary="Key terms defined here",
                keyword_category="definitions",
            ),
        ]
        result = format_crossref_summaries(summaries)
        assert "1.1" in result
        assert "Key terms defined here" in result


class TestFormatAncestorSummaries:
    """Test the format_ancestor_summaries function."""

    def test_empty_summaries(self):
        from scripts.research_pipeline.formatting import format_ancestor_summaries

        result = format_ancestor_summaries([])
        assert result == "(no ancestors)"

    def test_with_summaries(self):
        from scripts.research_pipeline.formatting import format_ancestor_summaries
        from scripts.research_pipeline.models.context import AncestorSummary

        summaries = [
            AncestorSummary(
                document_id=1,
                citation="Title 1",
                title="Main Title",
                summary="Overview of the title",
                hierarchy_level="title",
            ),
        ]
        result = format_ancestor_summaries(summaries)
        assert "[title]" in result
        assert "Title 1" in result
        assert "Overview of the title" in result


class TestFormatProactiveContext:
    """Test the format_proactive_context function."""

    def test_empty_context(self):
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import ProactiveTier1Context

        ctx = ProactiveTier1Context()
        result = format_proactive_context(ctx)
        assert result == ""

    def test_with_definition_terms(self):
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import ProactiveTier1Context

        ctx = ProactiveTier1Context(
            definition_terms=["applicant", "permit", "license"]
        )
        result = format_proactive_context(ctx)
        assert "## Available Definitions" in result
        assert "applicant" in result
        assert "permit" in result

    def test_with_sibling_catalog(self):
        from scripts.research_pipeline.formatting import format_proactive_context
        from scripts.research_pipeline.models.context import ProactiveTier1Context, SiblingEntry

        ctx = ProactiveTier1Context(
            sibling_catalog=[
                SiblingEntry(document_id=1, citation="1.1", title="First"),
                SiblingEntry(document_id=2, citation="1.2", title="Second"),
            ]
        )
        result = format_proactive_context(ctx)
        assert "## Available Siblings" in result
        assert "1.1: First" in result
