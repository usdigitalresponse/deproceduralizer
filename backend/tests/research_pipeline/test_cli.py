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
        """--issue argument is documented."""
        assert "--issue" in cli_help_output

    def test_help_shows_limit_argument(self, cli_help_output):
        """--limit argument is documented."""
        assert "--limit" in cli_help_output

    def test_help_shows_max_tier_argument(self, cli_help_output):
        """--max-tier argument is documented."""
        assert "--max-tier" in cli_help_output

    def test_help_shows_execute_argument(self, cli_help_output):
        """--execute argument is documented."""
        assert "--execute" in cli_help_output

    def test_help_shows_all_issues_argument(self, cli_help_output):
        """--all-issues argument is documented."""
        assert "--all-issues" in cli_help_output

    def test_help_shows_global_limit_argument(self, cli_help_output):
        """--global-limit argument is documented."""
        assert "--global-limit" in cli_help_output

    def test_help_does_not_show_removed_flags(self, cli_help_output):
        """Removed flags should not appear in help."""
        assert "--resume-batch" not in cli_help_output
        assert "--resume-tier" not in cli_help_output
        assert "--sequential" not in cli_help_output
        assert "--dry-run" not in cli_help_output


class TestCLIDefaults:
    """Test CLI default values and cost-safe behavior."""

    def test_all_issues_dry_run_by_default(self):
        """--state nj --all-issues should dry-run by default (no --execute)."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--state", "nj", "--all-issues"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=60,
        )
        assert result.returncode == 0, f"CLI failed: {result.stderr}"
        assert "RUNNING ALL ISSUE TYPES" in result.stdout

    def test_issue_selection_required(self):
        """--state alone should fail — must specify --issue or --all-issues."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli", "--state", "nj"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=30,
        )
        assert result.returncode != 0
        assert "required" in result.stderr.lower() or "error" in result.stderr.lower()

    def test_single_issue_dry_run_by_default(self):
        """--issue mail_only should dry-run by default."""
        result = subprocess.run(
            ["python3", "-m", "scripts.research_pipeline.cli",
             "--state", "nj", "--issue", "mail_only"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            timeout=60,
        )
        assert result.returncode == 0
        assert "RESEARCH PIPELINE" in result.stdout
        assert "Issue type: mail_only" in result.stdout
        assert "DRY RUN" in result.stdout

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
        assert "default: 100" in result.stdout
        assert "default: 2" in result.stdout


