"""
PR 7.1: Audit tests — Searcher LLM triage vs Research Pipeline Tier 1+2.

These tests document that:
1. Every field the searcher's LLM triage produces is already covered by the
   research pipeline (Tier 1 + Tier 2).
2. The research pipeline does NOT read the searcher's LLM analysis fields
   when loading matches — it only reads regex match data.
3. The research pipeline OVERWRITES the searcher's analysis row via
   ON CONFLICT when saving Tier 1 results.

This means the searcher's LLM call is redundant when the research pipeline
runs afterwards, and can be safely removed (PR 7.3).

See: https://github.com/michaeleboyce/deproceduralizer/issues/94
"""

import pytest


class TestSearcherTriageFieldCoverage:
    """Verify every searcher LLM output field is covered by the research pipeline."""

    def test_searcher_response_model_fields(self):
        """Document what the searcher's LLM triage produces."""
        from scripts.compliance_issues.models import ComplianceIssueInstance

        fields = set(ComplianceIssueInstance.model_fields.keys())
        expected = {
            "requirement_found",
            "verbatim_supporting_text",
            "required_by_statute",
            "severity",
            "decision_rationale",
        }
        assert fields == expected, (
            f"Searcher model fields changed! "
            f"Added: {fields - expected}, Removed: {expected - fields}"
        )

    def test_tier1_output_fields(self):
        """Document what Tier 1 of the research pipeline produces."""
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        fields = set(Tier1Output.model_fields.keys())
        # Tier 1 handles match filtering (which the searcher's requirement_found does)
        assert "classification" in fields  # all_false_positives | needs_research
        assert "relevant_match_indices" in fields
        assert "dismissed_matches" in fields
        assert "reasoning" in fields  # covers decision_rationale
        assert "confidence" in fields

    def test_tier2_output_fields(self):
        """Document what Tier 2 of the research pipeline produces."""
        from scripts.research_pipeline.models.llm_outputs import Tier2Output

        fields = set(Tier2Output.model_fields.keys())
        # Tier 2 covers the remaining searcher fields
        assert "severity" in fields
        assert "verbatim_requirements" in fields  # covers verbatim_supporting_text
        assert "cites_federal_statute" in fields  # covers required_by_statute
        assert "classification" in fields  # burdensome|justified|unrelated
        assert "reasoning" in fields

    def test_every_searcher_field_has_pipeline_equivalent(self):
        """
        The critical test: every field the searcher triage produces
        is already produced by the research pipeline.
        """
        # Mapping: searcher field -> (pipeline tier, pipeline field)
        field_mapping = {
            "requirement_found": ("tier1", "classification"),
            "severity": ("tier2", "severity"),
            "verbatim_supporting_text": ("tier2", "verbatim_requirements"),
            "required_by_statute": ("tier2", "cites_federal_statute"),
            "decision_rationale": ("tier1", "reasoning"),
        }

        from scripts.compliance_issues.models import ComplianceIssueInstance
        from scripts.research_pipeline.models.llm_outputs import Tier1Output, Tier2Output

        tier_models = {"tier1": Tier1Output, "tier2": Tier2Output}

        for searcher_field, (tier, pipeline_field) in field_mapping.items():
            assert searcher_field in ComplianceIssueInstance.model_fields, (
                f"Searcher field {searcher_field} no longer exists"
            )
            assert pipeline_field in tier_models[tier].model_fields, (
                f"Pipeline {tier} field {pipeline_field} doesn't exist — "
                f"searcher field {searcher_field} would lose coverage"
            )


