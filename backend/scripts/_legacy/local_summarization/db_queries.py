"""Database queries for hierarchical document traversal."""

import os
from pathlib import Path
from typing import Optional

import psycopg
from dotenv import load_dotenv

from lib.db import retry_db_operation

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def get_connection() -> psycopg.Connection:
    """Get database connection."""
    return psycopg.connect(os.getenv("DATABASE_URL"))


def _get_title_column(state: str) -> str:
    """Get the appropriate title column for a state."""
    state = state.upper()
    if state == "NJ":
        return "njac_title"
    elif state == "NY":
        return "nycrr_title"
    else:
        return "njac_title"  # Default


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
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, params)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def get_children(parent_id: int) -> list[dict]:
    """
    Get direct children of a document.

    Args:
        parent_id: The parent document's ID

    Returns:
        List of child document dicts, ordered by citation
    """
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, [parent_id])
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def get_parent(child_id: int) -> Optional[dict]:
    """
    Get parent of a document.

    Args:
        child_id: The child document's ID

    Returns:
        Parent document dict, or None if no parent
    """
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, [child_id])
        columns = [desc[0] for desc in cur.description]
        row = cur.fetchone()

    conn.close()

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
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, [doc_id])
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    conn.close()
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

    conn = get_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

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

    with conn.cursor() as cur:
        cur.execute(query, [doc_ids])
        rows = cur.fetchall()

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


def get_hierarchy_levels(state: str, title: Optional[str] = None) -> list[str]:
    """
    Get distinct hierarchy levels present in the data.

    Args:
        state: State code
        title: Optional title number filter

    Returns:
        List of hierarchy level names
    """
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, params)
        levels = [row[0] for row in cur.fetchall()]

    conn.close()
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
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    conn.close()
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
    conn = get_connection()

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

    with conn.cursor() as cur:
        cur.execute(query, params)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def get_child_ids(parent_id: int) -> list[int]:
    """
    Get IDs of all direct children of a document.

    Args:
        parent_id: The parent document's ID

    Returns:
        List of child document IDs
    """
    conn = get_connection()

    query = """
        SELECT id
        FROM regulatory_documents
        WHERE parent_id = %s
        ORDER BY citation
    """

    with conn.cursor() as cur:
        cur.execute(query, [parent_id])
        ids = [row[0] for row in cur.fetchall()]

    conn.close()
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

    conn = get_connection()

    query = """
        SELECT parent_id, id
        FROM regulatory_documents
        WHERE parent_id = ANY(%s)
        ORDER BY parent_id, citation
    """

    with conn.cursor() as cur:
        cur.execute(query, [parent_ids])
        rows = cur.fetchall()

    conn.close()

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
    conn = get_connection()
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

    with conn.cursor() as cur:
        cur.execute(query, [state.upper()])
        titles = [row[0] for row in cur.fetchall()]

    conn.close()
    return titles
