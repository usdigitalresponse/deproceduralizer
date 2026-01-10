"""
Centralized database connection management for the research pipeline.

Provides context managers for safe connection handling with automatic
cleanup and transaction support. Also provides:
- retry_db_operation: Decorator for retrying DB operations on connection failures
- check_db_health: Health check function to ping database
- FailedUnitTracker: Track and report units that failed due to DB errors
"""

import functools
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Generator, Callable, TypeVar, Any

import psycopg
from psycopg import Connection

# Import existing connection function from shared_utils
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from shared_utils import get_db_connection


# Type variable for generic return type
T = TypeVar('T')


def retry_db_operation(max_retries: int = 5, base_delay: float = 1.0) -> Callable:
    """
    Decorator that retries DB operations on connection failures.

    Uses exponential backoff: delays of 1s, 2s, 4s, 8s, 16s by default.

    Args:
        max_retries: Maximum number of retry attempts (default: 5)
        base_delay: Base delay in seconds, doubles each retry (default: 1.0)

    Returns:
        Decorated function that retries on psycopg.OperationalError or InterfaceError

    Example:
        @retry_db_operation(max_retries=3)
        def fetch_data():
            conn = get_db_connection()
            # ... fetch logic
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_error: Exception | None = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)  # 1, 2, 4, 8, 16s
                        print(f"  DB connection error, retrying in {delay}s ({attempt + 1}/{max_retries}): {e}")
                        time.sleep(delay)
            # All retries exhausted
            if last_error is not None:
                raise last_error
            raise RuntimeError("retry_db_operation failed without an error")
        return wrapper
    return decorator


def check_db_health() -> bool:
    """
    Ping database to verify connection is healthy.

    Useful to call before starting a tier to catch connection issues early.

    Returns:
        True if database is reachable, False otherwise
    """
    try:
        conn = get_db_connection()
        if conn is None:
            print("  DB health check failed: get_db_connection returned None")
            return False
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        return True
    except Exception as e:
        print(f"  DB health check failed: {e}")
        return False


@dataclass
class FailedUnitTracker:
    """
    Track units that failed after all retries exhausted.

    Allows the pipeline to skip failed units and continue processing,
    then report all failures at the end.

    Example:
        tracker = FailedUnitTracker()
        for unit in units:
            try:
                process(unit)
            except Exception as e:
                tracker.record_failure(unit.document_id, unit.issue_type, e)
                continue
        tracker.report()
    """
    failed_units: list[tuple[str, str, Exception]] = field(default_factory=list)

    def record_failure(self, document_id: str, issue_type: str, error: Exception) -> None:
        """Record a failed unit with its error."""
        print(f"  SKIPPING failed unit: doc_id={document_id}, issue={issue_type} - {error}")
        self.failed_units.append((str(document_id), issue_type, error))

    def has_failures(self) -> bool:
        """Check if any failures were recorded."""
        return len(self.failed_units) > 0

    def report(self) -> None:
        """Print a summary of all failed units."""
        if not self.failed_units:
            return
        print(f"\n{'='*70}")
        print(f"FAILED UNITS ({len(self.failed_units)} total)")
        print(f"{'='*70}")
        for doc_id, issue_type, err in self.failed_units:
            print(f"  - doc_id={doc_id} ({issue_type}): {type(err).__name__}: {err}")
        print()

    def clear(self) -> None:
        """Clear all recorded failures."""
        self.failed_units.clear()


class DatabaseManager:
    """
    Centralized database connection management.

    Provides context managers for safe connection handling:
    - connection(): Basic connection with auto-close
    - transaction(): Connection with auto-commit/rollback

    Example usage:
        with DatabaseManager.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM regulatory_documents")

        with DatabaseManager.transaction() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE compliance_issues SET ...")
                # Auto-commits on success, rolls back on exception
    """

    @staticmethod
    @contextmanager
    def connection() -> Generator[Connection, None, None]:
        """
        Context manager for database connections.

        Ensures connection is closed after use, regardless of success/failure.

        Yields:
            Connection: Database connection object

        Example:
            with DatabaseManager.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT ...")
        """
        conn = get_db_connection()
        if conn is None:
            raise RuntimeError("Failed to establish database connection")
        try:
            yield conn
        finally:
            conn.close()

    @staticmethod
    @contextmanager
    def transaction() -> Generator[Connection, None, None]:
        """
        Context manager with auto-commit/rollback.

        Automatically commits on success, rolls back on exception.
        Connection is always closed after use.

        Yields:
            Connection: Database connection object

        Example:
            with DatabaseManager.transaction() as conn:
                with conn.cursor() as cur:
                    cur.execute("INSERT INTO ...")
                    cur.execute("UPDATE ...")
                # Both statements committed together
        """
        conn = get_db_connection()
        if conn is None:
            raise RuntimeError("Failed to establish database connection")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
