"""
Tests for connection pooling in lib/db.py.

Tests:
- Pool creation and singleton behavior
- get_db_connection() returns pooled connections
- Fallback to direct connection when pool unavailable
- Clean shutdown via atexit
"""

from unittest.mock import Mock, patch, MagicMock, call

import psycopg
import pytest


class TestGetPool:
    """Tests for the _get_pool() lazy singleton."""

    def setup_method(self):
        """Reset pool singleton before each test."""
        import lib.db
        lib.db._pool = None

    def teardown_method(self):
        """Reset pool singleton after each test."""
        import lib.db
        lib.db._pool = None

    @patch("lib.db.os.getenv", return_value=None)
    def test_returns_none_without_database_url(self, mock_getenv):
        """Pool creation returns None when DATABASE_URL is not set."""
        from lib.db import _get_pool

        result = _get_pool()

        assert result is None

    @patch("lib.db.atexit.register")
    @patch("psycopg_pool.ConnectionPool")
    @patch("lib.db.os.getenv", return_value="postgresql://localhost/test")
    def test_creates_pool_with_correct_params(self, mock_getenv, mock_pool_cls, mock_atexit):
        """Pool is created with expected min_size, max_size, max_idle."""
        from lib.db import _get_pool

        mock_pool = MagicMock()
        mock_pool_cls.return_value = mock_pool

        result = _get_pool()

        assert result is mock_pool
        mock_pool_cls.assert_called_once()
        kwargs = mock_pool_cls.call_args
        assert kwargs.kwargs["min_size"] == 2
        assert kwargs.kwargs["max_size"] == 10
        assert kwargs.kwargs["max_idle"] == 300

    @patch("lib.db.atexit.register")
    @patch("psycopg_pool.ConnectionPool")
    @patch("lib.db.os.getenv", return_value="postgresql://localhost/test")
    def test_registers_atexit_handler(self, mock_getenv, mock_pool_cls, mock_atexit):
        """Pool registers atexit.close for clean shutdown."""
        from lib.db import _get_pool

        mock_pool = MagicMock()
        mock_pool_cls.return_value = mock_pool

        _get_pool()

        mock_atexit.assert_called_once_with(mock_pool.close)

    @patch("lib.db.atexit.register")
    @patch("psycopg_pool.ConnectionPool")
    @patch("lib.db.os.getenv", return_value="postgresql://localhost/test")
    def test_singleton_returns_same_pool(self, mock_getenv, mock_pool_cls, mock_atexit):
        """Second call returns the same pool instance (no re-creation)."""
        from lib.db import _get_pool

        mock_pool = MagicMock()
        mock_pool_cls.return_value = mock_pool

        pool1 = _get_pool()
        pool2 = _get_pool()

        assert pool1 is pool2
        # Pool class should only be instantiated once
        assert mock_pool_cls.call_count == 1

    @patch("psycopg_pool.ConnectionPool", side_effect=Exception("pool init failed"))
    @patch("lib.db.os.getenv", return_value="postgresql://localhost/test")
    def test_returns_none_on_pool_creation_failure(self, mock_getenv, mock_pool_cls):
        """Returns None if pool creation raises an exception."""
        from lib.db import _get_pool

        result = _get_pool()

        assert result is None


class TestGetDbConnection:
    """Tests for get_db_connection() with pool integration."""

    def setup_method(self):
        import lib.db
        lib.db._pool = None

    def teardown_method(self):
        import lib.db
        lib.db._pool = None

    @patch("lib.db._get_pool")
    def test_returns_connection_from_pool(self, mock_get_pool):
        """When pool is available, returns connection from pool.getconn()."""
        from lib.db import get_db_connection

        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.getconn.return_value = mock_conn
        mock_get_pool.return_value = mock_pool

        result = get_db_connection()

        assert result is mock_conn
        mock_pool.getconn.assert_called_once()

    @patch("lib.db._configure_conn")
    @patch("lib.db.psycopg.connect")
    @patch("lib.db.os.getenv", return_value="postgresql://localhost/test")
    @patch("lib.db._get_pool", return_value=None)
    def test_falls_back_to_direct_connection(self, mock_pool, mock_getenv, mock_connect, mock_configure):
        """When pool is None, falls back to direct psycopg.connect()."""
        from lib.db import get_db_connection

        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn

        result = get_db_connection()

        assert result is mock_conn
        mock_connect.assert_called_once()
        mock_configure.assert_called_once_with(mock_conn)

    @patch("lib.db._configure_conn")
    @patch("lib.db.psycopg.connect")
    @patch("lib.db.os.getenv", return_value="postgresql://localhost/test")
    @patch("lib.db._get_pool")
    def test_falls_back_when_pool_getconn_fails(self, mock_get_pool, mock_getenv, mock_connect, mock_configure):
        """When pool.getconn() raises, falls back to direct connection."""
        from lib.db import get_db_connection

        mock_pool = MagicMock()
        mock_pool.getconn.side_effect = Exception("pool exhausted")
        mock_get_pool.return_value = mock_pool

        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn

        result = get_db_connection()

        assert result is mock_conn

    @patch("lib.db.os.getenv", return_value=None)
    @patch("lib.db._get_pool", return_value=None)
    def test_returns_none_when_no_url_and_no_pool(self, mock_pool, mock_getenv):
        """Returns None when no pool and no DATABASE_URL."""
        from lib.db import get_db_connection

        result = get_db_connection()

        assert result is None


class TestConfigureConn:
    """Tests for _configure_conn() callback."""

    def test_sets_statement_timeout(self):
        """Configures statement_timeout on new connections."""
        from lib.db import _configure_conn

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)

        _configure_conn(mock_conn)

        mock_cursor.execute.assert_called_once_with("SET statement_timeout = '300000ms'")
        mock_conn.commit.assert_called_once()  # Must commit to leave conn IDLE for pool
