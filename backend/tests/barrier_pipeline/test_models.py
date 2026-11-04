"""Tests for Barrier LLM output models."""
import pytest

from scripts.barrier_pipeline.models.llm_outputs import AnalysisOutput, IssueFinding
from scripts.barrier_pipeline.config import BarrierCategory


class TestIssueFinding:
    def test_other_category_accepted(self):
        finding = IssueFinding(
            category=BarrierCategory.OTHER,
            confidence=0.85,
            severity=7,
            complexity="HIGH",
            explanation="This section has unrealistic compliance deadlines",
            matched_phrases=["within 7 calendar days"],
            text_examples=["Failure to comply within 7 calendar days shall result in denial"],
        )
        assert finding.category == BarrierCategory.OTHER
        assert finding.severity == 7

    def test_all_categories_valid(self):
        """All 18 categories are accepted."""
        for cat in BarrierCategory:
            finding = IssueFinding(
                category=cat,
                confidence=0.5,
                severity=5,
                complexity="MEDIUM",
                explanation="Test",
            )
            assert finding.category == cat

    def test_implementation_opportunity_removed(self):
        """IMPLEMENTATION_OPPORTUNITY is no longer a valid category."""
        with pytest.raises(ValueError):
            IssueFinding(
                category="IMPLEMENTATION_OPPORTUNITY",
                confidence=0.5,
                severity=5,
                complexity="MEDIUM",
                explanation="Test",
            )

    def test_worst_thing_removed(self):
        """WORST_THING is no longer a valid category (renamed to OTHER)."""
        with pytest.raises(ValueError):
            IssueFinding(
                category="WORST_THING",
                confidence=0.5,
                severity=5,
                complexity="MEDIUM",
                explanation="Test",
            )

    def test_removed_multi_document_categories(self):
        """Multi-document categories were removed (can't work per-section)."""
        for cat_name in ["STATE_EXCEEDS_FEDERAL", "DUPLICATIVE_REQUIREMENTS", "INTERAGENCY_FRAGMENTATION"]:
            with pytest.raises(ValueError):
                IssueFinding(
                    category=cat_name,
                    confidence=0.5,
                    severity=5,
                    complexity="MEDIUM",
                    explanation="Test",
                )

    def test_new_categories_accepted(self):
        """ONE_SIZE_FITS_ALL and UNFUNDED_MANDATE are valid."""
        for cat in [BarrierCategory.ONE_SIZE_FITS_ALL, BarrierCategory.UNFUNDED_MANDATE]:
            finding = IssueFinding(
                category=cat,
                confidence=0.7,
                severity=6,
                complexity="MEDIUM",
                explanation="Test finding",
            )
            assert finding.category == cat

    def test_tags_field(self):
        """Tags field accepts kebab-case labels."""
        finding = IssueFinding(
            category=BarrierCategory.ADMINISTRATIVE_BURDENS,
            confidence=0.9,
            severity=8,
            complexity="HIGH",
            explanation="Multiple friction points",
            matched_phrases=["notarized"],
            tags=["notarization-required", "in-person-only", "short-deadline"],
        )
        assert finding.tags == ["notarization-required", "in-person-only", "short-deadline"]

    def test_tags_default_empty(self):
        finding = IssueFinding(
            category=BarrierCategory.OTHER,
            confidence=0.5,
            severity=3,
            complexity="LOW",
            explanation="Minor issue",
        )
        assert finding.tags == []


class TestAnalysisOutput:
    def test_clean_classification(self):
        output = AnalysisOutput(
            categories=[],
            classification="clean",
            overall_confidence=0.9,
            overall_complexity="LOW",
            summary="Well-drafted section",
            reasoning="No issues found",
        )
        assert output.classification == "clean"

    def test_has_issues_with_other(self):
        output = AnalysisOutput(
            categories=[
                IssueFinding(
                    category=BarrierCategory.ADMINISTRATIVE_BURDENS,
                    confidence=0.9,
                    severity=8,
                    complexity="HIGH",
                    explanation="Multiple friction points",
                    matched_phrases=["notarized", "in person"],
                ),
                IssueFinding(
                    category=BarrierCategory.OTHER,
                    confidence=0.95,
                    severity=8,
                    complexity="HIGH",
                    explanation="Unrealistic compliance timeline combined with administrative burdens",
                    matched_phrases=["within 7 calendar days"],
                    tags=["unrealistic-deadline", "automatic-denial"],
                ),
            ],
            classification="has_issues",
            overall_confidence=0.9,
            overall_complexity="HIGH",
            summary="Section has significant administrative burden issues",
            reasoning="Test reasoning",
        )
        assert output.classification == "has_issues"
        assert len(output.categories) == 2
        other = [c for c in output.categories if c.category == BarrierCategory.OTHER]
        assert len(other) == 1
        assert other[0].tags == ["unrealistic-deadline", "automatic-denial"]

    def test_needs_context_classification_rejected(self):
        """'needs_context' is no longer valid — only 'clean' or 'has_issues'."""
        with pytest.raises(ValueError):
            AnalysisOutput(
                categories=[],
                classification="needs_context",
                overall_confidence=0.5,
                overall_complexity="LOW",
                summary="Test",
                reasoning="Test",
            )
