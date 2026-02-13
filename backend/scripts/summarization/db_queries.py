"""Database query helpers for the summarization pipeline.

Provides functions for traversing the regulatory_documents hierarchy
(sections, subchapters, chapters, parts, titles) needed to build
summarization prompts with ancestor/sibling/child context.  Also
includes utility queries for listing titles, counting documents per
hierarchy level, and determining the bottom-up phase ordering.
"""

import functools
import os
import time
from pathlib import Path
from typing import Optional, TypeVar, Callable, Any

import psycopg
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# Type variable for generic return type
T = TypeVar('T')


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


def get_connection() -> psycopg.Connection:
    """Get database connection."""
    return psycopg.connect(os.getenv("DATABASE_URL"))


def _get_title_column(state: str) -> str:
    """Get the appropriate title column for a state.

    Returns the DB column name used to filter regulatory_documents by title
    number.  Falls back to 'njac_title' for unrecognized states since NJ
    was the first state onboarded and most query patterns follow its schema.
    """
    state = state.upper()
    if state == "NJ":
        return "njac_title"
    elif state == "NY":
        return "nycrr_title"
    else:
        return "njac_title"  # Default fallback for unrecognized states


def get_documents_by_level(
    state: str,
    level: str,
    title: Optional[str] = None,
) -> list[dict]:
    """
    Get all documents at a hierarchy level, optionally filtered by title.

    Args:
        state: State code (e.g., 'NJ', 'NY')
        level: Hierarchy level (e.g., 'section', 'chapter', 'part')
        title: Optional title number to filter by

    Returns:
        List of document dicts with id, title, content, citation, parent_id, etc.
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "state = %s",
        "hierarchy_level = %s",
    ]
    params: list = [state.upper(), level]

    if title is not None:
        title_col = _get_title_column(state)
        conditions.append(f"{title_col} = %s")
        params.append(str(title))

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            id,
            title,
            content,
            hierarchy_level,
            state,
            citation,
            short_title,
            parent_id
        FROM regulatory_documents
        WHERE {where_clause}
        ORDER BY citation
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

    return [dict(zip(columns, row)) for row in rows]


def get_children(parent_id: int) -> list[dict]:
    """
    Get direct children of a document.

    Args:
        parent_id: The parent document's ID

    Returns:
        List of child document dicts, ordered by citation
    """
    query = """
        SELECT
            id,
            title,
            content,
            hierarchy_level,
            state,
            citation,
            short_title,
            parent_id
        FROM regulatory_documents
        WHERE parent_id = %s
        ORDER BY citation
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [parent_id])
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

    return [dict(zip(columns, row)) for row in rows]


def get_parent(child_id: int) -> Optional[dict]:
    """
    Get parent of a document.

    Args:
        child_id: The child document's ID

    Returns:
        Parent document dict, or None if no parent
    """
    query = """
        SELECT
            p.id,
            p.title,
            p.content,
            p.hierarchy_level,
            p.state,
            p.citation,
            p.short_title,
            p.parent_id
        FROM regulatory_documents c
        JOIN regulatory_documents p ON c.parent_id = p.id
        WHERE c.id = %s
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [child_id])
            columns = [desc[0] for desc in cur.description]
            row = cur.fetchone()

    if row:
        return dict(zip(columns, row))
    return None


def get_ancestors(doc_id: int) -> list[dict]:
    """
    Get all ancestors from immediate parent up to title, with their titles.

    Args:
        doc_id: The document's ID

    Returns:
        List of ancestor dicts, ordered from immediate parent to root (title)
    """
    # Use recursive CTE to get ancestor chain
    query = """
        WITH RECURSIVE ancestor_chain AS (
            -- Base case: get the document's parent
            SELECT
                p.id,
                p.title,
                p.hierarchy_level,
                p.citation,
                p.short_title,
                p.parent_id,
                1 as depth
            FROM regulatory_documents c
            JOIN regulatory_documents p ON c.parent_id = p.id
            WHERE c.id = %s

            UNION ALL

            -- Recursive case: get each ancestor's parent
            SELECT
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
        SELECT id, title, hierarchy_level, citation, short_title, parent_id
        FROM ancestor_chain
        ORDER BY depth ASC
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [doc_id])
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

    return [dict(zip(columns, row)) for row in rows]


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_ancestors_batch(doc_ids: list[int]) -> dict[int, list[dict]]:
    """
    Get ancestors for multiple documents in a single query.

    Args:
        doc_ids: List of document IDs

    Returns:
        Dict mapping doc_id -> list of ancestor dicts (ordered parent to root)
    """
    if not doc_ids:
        return {}

    # Use recursive CTE with multiple starting points
    # We track which original doc_id each ancestor chain belongs to
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

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [doc_ids])
            rows = cur.fetchall()

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