class TestPipelineIgnoresSearcherLLMOutput:
    """
    Verify the research pipeline reads only regex match data from the DB,
    not the searcher's LLM analysis.
    """

    def test_document_query_reads_only_match_data(self):
        """
        The research pipeline's document query reads regex_match_pattern
        and regex_match_context — NOT any LLM analysis fields.
        """
        import inspect
        from scripts.research_pipeline.db import document_queries

        source = inspect.getsource(document_queries)

        # The pipeline reads these from compliance_issues
        assert "regex_match_pattern" in source
        assert "regex_match_context" in source

        # The pipeline should NOT read the old searcher LLM fields from
        # compliance_issues (they were moved to compliance_issue_analyses
        # in Phase 6). These fields no longer exist on compliance_issues.
        # This confirms there's no dependency on the searcher's LLM output.
        assert "llm_analysis" not in source, (
            "Pipeline should not read llm_analysis from compliance_issues"
        )

    def test_match_info_has_no_llm_fields(self):
        """
        MatchInfo (what the pipeline loads per match) only contains
        regex match data, not LLM analysis data.
        """
        from scripts.research_pipeline.models.matches import MatchInfo

        fields = set(MatchInfo.model_fields.keys())
        # Should only have match-related fields
        assert "match_id" in fields
        assert "matched_text" in fields
        assert "surrounding_context" in fields

        # Should NOT have any LLM analysis fields
        llm_fields = {
            "requirement_found", "severity", "decision_rationale",
            "verbatim_supporting_text", "required_by_statute",
            "llm_analysis",
        }
        overlap = fields & llm_fields
        assert not overlap, (
            f"MatchInfo should not contain LLM fields: {overlap}"
        )


class TestSearcherIsRegexOnly:
    """
    Verify the searcher no longer writes LLM analysis data.
    PR 7.3: Searcher only writes regex matches to compliance_issues.
    """

    def test_searcher_save_only_writes_compliance_issues(self):
        """
        After PR 7.3, save_to_database writes only to compliance_issues
        (not compliance_issue_analyses). The pipeline handles analysis.
        """
        import inspect
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        source = inspect.getsource(ComplianceIssueSearcher.save_to_database)

        # Writes to compliance_issues
        assert "compliance_issues" in source
        # Does NOT write to compliance_issue_analyses
        assert "compliance_issue_analyses" not in source
        # No LLM-related fields
        assert "llm_analysis" not in source
        assert "requirement_found" not in source
        assert "severity" not in source

    def test_tier1_creates_analysis_rows(self):
        """
        save_tier1_results creates compliance_issue_analyses rows.
        This is the sole creator of analysis data now.
        """
        import inspect
        from scripts.research_pipeline.db.analysis_writer import save_tier1_results

        source = inspect.getsource(save_tier1_results)

        assert "compliance_issue_analyses" in source
        assert "ON CONFLICT (document_id, issue_type) DO UPDATE" in source
        assert "tier1_classification" in source
        assert "requirement_found" in source


class TestSearcherLLMMethodsRemoved:
    """
    PR 7.3: Verify all LLM methods have been removed from the searcher.
    """

    def test_analyze_match_removed(self):
        """analyze_match() has been removed."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert not hasattr(ComplianceIssueSearcher, "analyze_match")

    def test_analyze_async_removed(self):
        """analyze_async() has been removed."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert not hasattr(ComplianceIssueSearcher, "analyze_async")

    def test_submit_batch_removed(self):
        """submit_batch() has been removed."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert not hasattr(ComplianceIssueSearcher, "submit_batch")

    def test_process_batch_results_removed(self):
        """process_batch_results() has been removed."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert not hasattr(ComplianceIssueSearcher, "process_batch_results")

    def test_create_prompt_removed(self):
        """create_prompt() has been removed."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert not hasattr(ComplianceIssueSearcher, "create_prompt")

    def test_no_llm_imports(self):
        """Searcher should not import any LLM-related modules."""
        import inspect
        from scripts.compliance_issues import searcher

        source = inspect.getsource(searcher)
        assert "call_llm_parse_async" not in source
        assert "format_batch_request" not in source
        assert "BatchManager" not in source
        assert "DEFAULT_MODEL" not in source

    def test_search_still_exists(self):
        """search() (regex) is preserved."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert hasattr(ComplianceIssueSearcher, "search")

    def test_save_to_database_still_exists(self):
        """save_to_database() is preserved (but simplified)."""
        from scripts.compliance_issues.searcher import ComplianceIssueSearcher

        assert hasattr(ComplianceIssueSearcher, "save_to_database")
