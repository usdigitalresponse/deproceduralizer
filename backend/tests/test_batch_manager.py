"""
Tests for BatchManager.load_requests and result_processor graceful degradation.

Run with: cd backend && pytest tests/test_batch_manager.py -v
"""

import pytest
import json
from pathlib import Path
from unittest.mock import Mock, MagicMock
import tempfile
import shutil


# =============================================================================
# UNIT TESTS - BatchManager.load_requests
# =============================================================================


class TestBatchManagerLoadRequests:
    """Test BatchManager.load_requests method."""

    def test_load_requests_no_batches_dir(self):
        """load_requests returns empty dict when batches_dir is None."""
        from lib.batch import BatchManager

        # Create manager without batches_dir
        manager = BatchManager(batches_dir=None, client=Mock())

        result = manager.load_requests("msgbatch_123")
        assert result == {}

    def test_load_requests_unknown_batch_id(self, tmp_path):
        """load_requests returns empty dict for unknown batch_id."""
        from lib.batch import BatchManager

        # Create manager with empty batches_dir
        manager = BatchManager(batches_dir=tmp_path, client=Mock())

        result = manager.load_requests("msgbatch_unknown")
        assert result == {}

    def test_load_requests_via_mapping_file(self, tmp_path):
        """load_requests uses batch_mapping.json for fast lookup."""
        from lib.batch import BatchManager

        # Create batch directory with requests file
        batch_dir = tmp_path / "test_batch_20260108_123456"
        batch_dir.mkdir()

        requests = {
            "mail_only_123": {"custom_id": "mail_only_123", "params": {"model": "claude-sonnet"}},
            "mail_only_456": {"custom_id": "mail_only_456", "params": {"model": "claude-sonnet"}},
        }
        (batch_dir / "requests.json").write_text(json.dumps(requests))

        # Create mapping file
        mapping = {"msgbatch_abc123": str(batch_dir)}
        (tmp_path / "batch_mapping.json").write_text(json.dumps(mapping))

        # Create manager and load requests
        manager = BatchManager(batches_dir=tmp_path, client=Mock())
        result = manager.load_requests("msgbatch_abc123")

        assert result == requests
        assert "mail_only_123" in result
        assert "mail_only_456" in result

    def test_load_requests_fallback_to_find_batch_dir(self, tmp_path):
        """load_requests falls back to find_batch_dir when mapping doesn't exist."""
        from lib.batch import BatchManager

        # Create batch directory with batch_info.json (used by find_batch_dir)
        batch_dir = tmp_path / "test_batch_20260108_123456"
        batch_dir.mkdir()

        batch_info = {"batch_api_id": "msgbatch_xyz789"}
        (batch_dir / "batch_info.json").write_text(json.dumps(batch_info))

        requests = {"issue_100": {"custom_id": "issue_100"}}
        (batch_dir / "requests.json").write_text(json.dumps(requests))

        # No mapping file - should use find_batch_dir
        manager = BatchManager(batches_dir=tmp_path, client=Mock())
        result = manager.load_requests("msgbatch_xyz789")

        assert result == requests

    def test_load_requests_handles_missing_requests_file(self, tmp_path):
        """load_requests returns empty dict if requests.json doesn't exist."""
        from lib.batch import BatchManager

        # Create batch directory without requests.json
        batch_dir = tmp_path / "test_batch"
        batch_dir.mkdir()

        mapping = {"msgbatch_abc": str(batch_dir)}
        (tmp_path / "batch_mapping.json").write_text(json.dumps(mapping))

        manager = BatchManager(batches_dir=tmp_path, client=Mock())
        result = manager.load_requests("msgbatch_abc")

        assert result == {}

    def test_load_requests_handles_corrupt_json(self, tmp_path):
        """load_requests returns empty dict on corrupt JSON files."""
        from lib.batch import BatchManager

        # Create batch directory with corrupt requests.json
        batch_dir = tmp_path / "test_batch"
        batch_dir.mkdir()
        (batch_dir / "requests.json").write_text("{ invalid json }")

        mapping = {"msgbatch_corrupt": str(batch_dir)}
        (tmp_path / "batch_mapping.json").write_text(json.dumps(mapping))

        manager = BatchManager(batches_dir=tmp_path, client=Mock())
        result = manager.load_requests("msgbatch_corrupt")

        assert result == {}


