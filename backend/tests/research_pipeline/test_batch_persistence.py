"""Tests for research_pipeline/batch_persistence.py - Run state persistence.

Tests cover:
- RunStatus enum
- RunManifest dataclass
- BatchInfo dataclass
- BatchPersistence class methods
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from scripts.research_pipeline.batch_persistence import (
    RunStatus,
    RunManifest,
    BatchInfo,
    BatchPersistence,
)


class TestRunStatus:
    """Test RunStatus enum."""

    def test_status_values(self):
        """RunStatus should have expected values."""
        assert RunStatus.IN_PROGRESS.value == "in_progress"
        assert RunStatus.COMPLETED.value == "completed"
        assert RunStatus.FAILED.value == "failed"

    def test_status_from_string(self):
        """RunStatus should be creatable from string."""
        assert RunStatus("in_progress") == RunStatus.IN_PROGRESS
        assert RunStatus("completed") == RunStatus.COMPLETED
        assert RunStatus("failed") == RunStatus.FAILED


class TestRunManifest:
    """Test RunManifest dataclass."""

    def test_creation_with_required_fields(self):
        """RunManifest should create with required fields."""
        manifest = RunManifest(
            run_id="20260109_120000",
            state="nj",
            issue_types=["mail_only"],
            max_tier=3,
            enable_web_search=True,
            max_docs_per_issue=100,
            global_docs_limit="no-limit",
            status=RunStatus.IN_PROGRESS,
            current_tier=1,
        )

        assert manifest.run_id == "20260109_120000"
        assert manifest.state == "nj"
        assert manifest.issue_types == ["mail_only"]
        assert manifest.max_tier == 3
        assert manifest.status == RunStatus.IN_PROGRESS

    def test_auto_timestamp(self):
        """RunManifest should auto-populate timestamps."""
        manifest = RunManifest(
            run_id="test",
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue="all",
            global_docs_limit=1000,
            status=RunStatus.IN_PROGRESS,
            current_tier=0,
        )

        assert manifest.created_at != ""
        assert manifest.updated_at != ""

    def test_optional_fields_default(self):
        """RunManifest optional fields should have defaults."""
        manifest = RunManifest(
            run_id="test",
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
            status=RunStatus.IN_PROGRESS,
            current_tier=0,
        )

        assert manifest.title_filter is None
        assert manifest.tier1_batch_id is None
        assert manifest.tier2_batch_id is None
        assert manifest.tier3_batch_id is None
        assert manifest.completed_at is None
        assert manifest.total_units == 0


class TestBatchInfo:
    """Test BatchInfo dataclass."""

    def test_creation(self):
        """BatchInfo should create with required fields."""
        batch_info = BatchInfo(
            batch_id="batch_abc123",
            tier=1,
            submitted_at="2026-01-09T12:00:00",
            total_requests=50,
            status="submitted",
        )

        assert batch_info.batch_id == "batch_abc123"
        assert batch_info.tier == 1
        assert batch_info.total_requests == 50
        assert batch_info.status == "submitted"

    def test_default_counts(self):
        """BatchInfo should have default counts of 0."""
        batch_info = BatchInfo(
            batch_id="batch_123",
            tier=2,
            submitted_at="2026-01-09T12:00:00",
            total_requests=100,
            status="in_progress",
        )

        assert batch_info.succeeded == 0
        assert batch_info.errored == 0
        assert batch_info.expired == 0
        assert batch_info.unit_custom_ids == []


class TestBatchPersistence:
    """Test BatchPersistence class."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for testing."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    @pytest.fixture
    def persistence(self, temp_dir):
        """Create a BatchPersistence instance with temp directory."""
        return BatchPersistence(base_dir=temp_dir)

    def test_init_creates_directory(self, temp_dir):
        """BatchPersistence should create base directory."""
        subdir = temp_dir / "batch_runs"
        assert not subdir.exists()

        persistence = BatchPersistence(base_dir=subdir)
        assert subdir.exists()

    def test_create_run(self, persistence, temp_dir):
        """create_run should create run directory with manifest."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit="no-limit",
        )

        assert run_dir.exists()
        assert (run_dir / "manifest.json").exists()

        manifest = persistence.load_manifest(run_dir)
        assert manifest is not None
        assert manifest.state == "nj"
        assert manifest.issue_types == ["mail_only"]
        assert manifest.status == RunStatus.IN_PROGRESS

    def test_create_run_with_title_filter(self, persistence):
        """create_run should include title filter in directory name."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit="no-limit",
            title_filter="3A",
        )

        assert "title3A" in run_dir.name

        manifest = persistence.load_manifest(run_dir)
        assert manifest.title_filter == "3A"

    def test_load_manifest_missing(self, persistence, temp_dir):
        """load_manifest should return None for missing manifest."""
        result = persistence.load_manifest(temp_dir / "nonexistent")
        assert result is None

    def test_update_manifest(self, persistence):
        """update_manifest should update specified fields."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        persistence.update_manifest(
            run_dir,
            current_tier=1,
            tier1_batch_id="batch_tier1_123",
            total_units=50,
        )

        manifest = persistence.load_manifest(run_dir)
        assert manifest.current_tier == 1
        assert manifest.tier1_batch_id == "batch_tier1_123"
        assert manifest.total_units == 50

    def test_update_manifest_completed_sets_timestamp(self, persistence):
        """update_manifest with COMPLETED status should set completed_at."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        persistence.update_manifest(run_dir, status=RunStatus.COMPLETED)

        manifest = persistence.load_manifest(run_dir)
        assert manifest.status == RunStatus.COMPLETED
        assert manifest.completed_at is not None

    def test_update_manifest_missing_raises(self, persistence, temp_dir):
        """update_manifest should raise for missing manifest."""
        with pytest.raises(ValueError, match="No manifest found"):
            persistence.update_manifest(temp_dir / "nonexistent", current_tier=1)

    def test_save_and_load_batch_info(self, persistence):
        """save_batch_info and load_batch_info should round-trip."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        batch_info = BatchInfo(
            batch_id="batch_abc123",
            tier=1,
            submitted_at="2026-01-09T12:00:00",
            total_requests=50,
            status="submitted",
            unit_custom_ids=["unit_1", "unit_2"],
        )

        persistence.save_batch_info(run_dir, batch_info)
        loaded = persistence.load_batch_info(run_dir, tier=1)

        assert loaded is not None
        assert loaded.batch_id == "batch_abc123"
        assert loaded.tier == 1
        assert loaded.unit_custom_ids == ["unit_1", "unit_2"]

    def test_load_batch_info_missing(self, persistence):
        """load_batch_info should return None for missing batch."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        result = persistence.load_batch_info(run_dir, tier=3)
        assert result is None

    def test_update_batch_info(self, persistence):
        """update_batch_info should update specified fields."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        batch_info = BatchInfo(
            batch_id="batch_123",
            tier=1,
            submitted_at="2026-01-09T12:00:00",
            total_requests=50,
            status="submitted",
        )
        persistence.save_batch_info(run_dir, batch_info)

        persistence.update_batch_info(
            run_dir,
            tier=1,
            status="ended",
            succeeded=45,
            errored=3,
            expired=2,
        )

        loaded = persistence.load_batch_info(run_dir, tier=1)
        assert loaded.status == "ended"
        assert loaded.succeeded == 45
        assert loaded.errored == 3
        assert loaded.expired == 2

    def test_save_and_load_units(self, persistence):
        """save_units and load_units should round-trip."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        # Create mock tracked units
        mock_unit = MagicMock()
        mock_unit.custom_id = "unit_123_mail_only"
        mock_unit.document_id = 123
        mock_unit.issue_type = "mail_only"
        mock_unit.state.name = "TIER1_COMPLETE"
        mock_unit.tier1_batch_id = "batch_t1"
        mock_unit.tier2_batch_id = None
        mock_unit.tier3_batch_id = None
        mock_unit.error_message = None
        mock_unit.retry_count = 0

        persistence.save_units(run_dir, [mock_unit])
        loaded = persistence.load_units(run_dir)

        assert len(loaded) == 1
        assert loaded[0]["custom_id"] == "unit_123_mail_only"
        assert loaded[0]["document_id"] == 123
        assert loaded[0]["state"] == "TIER1_COMPLETE"

    def test_load_units_missing(self, persistence):
        """load_units should return empty list for missing file."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        result = persistence.load_units(run_dir)
        assert result == []

    def test_find_matching_run(self, persistence):
        """find_matching_run should find run with matching parameters."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only", "wet_signature"],
            max_tier=3,
            enable_web_search=True,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        found = persistence.find_matching_run(
            state="nj",
            issue_types=["wet_signature", "mail_only"],  # Order shouldn't matter
            max_tier=3,
        )

        assert found == run_dir

    def test_find_matching_run_no_match(self, persistence):
        """find_matching_run should return None when no match."""
        persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )

        # Different state
        found = persistence.find_matching_run(
            state="ny",
            issue_types=["mail_only"],
            max_tier=2,
        )
        assert found is None

    def test_find_matching_run_ignores_completed(self, persistence):
        """find_matching_run should ignore completed runs."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )
        persistence.update_manifest(run_dir, status=RunStatus.COMPLETED)

        found = persistence.find_matching_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
        )
        assert found is None

    def test_find_matching_run_with_title_filter(self, persistence):
        """find_matching_run should match title filter."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
            title_filter="3A",
        )

        # With matching filter
        found = persistence.find_matching_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            title_filter="3A",
        )
        assert found == run_dir

        # Without filter (should not match)
        found = persistence.find_matching_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
        )
        assert found is None

    def test_list_runs(self, persistence):
        """list_runs should return all runs."""
        run1 = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )
        run2 = persistence.create_run(
            state="ny",
            issue_types=["wet_signature"],
            max_tier=3,
            enable_web_search=True,
            max_docs_per_issue=50,
            global_docs_limit=50,
        )

        runs = persistence.list_runs()
        assert len(runs) == 2

    def test_list_runs_with_filter(self, persistence):
        """list_runs should filter by status."""
        run1 = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )
        run2 = persistence.create_run(
            state="ny",
            issue_types=["wet_signature"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )
        persistence.update_manifest(run2, status=RunStatus.COMPLETED)

        in_progress = persistence.list_runs(status_filter=RunStatus.IN_PROGRESS)
        assert len(in_progress) == 1

        completed = persistence.list_runs(status_filter=RunStatus.COMPLETED)
        assert len(completed) == 1

    def test_cleanup_old_runs(self, persistence):
        """cleanup_old_runs should remove old completed runs."""
        # Create 5 completed runs
        for i in range(5):
            run_dir = persistence.create_run(
                state="nj",
                issue_types=[f"type_{i}"],
                max_tier=2,
                enable_web_search=False,
                max_docs_per_issue=100,
                global_docs_limit=100,
            )
            persistence.update_manifest(run_dir, status=RunStatus.COMPLETED)

        # Keep only 2
        deleted = persistence.cleanup_old_runs(keep_last_n=2)

        assert deleted == 3
        remaining = persistence.list_runs(status_filter=RunStatus.COMPLETED)
        assert len(remaining) == 2

    def test_cleanup_old_runs_no_action_needed(self, persistence):
        """cleanup_old_runs should not delete when under limit."""
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit=100,
        )
        persistence.update_manifest(run_dir, status=RunStatus.COMPLETED)

        deleted = persistence.cleanup_old_runs(keep_last_n=5)
        assert deleted == 0
