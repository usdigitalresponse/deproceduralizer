"""Tests for context_registry module."""

import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


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
