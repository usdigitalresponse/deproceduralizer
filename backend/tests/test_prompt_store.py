"""
Tests for lib.prompt_store — prompt template storage for observability.

Tests:
- _canonical_params extracts only canonical keys
- _compute_hash is deterministic and order-independent
- _extract_system_prompt handles string, list, and None
- _extract_user_message handles string, list, and empty messages
- store_prompt_batch validates inputs and deduplicates
- _store_and_assign_prompts catches DB errors but propagates others
"""

import hashlib
import json
from unittest.mock import Mock, MagicMock, patch

import psycopg
import pytest

from lib.prompt_store import (
    _canonical_params,
    _compute_hash,
    _extract_system_prompt,
    _extract_user_message,
    _extract_tools,
    _validate_pipeline,
    store_prompt_batch,
    VALID_PIPELINES,
)


class TestCanonicalParams:
    """Tests for _canonical_params extraction."""

    def test_includes_only_canonical_keys(self):
        params = {
            "model": "claude-sonnet-4-5-20250929",
            "system": "You are helpful",
            "messages": [{"role": "user", "content": "hello"}],
            "tools": [{"name": "search"}],
            "tool_choice": {"type": "auto"},
            "max_tokens": 4096,
            "cache_control": {"type": "ephemeral"},
            "custom_id": "test_123",
            "metadata": {"foo": "bar"},
        }
        result = _canonical_params(params)
        assert set(result.keys()) == {"model", "system", "messages", "tools", "tool_choice", "max_tokens"}
        assert "cache_control" not in result
        assert "custom_id" not in result
        assert "metadata" not in result

    def test_excludes_cache_control_metadata(self):
        params = {
            "model": "claude-sonnet-4-5-20250929",
            "system": [{"type": "text", "text": "sys", "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": "hello", "cache_control": {"type": "ephemeral"}}
            ]}],
        }
        result = _canonical_params(params)
        # cache_control is within the system/messages structure — that's fine,
        # it's the top-level key that matters
        assert "cache_control" not in result

    def test_handles_missing_keys(self):
        params = {"model": "claude-haiku-4-5-20251001"}
        result = _canonical_params(params)
        assert result == {"model": "claude-haiku-4-5-20251001"}

    def test_order_independent_hashing(self):
        """Two dicts with same keys in different order produce the same canonical form."""
        params_a = {"model": "m", "system": "s", "max_tokens": 100}
        params_b = {"max_tokens": 100, "model": "m", "system": "s"}
        assert _compute_hash(_canonical_params(params_a)) == _compute_hash(_canonical_params(params_b))


class TestComputeHash:
    """Tests for _compute_hash."""

    def test_deterministic_for_same_input(self):
        params = {"model": "claude-sonnet-4-5-20250929", "system": "test"}
        h1 = _compute_hash(params)
        h2 = _compute_hash(params)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex length

    def test_different_for_different_input(self):
        h1 = _compute_hash({"model": "a"})
        h2 = _compute_hash({"model": "b"})
        assert h1 != h2


class TestExtractSystemPrompt:
    """Tests for _extract_system_prompt."""

    def test_string_system_prompt(self):
        assert _extract_system_prompt({"system": "You are helpful"}) == "You are helpful"

    def test_list_system_prompt(self):
        params = {"system": [
            {"type": "text", "text": "Part 1"},
            {"type": "text", "text": "Part 2"},
        ]}
        result = _extract_system_prompt(params)
        assert result == "Part 1\nPart 2"

    def test_none_returns_none(self):
        assert _extract_system_prompt({}) is None
        assert _extract_system_prompt({"system": None}) is None
        assert _extract_system_prompt({"system": ""}) is None

    def test_list_with_non_dict_items(self):
        params = {"system": [{"text": "good"}, "bad_item", {"text": "also good"}]}
        result = _extract_system_prompt(params)
        assert "good" in result
        assert "also good" in result


class TestExtractUserMessage:
    """Tests for _extract_user_message."""

    def test_string_content(self):
        params = {"messages": [{"role": "user", "content": "hello"}]}
        assert _extract_user_message(params) == "hello"

    def test_list_content(self):
        params = {"messages": [{"role": "user", "content": [
            {"type": "text", "text": "Part A"},
            {"type": "text", "text": "Part B"},
        ]}]}
        result = _extract_user_message(params)
        assert result == "Part A\nPart B"

    def test_empty_messages(self):
        assert _extract_user_message({}) is None
        assert _extract_user_message({"messages": []}) is None


class TestValidatePipeline:
    """Tests for pipeline validation."""

    def test_valid_pipelines_accepted(self):
        for p in VALID_PIPELINES:
            _validate_pipeline(p)  # Should not raise

    def test_invalid_pipeline_raises(self):
        with pytest.raises(ValueError, match="Invalid pipeline"):
            _validate_pipeline("invalid")

    def test_empty_pipeline_raises(self):
        with pytest.raises(ValueError, match="Invalid pipeline"):
            _validate_pipeline("")


