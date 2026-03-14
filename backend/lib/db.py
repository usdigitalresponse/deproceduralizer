"""
Database connection, retry logic, ancestor queries, filtering, and scope normalization.
"""

import atexit
import functools
import os
import time
from pathlib import Path
from typing import Optional, Any, Callable, TypeVar

import psycopg
from dotenv import load_dotenv
from psycopg import Connection

from lib.jurisdictions import jurisdiction_prefix

# Load .env from project root on first import (override=False so it won't
# clobber env vars that are already set, e.g. in production).
_PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(_PROJECT_ROOT / ".env", override=False)


# Type variable for generic return type
T = TypeVar('T')

# ---------------------------------------------------------------------------
# Connection Pool (lazy singleton)
# ---------------------------------------------------------------------------
_pool = None


def _configure_conn(conn: Connection) -> None:
    """Configure each new connection created by the pool."""
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = '300000ms'")  # 5 minute timeout
    conn.commit()  # Must commit to leave connection in IDLE state for the pool


def _get_pool():
    """Return the shared ConnectionPool, creating it on first call."""
    global _pool
    if _pool is not None:
        return _pool

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None

    try:
        from psycopg_pool import ConnectionPool
        _pool = ConnectionPool(
            conninfo=database_url,
            min_size=2,
            max_size=10,
            max_idle=300,
            configure=_configure_conn,
            kwargs={"connect_timeout": 30},
            # Without this, conn.close() destroys connections instead of
            # returning them to the pool (psycopg_pool ≥ 3.2 default is False)
            close_returns=True,
        )
        atexit.register(_pool.close)
        return _pool
    except Exception as e:
        print(f"Warning: Connection pool creation failed: {e}")
        return None


def get_db_connection(timeout: int = 30) -> Optional[Connection]:
    """
    Get a connection from the pool (or create a standalone one as fallback).

    Callers use conn.close() as before — with pooling, close() returns the
    connection to the pool instead of destroying it.

    Args:
        timeout: Connection timeout in seconds (used for fallback only)

    Returns:
        Connection object, or None if connection fails or DATABASE_URL not set
    """
    pool = _get_pool()
    if pool is not None:
        try:
            return pool.getconn()
        except Exception as e:
            print(f"Warning: Pool getconn failed, falling back to direct connect: {e}")

    # Fallback: direct connection (e.g., psycopg_pool not installed)
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("Warning: DATABASE_URL not set in .env")
            return None

        conn = psycopg.connect(database_url, connect_timeout=timeout)
        _configure_conn(conn)
        return conn
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        return None