# =============================================================================
# INTEGRATION TEST - submit_batch saves requests
# =============================================================================


class TestBatchManagerSubmitSavesRequests:
    """Test that submit_batch saves requests for later retrieval."""

    def test_submit_batch_creates_requests_file(self, tmp_path):
        """submit_batch creates requests.json with custom_id -> request mapping."""
        from lib.batch import BatchManager

        # Mock the Anthropic client
        mock_client = Mock()
        mock_batch = Mock()
        mock_batch.id = "msgbatch_test123"
        mock_client.beta.messages.batches.create.return_value = mock_batch

        manager = BatchManager(batches_dir=tmp_path, client=mock_client)

        # Submit a batch
        requests = [
            {"custom_id": "req_1", "params": {"model": "claude"}},
            {"custom_id": "req_2", "params": {"model": "claude"}},
        ]
        batch_id = manager.submit_batch(requests, batch_name="test")

        assert batch_id == "msgbatch_test123"

        # Find the created batch directory
        batch_dirs = [d for d in tmp_path.iterdir() if d.is_dir() and d.name.startswith("test_")]
        assert len(batch_dirs) == 1
        batch_dir = batch_dirs[0]

        # Verify requests.json was created
        requests_file = batch_dir / "requests.json"
        assert requests_file.exists()

        saved_requests = json.loads(requests_file.read_text())
        assert "req_1" in saved_requests
        assert "req_2" in saved_requests

    def test_submit_batch_creates_mapping_file(self, tmp_path):
        """submit_batch creates/updates batch_mapping.json."""
        from lib.batch import BatchManager

        mock_client = Mock()
        mock_batch = Mock()
        mock_batch.id = "msgbatch_mapped"
        mock_client.beta.messages.batches.create.return_value = mock_batch

        manager = BatchManager(batches_dir=tmp_path, client=mock_client)

        requests = [{"custom_id": "req_a"}]
        manager.submit_batch(requests, batch_name="mapping_test")

        # Verify mapping file exists
        mapping_file = tmp_path / "batch_mapping.json"
        assert mapping_file.exists()

        mapping = json.loads(mapping_file.read_text())
        assert "msgbatch_mapped" in mapping

    def test_submit_then_load_round_trip(self, tmp_path):
        """Verify submitted requests can be loaded back."""
        from lib.batch import BatchManager

        mock_client = Mock()
        mock_batch = Mock()
        mock_batch.id = "msgbatch_roundtrip"
        mock_client.beta.messages.batches.create.return_value = mock_batch

        manager = BatchManager(batches_dir=tmp_path, client=mock_client)

        original_requests = [
            {"custom_id": "mail_only_100", "params": {"messages": [{"role": "user", "content": "test"}]}},
            {"custom_id": "mail_only_200", "params": {"messages": [{"role": "user", "content": "test2"}]}},
        ]
        batch_id = manager.submit_batch(original_requests, batch_name="roundtrip")

        # Load requests back
        loaded = manager.load_requests(batch_id)

        assert "mail_only_100" in loaded
        assert "mail_only_200" in loaded
        assert loaded["mail_only_100"]["params"]["messages"][0]["content"] == "test"


# =============================================================================
# RESULT PROCESSOR GRACEFUL DEGRADATION
# =============================================================================


