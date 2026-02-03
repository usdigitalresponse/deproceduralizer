"""
CLI tests for the research pipeline.

Uses subprocess to test actual CLI behavior rather than reimplementing argparse.
"""

import subprocess
from pathlib import Path

import pytest

# Get the backend directory for subprocess cwd
BACKEND_DIR = Path(__file__).parent.parent.parent


class TestCLIHelp:
    """Test CLI --help output shows all expected arguments."""

    @pytest.fixture
    def cli_help_output(self):
        """Get CLI --help output once for multiple tests."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--help"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=30,
        )
        assert result.returncode == 0, f"CLI help failed: {result.stderr}"
        return result.stdout

    def test_help_shows_state_argument(self, cli_help_output):
        """--state argument is documented."""
        assert "--state" in cli_help_output

    def test_help_shows_issue_type_argument(self, cli_help_output):
        """--issue-type argument is documented."""
        assert "--issue-type" in cli_help_output

    def test_help_shows_max_docs_per_issue_argument(self, cli_help_output):
        """--max-docs-per-issue argument is documented."""
        assert "--max-docs-per-issue" in cli_help_output

    def test_help_shows_max_tier_argument(self, cli_help_output):
        """--max-tier argument is documented."""
        assert "--max-tier" in cli_help_output

    def test_help_shows_dry_run_argument(self, cli_help_output):
        """--dry-run argument is documented."""
        assert "--dry-run" in cli_help_output or "dry_run" in cli_help_output

    def test_help_shows_all_issues_argument(self, cli_help_output):
        """--all-issues argument is documented."""
        assert "--all-issues" in cli_help_output or "all_issues" in cli_help_output


class TestCLIDefaults:
    """Test CLI default values work correctly."""

    def test_state_only_runs_with_defaults(self):
        """--state alone should work, using all defaults."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--state", "nj", "--dry-run"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=60,
        )
        # Should succeed (exit 0) and show it's running all issues
        assert result.returncode == 0, f"CLI failed: {result.stderr}"
        assert "RUNNING ALL ISSUE TYPES" in result.stdout

    def test_defaults_to_all_issues(self):
        """Without --issue-type, should default to all issues."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--state", "nj", "--dry-run"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=60,
        )
        assert result.returncode == 0
        # Should mention multiple issue types
        assert "Issue types found:" in result.stdout

    def test_explicit_issue_type_overrides_default(self):
        """--issue-type should override the default all-issues behavior."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli",
             "--state", "nj", "--issue-type", "mail_only", "--dry-run"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=60,
        )
        assert result.returncode == 0
        # Should run single issue test, not all issues
        assert "RESEARCH PIPELINE" in result.stdout
        assert "Issue type: mail_only" in result.stdout

    def test_help_shows_defaults(self):
        """Help text should show default values."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--help"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=30,
        )
        assert result.returncode == 0
        assert "default: 1000" in result.stdout
        assert "default: 2" in result.stdout
        assert "default: false" in result.stdout.lower()


class TestBackfillScript:
    """Test backfill script has required functions."""

    def test_backfill_functions_exist(self):
        """Backfill module has required functions."""
        from scripts.research_pipeline.maintenance.backfill_legacy_analyses import (
            get_unprocessed_groups,
            insert_analysis_record,
            backfill_legacy_analyses,
        )

        assert callable(get_unprocessed_groups)
        assert callable(insert_analysis_record)
        assert callable(backfill_legacy_analyses)

    def test_backfill_help(self):
        """Backfill script --help works."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.maintenance.backfill_legacy_analyses", "--help"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=30,
        )
        assert result.returncode == 0
        assert "--dry-run" in result.stdout
        assert "--limit" in result.stdout