def get_hierarchy_levels(state: str, title: Optional[str] = None) -> list[str]:
    """
    Get distinct hierarchy levels present in the data.

    Args:
        state: State code
        title: Optional title number filter

    Returns:
        List of hierarchy level names
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "state = %s",
        "hierarchy_level IS NOT NULL",
        "hierarchy_level <> ''",
    ]
    params: list = [state.upper()]

    if title is not None:
        title_col = _get_title_column(state)
        conditions.append(f"{title_col} = %s")
        params.append(str(title))

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT DISTINCT hierarchy_level
        FROM regulatory_documents
        WHERE {where_clause}
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            levels = [row[0] for row in cur.fetchall()]

    return levels


def get_document_counts_by_level(
    state: str,
    title: Optional[str] = None,
) -> dict[str, int]:
    """
    Get count of documents per hierarchy level.

    Args:
        state: State code
        title: Optional title number filter

    Returns:
        Dict mapping hierarchy level to document count
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "state = %s",
        "hierarchy_level IS NOT NULL",
    ]
    params: list = [state.upper()]

    if title is not None:
        title_col = _get_title_column(state)
        conditions.append(f"{title_col} = %s")
        params.append(str(title))

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT hierarchy_level, COUNT(*) as count
        FROM regulatory_documents
        WHERE {where_clause}
        GROUP BY hierarchy_level
        ORDER BY count DESC
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return {row[0]: row[1] for row in rows}


def get_sections_grouped_by_parent(
    state: str,
    title: Optional[str] = None,
) -> dict[int, list[dict]]:
    """
    Get all sections grouped by their parent_id, ordered by citation.

    Args:
        state: State code
        title: Optional title number filter

    Returns:
        Dict mapping parent_id to list of section documents
    """
    sections = get_documents_by_level(state, "section", title)

    # Group by parent_id
    grouped: dict[int, list[dict]] = {}
    for section in sections:
        parent_id = section.get("parent_id")
        if parent_id:
            if parent_id not in grouped:
                grouped[parent_id] = []
            grouped[parent_id].append(section)

    # Ensure each group is sorted by citation
    for parent_id in grouped:
        grouped[parent_id].sort(key=lambda d: d.get("citation", ""))

    return grouped


def get_documents_without_children(
    state: str,
    level: str,
    title: Optional[str] = None,
) -> list[dict]:
    """
    Get documents at a level that have no children (leaf nodes at that level).

    Useful for finding levels that should be treated as leaf nodes.
    """
    conditions = [
        "d.content IS NOT NULL",
        "d.content <> ''",
        "d.state = %s",
        "d.hierarchy_level = %s",
    ]
    params: list = [state.upper(), level]

    if title is not None:
        title_col = _get_title_column(state)
        conditions.append(f"d.{title_col} = %s")
        params.append(str(title))

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            d.id,
            d.title,
            d.content,
            d.hierarchy_level,
            d.state,
            d.citation,
            d.short_title,
            d.parent_id
        FROM regulatory_documents d
        LEFT JOIN regulatory_documents c ON c.parent_id = d.id
        WHERE {where_clause}
          AND c.id IS NULL
        ORDER BY d.citation
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

    return [dict(zip(columns, row)) for row in rows]


def get_child_ids(parent_id: int) -> list[int]:
    """
    Get IDs of all direct children of a document.

    Args:
        parent_id: The parent document's ID

    Returns:
        List of child document IDs
    """
    query = """
        SELECT id
        FROM regulatory_documents
        WHERE parent_id = %s
        ORDER BY citation
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [parent_id])
            ids = [row[0] for row in cur.fetchall()]

    return ids


def get_child_ids_batch(parent_ids: list[int]) -> dict[int, list[int]]:
    """
    Get child IDs for multiple parents in a single query.

    Args:
        parent_ids: List of parent document IDs

    Returns:
        Dict mapping parent_id -> list of child IDs
    """
    if not parent_ids:
        return {}

    query = """
        SELECT parent_id, id
        FROM regulatory_documents
        WHERE parent_id = ANY(%s)
        ORDER BY parent_id, citation
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [parent_ids])
            rows = cur.fetchall()

    # Group by parent_id
    result: dict[int, list[int]] = {pid: [] for pid in parent_ids}
    for parent_id, child_id in rows:
        result[parent_id].append(child_id)

    return result


def get_all_titles(state: str) -> list[str]:
    """
    Get all distinct title values for a state, sorted naturally.

    Args:
        state: State code (e.g., 'NJ', 'NY')

    Returns:
        List of title strings (e.g., ['1', '2', '3', '4', '4A', '5', ...])
    """
    title_col = _get_title_column(state)

    query = f"""
        SELECT DISTINCT {title_col}
        FROM regulatory_documents
        WHERE state = %s
          AND {title_col} IS NOT NULL
          AND content IS NOT NULL
          AND content <> ''
        ORDER BY {title_col}
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [state.upper()])
            titles = [row[0] for row in cur.fetchall()]

    return titles


def get_hierarchy_order(
    state: str,
    title: Optional[str] = None,
) -> list[str]:
    """
    Get the bottom-up hierarchy level ordering for a state/title.

    Uses the canonical ordering from config.HIERARCHY_ORDER, filtered to
    only levels that actually exist in the data for this state/title.

    'section' is excluded — it's always the first phase.

    Args:
        state: State code (e.g., 'NY', 'NJ')
        title: Optional title filter

    Returns:
        List of hierarchy level names in bottom-up order, excluding 'section'.
        E.g., ['subpart', 'part', 'subchapter', 'chapter', 'title']
    """
    from config import HIERARCHY_ORDER

    canonical = HIERARCHY_ORDER.get(state.upper())
    if canonical is None:
        raise ValueError(
            f"No hierarchy order configured for state '{state}'. "
            f"Add it to config.HIERARCHY_ORDER."
        )

    # Filter to levels that actually exist in this state/title
    present = set(get_hierarchy_levels(state, title))
    return [level for level in canonical if level in present]
