"""
Tests for database connection resilience features.

Tests:
- retry_db_operation decorator
- check_db_health function
- FailedUnitTracker class
"""

import time
from unittest.mock import Mock, patch, MagicMock

import psycopg
import pytest

from scripts.research_pipeline.db.connection import (
    retry_db_operation,
    check_db_health,
    FailedUnitTracker,
)


# =============================================================================
# retry_db_operation Tests
# =============================================================================


class TestRetryDbOperation:
    """Tests for the retry_db_operation decorator."""

    def test_success_no_retry(self):
        """Function succeeds on first call - no retry needed."""
        call_count = 0

        @retry_db_operation(max_retries=3, base_delay=0.01)
        def successful_func():
            nonlocal call_count
            call_count += 1
            return "success"

        result = successful_func()

        assert result == "success"
        assert call_count == 1

    def test_retry_on_operational_error(self):
        """Retries on psycopg.OperationalError and eventually succeeds."""
        call_count = 0

        @retry_db_operation(max_retries=3, base_delay=0.01)
        def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise psycopg.OperationalError("connection lost")
            return "success"

        result = flaky_func()

        assert result == "success"
        assert call_count == 3  # Failed twice, succeeded on third

    def test_retry_on_interface_error(self):
        """Retries on psycopg.InterfaceError."""
        call_count = 0

        @retry_db_operation(max_retries=3, base_delay=0.01)
        def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise psycopg.InterfaceError("interface error")
            return "success"

        result = flaky_func()

        assert result == "success"
        assert call_count == 2

    def test_raises_after_max_retries(self):
        """Raises exception after max retries exhausted."""
        call_count = 0

        @retry_db_operation(max_retries=3, base_delay=0.01)
        def always_fails():
            nonlocal call_count
            call_count += 1
            raise psycopg.OperationalError("connection lost")

        with pytest.raises(psycopg.OperationalError):
            always_fails()

        assert call_count == 3  # Tried 3 times

    def test_does_not_retry_on_other_exceptions(self):
        """Does not retry on non-connection exceptions."""
        call_count = 0

        @retry_db_operation(max_retries=3, base_delay=0.01)
        def bad_query():
            nonlocal call_count
            call_count += 1
            raise ValueError("bad query")

        with pytest.raises(ValueError):
            bad_query()

        assert call_count == 1  # No retry for ValueError

    def test_exponential_backoff(self):
        """Verifies exponential backoff between retries."""
        call_times = []

        @retry_db_operation(max_retries=4, base_delay=0.05)
        def timed_func():
            call_times.append(time.time())
            if len(call_times) < 4:
                raise psycopg.OperationalError("connection lost")
            return "success"

        result = timed_func()

        assert result == "success"
        assert len(call_times) == 4

        # Check delays: should be approximately 0.05, 0.10, 0.20 seconds
        delay1 = call_times[1] - call_times[0]
        delay2 = call_times[2] - call_times[1]
        delay3 = call_times[3] - call_times[2]

        # Allow 50% tolerance for test stability
        assert 0.025 <= delay1 <= 0.10, f"delay1={delay1}"
        assert 0.05 <= delay2 <= 0.20, f"delay2={delay2}"
        assert 0.10 <= delay3 <= 0.40, f"delay3={delay3}"

    def test_preserves_function_args(self):
        """Decorator preserves function arguments."""
        @retry_db_operation(max_retries=2, base_delay=0.01)
        def func_with_args(a, b, keyword=None):
            return f"{a}-{b}-{keyword}"

        result = func_with_args(1, 2, keyword="test")
        assert result == "1-2-test"

    def test_preserves_return_type(self):
        """Decorator preserves return types (dict, list, etc.)."""
        @retry_db_operation(max_retries=2, base_delay=0.01)
        def returns_dict():
            return {"key": "value", "count": 42}

        result = returns_dict()
        assert result == {"key": "value", "count": 42}


# =============================================================================
# check_db_health Tests
# =============================================================================


class TestCheckDbHealth:
    """Tests for the check_db_health function."""

    @patch("scripts.research_pipeline.db.connection.get_db_connection")
    def test_returns_true_when_healthy(self, mock_get_conn):
        """Returns True when database responds to SELECT 1."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = check_db_health()

        assert result is True
        mock_cursor.execute.assert_called_once_with("SELECT 1")
        mock_conn.close.assert_called_once()

    @patch("scripts.research_pipeline.db.connection.get_db_connection")
    def test_returns_false_when_connection_fails(self, mock_get_conn):
        """Returns False when connection cannot be established."""
        mock_get_conn.return_value = None

        result = check_db_health()

        assert result is False

    @patch("scripts.research_pipeline.db.connection.get_db_connection")
    def test_returns_false_on_exception(self, mock_get_conn):
        """Returns False when query raises exception."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = psycopg.OperationalError("timeout")
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
        mock_get_conn.return_value = mock_conn

        result = check_db_health()

        assert result is False


# =============================================================================
# FailedUnitTracker Tests
# =============================================================================


class TestFailedUnitTracker:
    """Tests for the FailedUnitTracker class."""

    def test_record_failure(self):
        """Records a failed unit with document_id, issue_type, and error."""
        tracker = FailedUnitTracker()
        error = ValueError("test error")

        tracker.record_failure("12345", "mail_only", error)

        assert len(tracker.failed_units) == 1
        assert tracker.failed_units[0] == ("12345", "mail_only", error)

    def test_has_failures_empty(self):
        """has_failures returns False when no failures."""
        tracker = FailedUnitTracker()

        assert tracker.has_failures() is False

    def test_has_failures_with_failures(self):
        """has_failures returns True after recording failures."""
        tracker = FailedUnitTracker()
        tracker.record_failure("123", "wet_signature", ValueError("err"))

        assert tracker.has_failures() is True

    def test_multiple_failures(self):
        """Can record multiple failures."""
        tracker = FailedUnitTracker()
        tracker.record_failure("1", "mail_only", ValueError("err1"))
        tracker.record_failure("2", "wet_signature", RuntimeError("err2"))
        tracker.record_failure("3", "in_person", TimeoutError("err3"))

        assert len(tracker.failed_units) == 3

    def test_report_empty(self, capsys):
        """report() prints nothing when no failures."""
        tracker = FailedUnitTracker()

        tracker.report()

        captured = capsys.readouterr()
        assert captured.out == ""

    def test_report_with_failures(self, capsys):
        """report() prints summary of failed units."""
        tracker = FailedUnitTracker()
        tracker.record_failure("123", "mail_only", ValueError("connection lost"))
        tracker.record_failure("456", "wet_signature", TimeoutError("timeout"))

        tracker.report()

        captured = capsys.readouterr()
        assert "FAILED UNITS (2 total)" in captured.out
        assert "doc_id=123 (mail_only)" in captured.out
        assert "doc_id=456 (wet_signature)" in captured.out
        assert "ValueError" in captured.out
        assert "TimeoutError" in captured.out

    def test_clear(self):
        """clear() removes all recorded failures."""
        tracker = FailedUnitTracker()
        tracker.record_failure("123", "mail_only", ValueError("err"))
        tracker.record_failure("456", "wet_signature", ValueError("err"))

        assert tracker.has_failures() is True

        tracker.clear()

        assert tracker.has_failures() is False
        assert len(tracker.failed_units) == 0
