"""Tests for JenAI LLM output models."""
import pytest

from scripts.jenai_pipeline.models.llm_outputs import AnalysisOutput, IssueFinding
from scripts.jenai_pipeline.config import JenAICategory


class TestIssueFinding:
    def test_worst_thing_category_accepted(self):
        finding = IssueFinding(
            category=JenAICategory.WORST_THING,
            confidence=0.85,
            severity=7,
            complexity="HIGH",
            explanation="This section has unrealistic compliance deadlines",
            matched_phrases=["within 7 calendar days"],
            text_examples=["Failure to comply within 7 calendar days shall result in denial"],
        )
        assert finding.category == JenAICategory.WORST_THING
        assert finding.severity == 7

    def test_all_categories_valid(self):
        """All 19 categories are accepted."""
        for cat in JenAICategory:
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

    def test_has_issues_with_worst_thing(self):
        output = AnalysisOutput(
            categories=[
                IssueFinding(
                    category=JenAICategory.ADMINISTRATIVE_BURDENS,
                    confidence=0.9,
                    severity=8,
                    complexity="HIGH",
                    explanation="Multiple friction points",
                    matched_phrases=["notarized", "in person"],
                ),
                IssueFinding(
                    category=JenAICategory.WORST_THING,
                    confidence=0.95,
                    severity=8,
                    complexity="HIGH",
                    explanation="Unrealistic compliance timeline combined with administrative burdens",
                    matched_phrases=["within 7 calendar days"],
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
        worst = [c for c in output.categories if c.category == JenAICategory.WORST_THING]
        assert len(worst) == 1

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
