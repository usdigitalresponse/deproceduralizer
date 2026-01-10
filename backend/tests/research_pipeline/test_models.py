"""
Model tests for the V5 research pipeline.

Tests Pydantic models for:
- Context models (SiblingEntry, CrossRefEntry, ContextCatalog, etc.)
- LLM output schemas (Tier1Output, Tier2Output, Tier3Output)
- Persistence models (ComplianceIssueTier*Update)
- Model validators behavior
"""

import pytest
from datetime import datetime


class TestContextModels:
    """Test context model imports and basic functionality."""

    def test_import_all_context_models(self):
        """All context models should be importable."""
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

    def test_import_match_models(self):
        """All match models should be importable."""
        from scripts.research_pipeline.models.matches import (
            MatchInfo,
            DismissedMatch,
            ProcessingUnit,
        )

        assert MatchInfo is not None
        assert ProcessingUnit is not None


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


class TestLLMOutputSchemaV5:
    """Test that LLM output models have required V5 fields.

    These tests prevent schema drift between prompts and models.
    """

    def test_tier1_output_has_v5_fields(self):
        """Tier1Output should have V5 argument framing and recommendation fields."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

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

    def test_tier3_output_has_v5_fields(self):
        """Tier3Output should have V5 web search and evidence fields."""
        from scripts.research_pipeline.models.llm_outputs import Tier3Output

        fields = Tier3Output.model_fields

        # Web search fields
        assert "web_search_summary" in fields
        assert "final_severity" in fields
        assert "severity_adjustment" in fields

        # Evidence flags
        assert "federal_mandate_found" in fields
        assert "state_has_discretion" in fields

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
        assert output.context_requests[0].identifier == "N.J.A.C. 1:1-1.2"

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


class TestTier1OutputValidators:
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

    def test_context_requests_default_to_empty_list(self):
        """Context requests should default to empty list."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        output = Tier1Output(
            classification="needs_research",
            relevant_match_indices=[0],
            confidence=0.8,
            reasoning="Test",
        )

        assert output.context_requests == []


class TestTier2OutputValidators:
    """Test Tier2Output validator behavior."""

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

    def test_justified_defaults_severity_to_1(self):
        """Tier 2 justified classification should default severity to 1 if omitted."""
        from scripts.research_pipeline.models.llm_outputs import Tier2Output

        output = Tier2Output(
            classification="justified",
            confidence=0.8,
            reasoning="Justified requirement",
            argument_for_regulation="Safety requirement",
            argument_against_regulation="Could be burdensome",
        )

        # Validator should default severity to 1 for justified
        assert output.severity == 1


class TestDbWriterV5Fields:
    """Test db_writer saves V5-specific fields correctly."""

    def test_tier1_update_construction(self):
        """ComplianceIssueTier1Update should construct with V5 fields."""
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

    def test_tier2_update_construction(self):
        """ComplianceIssueTier2Update should construct with V5 fields."""
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
