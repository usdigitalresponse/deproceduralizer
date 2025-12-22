"""
Backend tests for the regulation analysis pipeline.

Run with: cd backend && pytest
Run LLM tests: cd backend && pytest -m llm (requires API key)
"""
import pytest
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

# =============================================================================
# SMOKE TESTS - Scripts import and CLI works
# =============================================================================

class TestImports:
    """Verify all scripts can be imported without errors."""

    def test_import_shared_utils(self):
        from shared_utils import (
            BatchManager,
            format_batch_request,
            parse_batch_result_tool_use,
            get_db_connection,
            load_prompt,
        )
        assert BatchManager is not None

    def test_import_batch_definitions(self):
        import batch_definitions
        assert hasattr(batch_definitions, 'main')

    def test_import_red_flags(self):
        import red_flags
        assert hasattr(red_flags, 'RegulationAnalysis')
        assert hasattr(red_flags, 'create_analysis_prompt')

    def test_import_search_signatures(self):
        import search_nj_signatures
        assert hasattr(search_nj_signatures, 'SignatureAnalysis')


# =============================================================================
# UNIT TESTS - Pure functions
# =============================================================================

class TestBatchHelpers:
    """Test batch API helper functions."""

    def test_format_batch_request(self):
        from shared_utils import format_batch_request
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
        from shared_utils import load_prompt, load_prompt_parts

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
        from shared_utils import load_prompt

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
        from red_flags import create_analysis_prompt
        from shared_utils import load_prompt_parts

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


class TestSignaturePatterns:
    """Test signature regex patterns."""

    def test_tier1_patterns(self):
        import re
        from search_nj_signatures import TIER1_TERMS

        # Should match wet signature language
        test_text = "must provide an original signature on the form"
        matched = any(re.search(term, test_text, re.IGNORECASE) for term in TIER1_TERMS)
        assert matched

    def test_tier4_patterns(self):
        import re
        from search_nj_signatures import TIER4_TERMS

        # Should match general signature language
        test_text = "the application must be signed by the applicant"
        matched = any(re.search(term, test_text, re.IGNORECASE) for term in TIER4_TERMS)
        assert matched


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
        from red_flags import (
            RegulationAnalysis,
            RegulationData,
            analyze_regulation,
        )
        from shared_utils import get_async_openai_client

        # Simple test regulation
        reg = RegulationData(
            url="https://test.example.com",
            title="Test Section",
            content="The applicant must submit Form A-100 in PDF format within 10 days.",
            url_type="regulation",
            source_index=1,
        )

        client = get_async_openai_client()
        result = asyncio.run(analyze_regulation(reg, client))

        # Verify we got a valid response
        assert isinstance(result, RegulationAnalysis)
        assert isinstance(result.has_implementation_issues, bool)
        assert isinstance(result.red_flags, list)

    def test_signature_analysis(self):
        """Test signature LLM analysis produces valid output."""
        import asyncio
        from search_nj_signatures import (
            SignatureAnalysis,
            analyze_match,
            StatuteChecker,
        )
        from shared_utils import get_async_openai_client

        # Simple test match
        match = {
            'file': 'test.json',
            'title': 'Test Section',
            'url': 'https://test.example.com',
            'tier': 'tier1',
            'term_matched': 'original signature',
            'context': 'The form must bear the original signature of the applicant.',
            'statute_citations': [],
        }

        client = get_async_openai_client()
        statute_checker = StatuteChecker()

        result = asyncio.run(analyze_match(match, statute_checker, client))

        # Verify we got a valid response
        assert 'llm_analysis' in result
        if result['llm_analysis']:
            assert 'has_wet_signature_requirement' in result['llm_analysis']

    def test_batch_request_format_valid(self):
        """Test that batch requests are formatted correctly for the API."""
        from shared_utils import format_batch_request
        from red_flags import RegulationAnalysis, create_analysis_prompt

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

class TestCLI:
    """Test CLI commands work (dry-run mode)."""

    def test_batch_definitions_dryrun(self):
        import subprocess
        result = subprocess.run(
            ['python', 'scripts/batch_definitions.py', 'submit',
             '--state', 'NJ', '--title', '3A', '--limit', '1', '--dry-run'],
            capture_output=True, text=True, cwd=str(__file__).replace('/tests/test_backend.py', '')
        )
        assert result.returncode == 0
        assert 'DRY RUN' in result.stdout

    def test_red_flags_dryrun(self):
        import subprocess
        result = subprocess.run(
            ['python', 'scripts/red_flags.py',
             '--state', 'NJ', '--title', '3A', '--sample-size', '1', '--dry-run'],
            capture_output=True, text=True, cwd=str(__file__).replace('/tests/test_backend.py', '')
        )
        assert result.returncode == 0
        assert 'DRY RUN' in result.stdout

    def test_run_pipeline_help(self):
        import subprocess
        result = subprocess.run(
            ['python', 'run_pipeline.py', '--help'],
            capture_output=True, text=True, cwd=str(__file__).replace('/tests/test_backend.py', '')
        )
        assert result.returncode == 0
        assert '--state' in result.stdout
