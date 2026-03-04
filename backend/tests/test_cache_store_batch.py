"""
Tests for CacheManager.store_batch() executemany optimization.

Tests:
- executemany is called instead of per-entry execute
- Correct parameter tuple structure
- Error handling (rollback on failure)
- Empty entries handled gracefully
"""

import json
from unittest.mock import Mock, patch, MagicMock, call

import psycopg
import pytest

from lib.cache import CacheManager


def _make_entry(
    request_hash: str = "abc123",
    model: str = "claude-sonnet-4-6",
    request_body: dict = None,
    response_body: dict = None,
    usage: dict = None,
    pipeline: str = "research",
    tier: int = 1,
    document_id: int = 42,
) -> dict:
    """Create a cache entry dict for testing."""
    return {
        "request_hash": request_hash,
        "model": model,
        "request_body": request_body or {"messages": [{"role": "user", "content": "test"}]},
        "response_body": response_body or {"content": [{"text": "response"}]},
        "usage": usage or {"input_tokens": 100, "output_tokens": 50},
        "pipeline": pipeline,
        "tier": tier,
        "document_id": document_id,
    }


class TestStoreBatch:
    """Tests for the executemany-based store_batch."""

    def test_empty_entries_is_noop(self):
        """Empty entries list does nothing."""
        mock_conn = MagicMock()
        cache = CacheManager(enabled=True, conn=mock_conn)

        cache.store_batch([])

        mock_conn.cursor.assert_not_called()

    def test_disabled_cache_is_noop(self):
        """Disabled cache does nothing even with entries."""
        mock_conn = MagicMock()
        cache = CacheManager(enabled=False, conn=mock_conn)

        cache.store_batch([_make_entry()])

        mock_conn.cursor.assert_not_called()

    def test_uses_executemany_not_execute(self):
        """store_batch uses executemany (pipelined) instead of per-entry execute."""
        mock_conn = MagicMock()
        mock_conn.closed = False  # Prevent conn property from calling get_db_connection
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        cache = CacheManager(enabled=True, conn=mock_conn)

        entries = [_make_entry(request_hash=f"hash_{i}") for i in range(5)]
        cache.store_batch(entries)

        # Should call executemany once, NOT execute 5 times
        mock_cursor.executemany.assert_called_once()
        mock_cursor.execute.assert_not_called()
        mock_conn.commit.assert_called_once()

    def test_executemany_receives_correct_param_count(self):
        """Each tuple in the params_seq has 13 elements (matching 13 placeholders)."""
        mock_conn = MagicMock()
        mock_conn.closed = False
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        cache = CacheManager(enabled=True, conn=mock_conn)

        entries = [_make_entry(), _make_entry(request_hash="other")]
        cache.store_batch(entries)

        call_args = mock_cursor.executemany.call_args
        params_seq = call_args[0][1]  # Second positional arg is params_seq

        assert len(params_seq) == 2
        for params in params_seq:
            assert len(params) == 13, f"Expected 13 params, got {len(params)}"

    def test_params_contain_correct_values(self):
        """Params tuple contains the entry values in correct order."""
        mock_conn = MagicMock()
        mock_conn.closed = False
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        cache = CacheManager(enabled=True, conn=mock_conn)

        entry = _make_entry(
            request_hash="test_hash",
            model="claude-haiku-4-5-20251001",
            pipeline="jenai",
            tier=2,
            document_id=99,
        )
        entry["usage"] = {"input_tokens": 200, "output_tokens": 75, "cache_read_tokens": 50, "cache_write_tokens": 25}

        cache.store_batch([entry])

        params_seq = mock_cursor.executemany.call_args[0][1]
        params = params_seq[0]

        assert params[0] == "test_hash"       # request_hash
        assert params[1] == "claude-haiku-4-5-20251001"  # model
        assert json.loads(params[2]) == entry["request_body"]   # request_body (JSON)
        assert json.loads(params[3]) == entry["response_body"]  # response_body (JSON)
        assert params[4] == 200               # input_tokens
        assert params[5] == 75                # output_tokens
        assert params[6] == 50                # cache_read_tokens
        assert params[7] == 25                # cache_write_tokens
        assert params[8] == "jenai"           # pipeline
        assert params[9] == 2                 # tier
        assert params[10] == 99              # document_id

    def test_missing_usage_fields_default_to_none(self):
        """Missing usage keys produce None values in params."""
        mock_conn = MagicMock()
        mock_conn.closed = False
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        cache = CacheManager(enabled=True, conn=mock_conn)

        entry = _make_entry()
        entry["usage"] = {}  # Empty usage

        cache.store_batch([entry])

        params = mock_cursor.executemany.call_args[0][1][0]
        assert params[4] is None  # input_tokens
        assert params[5] is None  # output_tokens
        assert params[6] is None  # cache_read_tokens
        assert params[7] is None  # cache_write_tokens

    def test_rollback_on_psycopg_error(self):
        """Rolls back on psycopg.Error during executemany."""
        mock_conn = MagicMock()
        mock_conn.closed = False
        mock_cursor = MagicMock()
        mock_cursor.executemany.side_effect = psycopg.Error("batch insert failed")
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        cache = CacheManager(enabled=True, conn=mock_conn)

        cache.store_batch([_make_entry()])

        mock_conn.rollback.assert_called_once()
        mock_conn.commit.assert_not_called()

    def test_conn_reset_on_rollback_failure(self):
        """Resets _conn to None if rollback also fails."""
        mock_conn = MagicMock()
        mock_conn.closed = False
        mock_cursor = MagicMock()
        mock_cursor.executemany.side_effect = psycopg.Error("insert failed")
        mock_conn.rollback.side_effect = psycopg.Error("rollback failed")
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        cache = CacheManager(enabled=True, conn=mock_conn)

        cache.store_batch([_make_entry()])

        assert cache._conn is None