class TestResultProcessorGracefulDegradation:
    """Test that result_processor handles missing load_requests gracefully."""

    def test_process_tier_results_without_load_requests(self):
        """
        Verify processing continues when manager doesn't have load_requests.

        This simulates the scenario that caused the original crash.
        """
        from unittest.mock import Mock, MagicMock
        from scripts.research_pipeline.result_processor import process_tier_results
        from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
        from scripts.research_pipeline.models.matches import ProcessingUnit
        from scripts.research_pipeline.models.llm_outputs import Tier1Output

        # Create a manager mock WITHOUT load_requests method
        mock_manager = Mock(spec=['get_batch_results', 'get_batch_status'])

        # Mock batch result
        mock_result = MagicMock()
        mock_result.custom_id = "mail_only_123"
        mock_result.result.type = "succeeded"
        mock_result.result.message.usage.input_tokens = 100
        mock_result.result.message.usage.output_tokens = 50
        mock_result.result.message.usage.cache_read_input_tokens = 0
        mock_result.result.message.usage.cache_creation_input_tokens = 0

        # Mock tool_use block with valid Tier1Output
        mock_tool_use = MagicMock()
        mock_tool_use.type = "tool_use"
        mock_tool_use.input = {
            "classification": "all_false_positives",
            "false_positives": [{"match_id": "m1", "reason": "test"}],
            "surviving_matches": [],
            "context_requests": [],
        }
        mock_result.result.message.content = [mock_tool_use]

        mock_manager.get_batch_results.return_value = [mock_result]

        # Create a minimal TrackedUnit
        pu = ProcessingUnit(
            document_id=123,
            issue_type="mail_only",
            citation="Test",
            title="Test",
            content="Test content",
            matches=[],
            state="NJ",
        )
        tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
        units = {tracked.custom_id: tracked}

        # This should NOT raise AttributeError
        # Even with trace_context=None (no Langfuse), this tests the hasattr check
        succeeded, failed = process_tier_results(
            batch_id="msgbatch_test",
            units=units,
            manager=mock_manager,
            output_model=Tier1Output,
            tier=1,
            cost_tracker=None,
            trace_context=None,  # Langfuse disabled
        )

        # Basic sanity check - one unit was processed
        assert len(succeeded) + len(failed) == 1

    def test_process_tier_results_with_langfuse_but_no_load_requests(self):
        """
        Verify processing continues with Langfuse enabled but no load_requests.

        This tests the actual code path where the crash occurred.
        """
        # Import LANGFUSE_AVAILABLE to check if we can test this path
        from scripts.research_pipeline.result_processor import LANGFUSE_AVAILABLE

        if not LANGFUSE_AVAILABLE:
            pytest.skip("Langfuse not available, can't test this code path")

        from scripts.research_pipeline.result_processor import process_tier_results
        from scripts.research_pipeline.state_machine import TrackedUnit, ProcessingState
        from scripts.research_pipeline.models.matches import ProcessingUnit
        from scripts.research_pipeline.models.llm_outputs import Tier1Output
        from observability.types import LLMTraceContext

        # Create manager mock WITHOUT load_requests
        mock_manager = Mock(spec=['get_batch_results', 'get_batch_status'])

        # Mock successful result
        mock_result = MagicMock()
        mock_result.custom_id = "mail_only_456"
        mock_result.result.type = "succeeded"
        mock_result.result.message.usage.input_tokens = 100
        mock_result.result.message.usage.output_tokens = 50
        mock_result.result.message.usage.cache_read_input_tokens = 0
        mock_result.result.message.usage.cache_creation_input_tokens = 0

        mock_tool_use = MagicMock()
        mock_tool_use.type = "tool_use"
        mock_tool_use.input = {
            "classification": "needs_research",
            "false_positives": [],
            "surviving_matches": [{"match_id": "m1"}],
            "context_requests": [],
        }
        mock_result.result.message.content = [mock_tool_use]

        mock_manager.get_batch_results.return_value = [mock_result]

        # Create TrackedUnit
        pu = ProcessingUnit(
            document_id=456,
            issue_type="mail_only",
            citation="Test",
            title="Test",
            content="Test content",
            matches=[],
            state="NJ",
        )
        tracked = TrackedUnit(unit=pu, state=ProcessingState.PENDING)
        units = {tracked.custom_id: tracked}

        # Create trace context to trigger Langfuse code path
        trace_context = LLMTraceContext(
            run_id="test_run",
            session_name="test_session",
            stage="tier1",
            state="NJ",
            issue_type="mail_only",
        )

        # This should NOT raise AttributeError - graceful degradation should work
        succeeded, failed = process_tier_results(
            batch_id="msgbatch_langfuse_test",
            units=units,
            manager=mock_manager,
            output_model=Tier1Output,
            tier=1,
            cost_tracker=None,
            trace_context=trace_context,
        )

        # Processing should complete (even if Langfuse logging was skipped)
        assert len(succeeded) + len(failed) == 1
