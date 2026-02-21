"""
Backend tests for the regulation analysis pipeline.

Run with: cd backend && pytest
Run LLM tests: cd backend && pytest -m llm (requires API key)
"""
import pytest
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

# =============================================================================
# UNIT TESTS - Pure functions
# =============================================================================

class TestBatchHelpers:
    """Test batch API helper functions."""

    def test_format_batch_request(self):
        from lib.batch import format_batch_request
        from pydantic import BaseModel

        class SimpleResponse(BaseModel):
            answer: str

        request = format_batch_request(
            custom_id="test_123",
            prompt="Say hello",
            response_format=SimpleResponse,
        )

        assert request['custom_id'] == "test_123"
        assert request['params']['model'] is not None
        assert request['params']['messages'][0]['content'] == "Say hello"
        assert len(request['params']['tools']) == 1

    def test_load_prompt(self):
        from lib.prompts import load_prompt, load_prompt_parts

        # Test red flags prompt loads (template only - dynamic content)
        prompt = load_prompt(
            "red_flags_analysis",
            section_text="Test content",
            citation="Test § 1.1",
            heading="Test Heading"
        )
        assert "Test content" in prompt
        assert "Test § 1.1" in prompt

        # Framework is now in system prompt (for caching)
        parts = load_prompt_parts(
            "red_flags_analysis",
            section_text="Test content",
            citation="Test § 1.1",
            heading="Test Heading"
        )
        assert parts['system'] is not None
        assert "COMPLEXITY_POLICY_DEBT" in parts['system']  # Framework in system
        assert "Test content" in parts['user']  # Dynamic in user

    def test_load_prompt_definitions(self):
        from lib.prompts import load_prompt

        prompt = load_prompt(
            "definition_extraction",
            title="Test Title",
            content="Test content with definitions"
        )
        assert "Test Title" in prompt
        assert "Test content" in prompt


class TestRedFlagsPrompt:
    """Test red flags prompt creation."""

    def test_create_analysis_prompt(self):
        from scripts.red_flags import create_analysis_prompt
        from lib.prompts import load_prompt_parts

        # create_analysis_prompt returns template only (for backwards compat)
        prompt = create_analysis_prompt(
            section_text="The applicant shall submit Form A-100 in PDF format.",
            citation="N.J.A.C. 3A:1-1.1",
            heading="Application Requirements"
        )

        # Should contain the section text
        assert "Form A-100" in prompt

        # Framework categories are in system prompt now (for caching)
        parts = load_prompt_parts(
            "red_flags_analysis",
            section_text="test",
            citation="test",
            heading="test"
        )
        assert "MANDATED_STEPS_NOT_OUTCOMES" in parts['system']
        assert "ADMINISTRATIVE_BURDENS" in parts['system']


# =============================================================================
# LLM INTEGRATION TESTS - Real API calls
# =============================================================================

@pytest.mark.llm
class TestLLMCalls:
    """
    Test actual LLM calls work correctly.

    These tests make real API calls and cost money.
    Run with: pytest -m llm
    Skip with: pytest -m "not llm"
    """

    @pytest.fixture(autouse=True)
    def check_api_key(self):
        """Skip if no API key available."""
        if not os.environ.get('ANTHROPIC_API_KEY'):
            pytest.skip("ANTHROPIC_API_KEY not set")

    def test_red_flags_analysis(self):
        """Test red flags LLM analysis produces valid output."""
        import asyncio
        from scripts.red_flags import (
            RegulationAnalysis,
            RegulationData,
            analyze_regulation,
        )
        from lib.llm import get_async_anthropic_client

        # Simple test regulation
        reg = RegulationData(
            url="https://test.example.com",
            title="Test Section",
            content="The applicant must submit Form A-100 in PDF format within 10 days.",
            url_type="regulation",
            source_index=1,
        )

        client = get_async_anthropic_client()
        result = asyncio.run(analyze_regulation(reg, client))

        # Verify we got a valid response
        assert isinstance(result, RegulationAnalysis)
        assert isinstance(result.has_implementation_issues, bool)
        assert isinstance(result.red_flags, list)

    def test_batch_request_format_valid(self):
        """Test that batch requests are formatted correctly for the API."""
        from lib.batch import format_batch_request
        from scripts.red_flags import RegulationAnalysis, create_analysis_prompt

        prompt = create_analysis_prompt(
            section_text="Test content",
            citation="Test § 1.1",
            heading="Test"
        )

        request = format_batch_request(
            custom_id="test_1",
            prompt=prompt,
            response_format=RegulationAnalysis,
        )

        # Verify structure matches Anthropic batch API spec
        assert 'custom_id' in request
        assert 'params' in request
        assert 'model' in request['params']
        assert 'messages' in request['params']
        assert 'tools' in request['params']
        assert 'tool_choice' in request['params']