def fetch_rows(query: str, params: tuple | list = ()) -> list[dict]:
    """Execute a SELECT query and return results as a list of dicts.

    Handles connection lifecycle and cursor-to-dict conversion.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        cur.execute(query, params)
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        conn.commit()
        return rows
    finally:
        conn.close()


def chunked_update(
    query: str,
    rows: list[tuple],
    chunk_size: int = 500,
    label: str = "rows",
) -> int:
    """Execute an UPDATE query in chunks, reconnecting between chunks.

    Avoids Neon connection timeouts on large batch writes.

    Args:
        query: SQL UPDATE with %s placeholders (e.g., "UPDATE t SET x=%s WHERE id=%s").
        rows: List of param tuples matching the query placeholders.
        chunk_size: Rows per chunk (reconnects after each).
        label: Label for progress output.

    Returns:
        Number of rows written.
    """
    if not rows:
        return 0

    written = 0
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        conn = get_db_connection()
        if not conn:
            raise ConnectionError(f"Could not connect to database at {label} {written}")

        try:
            cur = conn.cursor()
            for params in chunk:
                cur.execute(query, params)
            conn.commit()
            written += len(chunk)
            print(f"  Written {written}/{len(rows)} {label}...")
        finally:
            conn.close()

    return written


def retry_db_operation(max_retries: int = 5, base_delay: float = 1.0) -> Callable:
    """Retry DB operations on connection failures with exponential backoff."""
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
                        delay = base_delay * (2 ** attempt)
                        print(f"  DB connection error, retrying in {delay}s ({attempt + 1}/{max_retries}): {e}")
                        time.sleep(delay)
            if last_error is not None:
                raise last_error
            raise RuntimeError("retry_db_operation failed without an error")
        return wrapper
    return decorator


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_ancestors_batch(doc_ids: list[int]) -> dict[int, list[dict]]:
    """
    Get ancestors for multiple documents in a single query.

    Uses a recursive CTE to fetch ancestor chains for multiple documents
    efficiently. Each ancestor chain is ordered from immediate parent to root.

    Args:
        doc_ids: List of document IDs

    Returns:
        Dict mapping doc_id -> list of ancestor dicts (ordered parent to root)
    """
    if not doc_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    query = """
        WITH RECURSIVE ancestor_chain AS (
            -- Base case: get each document's parent
            SELECT
                c.id as origin_id,
                p.id,
                p.title,
                p.hierarchy_level,
                p.citation,
                p.short_title,
                p.parent_id,
                1 as depth
            FROM regulatory_documents c
            JOIN regulatory_documents p ON c.parent_id = p.id
            WHERE c.id = ANY(%s)

            UNION ALL

            -- Recursive case: get each ancestor's parent
            SELECT
                ac.origin_id,
                p.id,
                p.title,
                p.hierarchy_level,
                p.citation,
                p.short_title,
                p.parent_id,
                ac.depth + 1
            FROM ancestor_chain ac
            JOIN regulatory_documents p ON ac.parent_id = p.id
        )
        SELECT origin_id, id, title, hierarchy_level, citation, short_title, parent_id, depth
        FROM ancestor_chain
        ORDER BY origin_id, depth ASC
    """

    with conn.cursor() as cur:
        cur.execute(query, [doc_ids])
        rows = cur.fetchall()

    conn.commit()
    conn.close()

    # Group by origin_id
    result: dict[int, list[dict]] = {doc_id: [] for doc_id in doc_ids}
    for row in rows:
        origin_id = row[0]
        ancestor = {
            "id": row[1],
            "title": row[2],
            "hierarchy_level": row[3],
            "citation": row[4],
            "short_title": row[5],
            "parent_id": row[6],
        }
        result[origin_id].append(ancestor)

    return result


def normalize_scope_level(scope_level: str) -> str:
    """
    Normalize scope_level to match hierarchy_level values.
    Only handles obvious variations like capitalization and pluralization.

    This should be called when storing definitions to ensure consistent
    scope_level values that can be linked to the document hierarchy.

    Args:
        scope_level: Raw scope level from LLM extraction (e.g., "Part", "Sections")

    Returns:
        Normalized scope level (e.g., "part", "section")
    """
    if not scope_level:
        return ""

    # Lowercase and strip whitespace
    level = scope_level.lower().strip()

    # Handle common pluralizations (remove trailing 's')
    # Valid hierarchy levels: title, subtitle, chapter, subchapter, article, part, subpart, section
    singular_forms = {
        'titles': 'title',
        'subtitles': 'subtitle',
        'chapters': 'chapter',
        'subchapters': 'subchapter',
        'articles': 'article',
        'parts': 'part',
        'subparts': 'subpart',
        'sections': 'section',
    }

    return singular_forms.get(level, level)


def get_filtered_documents(
    jurisdiction: str,
    title: str = None,
    chapter: str = None,
    subchapter: str = None,
    part: str = None,
    hierarchy_level: str = None,
    limit: int = None,
    include_excluded: bool = False,
) -> list:
    """
    Query regulatory_documents with hierarchy filters.

    Args:
        jurisdiction: 'NY', 'NJ', or 'NYC'
        title: Filter by nycrr_title/njac_title/rcny_title
        chapter: Filter by nycrr_chapter/njac_chapter
        subchapter: Filter by nycrr_subchapter/njac_subchapter
        part: Filter by nycrr_part/njac_part
        hierarchy_level: Filter by hierarchy_level (e.g., 'section')
        limit: Max rows to return
        include_excluded: If False (default), exclude documents marked as exclude_from_analysis

    Returns:
        List of dicts with id, title, content, url, and hierarchy fields
    """
    conn = get_db_connection()
    if not conn:
        return []

    prefix = jurisdiction_prefix(jurisdiction)

    conditions = ["jurisdiction = %s", "type = 'regulation'"]
    params = [jurisdiction.upper()]

    # By default, exclude documents marked for exclusion from analysis
    if not include_excluded:
        conditions.append("(exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)")

    if title:
        conditions.append(f"{prefix}_title = %s")
        params.append(title)

    if chapter:
        conditions.append(f"{prefix}_chapter = %s")
        params.append(chapter)

    # RCNY doesn't have subchapter/part columns
    if subchapter and prefix != 'rcny':
        conditions.append(f"{prefix}_subchapter = %s")
        params.append(subchapter)

    if part and prefix != 'rcny':
        conditions.append(f"{prefix}_part = %s")
        params.append(part)

    if hierarchy_level:
        conditions.append("hierarchy_level = %s")
        params.append(hierarchy_level)

    # Build SELECT columns based on state (RCNY has fewer hierarchy columns)
    if prefix == 'rcny':
        select_cols = f"{prefix}_title, {prefix}_chapter, {prefix}_section"
    else:
        select_cols = f"{prefix}_title, {prefix}_chapter, {prefix}_subchapter, {prefix}_part, {prefix}_section"

    query = f"""
        SELECT id, title, content, url, hierarchy_level, hierarchy_path,
               {select_cols}
        FROM regulatory_documents
        WHERE {' AND '.join(conditions)}
        ORDER BY id
    """

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    try:
        rows = conn.execute(query, params).fetchall()
        conn.commit()
        conn.close()

        results = []
        for row in rows:
            result = {
                'id': row[0],
                'title': row[1],
                'content': row[2],
                'url': row[3],
                'hierarchy_level': row[4],
                'hierarchy_path': row[5],
                f'{prefix}_title': row[6],
                f'{prefix}_chapter': row[7],
            }
            if prefix == 'rcny':
                result[f'{prefix}_section'] = row[8]
            else:
                result[f'{prefix}_subchapter'] = row[8]
                result[f'{prefix}_part'] = row[9]
                result[f'{prefix}_section'] = row[10]
            results.append(result)
        return results
    except Exception as e:
        print(f"ERROR querying documents: {e}")
        if conn:
            conn.close()
        return []


def get_already_extracted_ids(jurisdiction: str) -> set:
    """Get document IDs that already have definitions extracted."""
    conn = get_db_connection()
    if not conn:
        return set()

    try:
        result = conn.execute("""
            SELECT DISTINCT document_id
            FROM definitions
            WHERE document_id IN (
                SELECT id FROM regulatory_documents WHERE jurisdiction = %s
            )
        """, (jurisdiction.upper(),))
        ids = {row[0] for row in result.fetchall()}
        conn.commit()
        conn.close()
        return ids
    except Exception as e:
        print(f"Warning: Could not fetch extracted IDs: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return set()