class TestStorePromptBatch:
    """Tests for store_prompt_batch with mocked DB."""

    def _make_request(self, custom_id="test_123", model="claude-sonnet-4-5-20250929"):
        return {
            "custom_id": custom_id,
            "params": {
                "model": model,
                "system": "You are helpful",
                "messages": [{"role": "user", "content": "hello"}],
                "max_tokens": 4096,
            },
        }

    def test_empty_input_returns_empty_dict(self):
        assert store_prompt_batch([], pipeline="research") == {}

    def test_raises_on_missing_custom_id(self):
        with pytest.raises(ValueError, match="missing 'custom_id'"):
            store_prompt_batch(
                [{"params": {"model": "m"}}],
                pipeline="research",
            )

    def test_raises_on_invalid_pipeline(self):
        with pytest.raises(ValueError, match="Invalid pipeline"):
            store_prompt_batch(
                [self._make_request()],
                pipeline="invalid",
            )

    @patch("lib.prompt_store.get_db_connection")
    def test_raises_on_none_connection(self, mock_get_conn):
        mock_get_conn.return_value = None
        with pytest.raises(psycopg.OperationalError, match="database connection"):
            store_prompt_batch(
                [self._make_request()],
                pipeline="research",
                tier=1,
            )

    @patch("lib.prompt_store.get_db_connection")
    def test_deduplicates_identical_params(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (42,)
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
        mock_get_conn.return_value = mock_conn

        # Two requests with identical params should produce one upsert
        requests = [
            self._make_request(custom_id="a_1"),
            self._make_request(custom_id="b_2"),
        ]
        result = store_prompt_batch(requests, pipeline="research", tier=1)

        # Both custom_ids should map to the same prompt_id
        assert result == {"a_1": 42, "b_2": 42}
        # Only one INSERT should have been executed (deduplicated)
        assert mock_cursor.execute.call_count == 1

    @patch("lib.prompt_store.get_db_connection")
    def test_maps_custom_ids_to_prompt_ids(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # Return different IDs for different hashes
        mock_cursor.fetchone.side_effect = [(10,), (20,)]
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
        mock_get_conn.return_value = mock_conn

        requests = [
            self._make_request(custom_id="a_1", model="model-a"),
            self._make_request(custom_id="b_2", model="model-b"),
        ]
        result = store_prompt_batch(requests, pipeline="research", tier=1)

        assert len(result) == 2
        assert "a_1" in result
        assert "b_2" in result

    @patch("lib.prompt_store.get_db_connection")
    def test_raises_on_missing_model(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
        mock_get_conn.return_value = mock_conn

        requests = [{
            "custom_id": "test_1",
            "params": {"system": "no model here", "messages": []},
        }]
        with pytest.raises(ValueError, match="missing 'model'"):
            store_prompt_batch(requests, pipeline="research", tier=1)


def _make_tracked_unit(document_id: int, issue_type: str, source_type: str = "regulation"):
    """Helper to create a TrackedUnit for testing."""
    from scripts.research_pipeline.state_machine import TrackedUnit
    from scripts.research_pipeline.models.matches import ProcessingUnit

    pu = ProcessingUnit(
        document_id=document_id,
        issue_type=issue_type,
        source_type=source_type,
        matches=[],
        citation="test-citation",
        title="test-title",
        content="test-content",
    )
    return TrackedUnit(unit=pu)


class TestStoreAndAssignPrompts:
    """Tests for _store_and_assign_prompts in pipeline_runner."""

    def test_db_error_does_not_block_pipeline(self):
        from scripts.research_pipeline.pipeline_runner import _store_and_assign_prompts

        units = [_make_tracked_unit(1, "notarization")]
        out = MagicMock()

        with patch("scripts.research_pipeline.pipeline_runner.store_prompt_batch") as mock_store:
            mock_store.side_effect = psycopg.OperationalError("connection lost")
            # Should not raise
            _store_and_assign_prompts(
                [{"custom_id": "notarization_1", "params": {"model": "m"}}],
                units, "research", 1, "tier1_prompt_id", out,
            )
        # Warning should have been logged
        out.info.assert_called_once()
        assert "non-fatal" in out.info.call_args[0][0]

    def test_non_db_error_propagates(self):
        from scripts.research_pipeline.pipeline_runner import _store_and_assign_prompts

        units = [_make_tracked_unit(1, "notarization")]
        out = MagicMock()

        with patch("scripts.research_pipeline.pipeline_runner.store_prompt_batch") as mock_store:
            mock_store.side_effect = ValueError("bad pipeline name")
            with pytest.raises(ValueError, match="bad pipeline name"):
                _store_and_assign_prompts(
                    [{"custom_id": "notarization_1", "params": {"model": "m"}}],
                    units, "research", 1, "tier1_prompt_id", out,
                )

    def test_assigns_prompt_ids_to_units(self):
        from scripts.research_pipeline.pipeline_runner import _store_and_assign_prompts

        units = [
            _make_tracked_unit(1, "notarization"),
            _make_tracked_unit(2, "fax_required"),
        ]
        out = MagicMock()

        with patch("scripts.research_pipeline.pipeline_runner.store_prompt_batch") as mock_store:
            mock_store.return_value = {"notarization_1": 100, "fax_required_2": 200}
            _store_and_assign_prompts(
                [{"custom_id": "notarization_1"}, {"custom_id": "fax_required_2"}],
                units, "research", 1, "tier1_prompt_id", out,
            )

        assert units[0].tier1_prompt_id == 100
        assert units[1].tier1_prompt_id == 200