# =============================================================================
# CLI SMOKE TESTS
# =============================================================================

# =============================================================================
# DATABASE TESTS - Require DB connection (READ-ONLY)
# =============================================================================

@pytest.mark.db
class TestExclusionFilter:
    """Test the exclude_from_analysis filtering in get_filtered_documents.

    These tests are READ-ONLY and do not modify database data.
    """

    @pytest.fixture(autouse=True)
    def check_db_connection(self):
        """Skip if no database connection available."""
        from lib.db import get_db_connection
        conn = get_db_connection()
        if not conn:
            pytest.skip("Database connection not available")
        conn.close()

    def test_exclusion_filter_queries_run_without_error(self):
        """Verify both include_excluded modes run without SQL errors."""
        from lib.db import get_filtered_documents

        # Test default mode (exclude_from_analysis filtered out)
        docs_default = get_filtered_documents(jurisdiction='NY', limit=5)
        assert isinstance(docs_default, list)

        # Test with include_excluded=True (no filtering)
        docs_with_excluded = get_filtered_documents(jurisdiction='NY', limit=5, include_excluded=True)
        assert isinstance(docs_with_excluded, list)

    def test_exclusion_filter_difference(self):
        """If any documents are excluded, include_excluded=True should return more or equal."""
        from lib.db import get_filtered_documents, get_db_connection

        # Check if there are any excluded documents in the database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM regulatory_documents
            WHERE state = 'NY' AND exclude_from_analysis = TRUE
        """)
        excluded_count = cur.fetchone()[0]
        cur.close()
        conn.close()

        # Get counts with both modes
        docs_filtered = get_filtered_documents(jurisdiction='NY', limit=10000)
        docs_all = get_filtered_documents(jurisdiction='NY', limit=10000, include_excluded=True)

        # include_excluded=True should return >= filtered results
        assert len(docs_all) >= len(docs_filtered), \
            "include_excluded=True should return at least as many documents"

        # If there are excluded docs, include_excluded=True should return more
        if excluded_count > 0:
            assert len(docs_all) > len(docs_filtered), \
                f"Expected more docs with include_excluded=True (found {excluded_count} excluded docs)"


class TestCLI:
    """Test CLI commands work (dry-run mode)."""

    def test_batch_definitions_dryrun(self):
        import subprocess
        backend_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, 'scripts/batch_definitions.py', 'submit',
             '--state', 'NJ', '--title', '3A', '--limit', '1', '--dry-run'],
            capture_output=True, text=True, cwd=str(backend_dir)
        )
        assert result.returncode == 0
        assert 'DRY RUN' in result.stdout

    def test_red_flags_dryrun(self):
        import subprocess
        backend_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, 'scripts/red_flags.py',
             '--state', 'NJ', '--title', '3A', '--sample-size', '1', '--dry-run'],
            capture_output=True, text=True, cwd=str(backend_dir)
        )
        assert result.returncode == 0
        assert 'DRY RUN' in result.stdout

    def test_research_pipeline_help(self):
        import subprocess
        backend_dir = Path(__file__).parent.parent
        result = subprocess.run(
            [sys.executable, '-m', 'scripts.research_pipeline.cli', '--help'],
            capture_output=True, text=True, cwd=str(backend_dir)
        )
        assert result.returncode == 0
        assert '--state' in result.stdout
