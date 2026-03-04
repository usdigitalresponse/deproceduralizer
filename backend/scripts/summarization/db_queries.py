"""Database query helpers for the summarization pipeline.

Provides functions for traversing the regulatory_documents hierarchy
(sections, subchapters, chapters, parts, titles) needed to build
summarization prompts with ancestor/sibling/child context.  Also
includes utility queries for listing titles, counting documents per
hierarchy level, and determining the bottom-up phase ordering.
"""

from typing import Optional

import psycopg

from lib.db import get_db_connection


def get_connection() -> psycopg.Connection:
    """Get database connection via shared pool (includes statement timeout)."""
    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")
    return conn


def _get_title_column(jurisdiction: str) -> str:
    """Get the appropriate title column for a jurisdiction."""
    from lib.jurisdictions import title_column_for_jurisdiction
    return title_column_for_jurisdiction(jurisdiction)


def get_documents_by_level(
    jurisdiction: str,
    level: str,
    title: Optional[str] = None,
) -> list[dict]:
    """
    Get all documents at a hierarchy level, optionally filtered by title.

    Args:
        jurisdiction: Jurisdiction code (e.g., 'NJ', 'NY', or 'NYC')
        level: Hierarchy level (e.g., 'section', 'chapter', 'part')
        title: Optional title number to filter by

    Returns:
        List of document dicts with id, title, content, citation, parent_id, etc.
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "jurisdiction = %s",
        "type = 'regulation'",
        "hierarchy_level = %s",
    ]
    params: list = [jurisdiction.upper(), level]

    if title is not None:
        title_col = _get_title_column(jurisdiction)
        conditions.append(f"{title_col} = %s")
        params.append(str(title))

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            id,
            title,
            content,
            hierarchy_level,
            jurisdiction,
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
            jurisdiction,
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
            p.jurisdiction,
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
    """Get all ancestors from immediate parent up to title.

    Delegates to the shared lib/db implementation.
    """
    from lib.db import get_ancestors_batch as _lib_get_ancestors_batch
    result = _lib_get_ancestors_batch([doc_id])
    return result.get(doc_id, [])


def get_ancestors_batch(doc_ids: list[int]) -> dict[int, list[dict]]:
    """Get ancestors for multiple documents in a single query.

    Delegates to the shared lib/db implementation (includes retry logic).
    """
    from lib.db import get_ancestors_batch as _lib_get_ancestors_batch
    return _lib_get_ancestors_batch(doc_ids)


def get_hierarchy_levels(jurisdiction: str, title: Optional[str] = None) -> list[str]:
    """
    Get distinct hierarchy levels present in the data.

    Args:
        jurisdiction: Jurisdiction code
        title: Optional title number filter

    Returns:
        List of hierarchy level names
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "jurisdiction = %s",
        "type = 'regulation'",
        "hierarchy_level IS NOT NULL",
        "hierarchy_level <> ''",
    ]
    params: list = [jurisdiction.upper()]

    if title is not None:
        title_col = _get_title_column(jurisdiction)
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
    jurisdiction: str,
    title: Optional[str] = None,
) -> dict[str, int]:
    """
    Get count of documents per hierarchy level.

    Args:
        jurisdiction: Jurisdiction code
        title: Optional title number filter

    Returns:
        Dict mapping hierarchy level to document count
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "jurisdiction = %s",
        "type = 'regulation'",
        "hierarchy_level IS NOT NULL",
    ]
    params: list = [jurisdiction.upper()]

    if title is not None:
        title_col = _get_title_column(jurisdiction)
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
    jurisdiction: str,
    title: Optional[str] = None,
) -> dict[int, list[dict]]:
    """
    Get all sections grouped by their parent_id, ordered by citation.

    Args:
        jurisdiction: Jurisdiction code
        title: Optional title number filter

    Returns:
        Dict mapping parent_id to list of section documents
    """
    sections = get_documents_by_level(jurisdiction, "section", title)

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
        grouped[parent_id].sort(key=lambda d: d.get("citation") or "")

    return grouped


def get_documents_without_children(
    jurisdiction: str,
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
        "d.jurisdiction = %s",
        "d.type = 'regulation'",
        "d.hierarchy_level = %s",
    ]
    params: list = [jurisdiction.upper(), level]

    if title is not None:
        title_col = _get_title_column(jurisdiction)
        conditions.append(f"d.{title_col} = %s")
        params.append(str(title))

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            d.id,
            d.title,
            d.content,
            d.hierarchy_level,
            d.jurisdiction,
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


def get_all_titles(jurisdiction: str) -> list[str]:
    """
    Get all distinct title values for a jurisdiction, sorted naturally.

    Args:
        jurisdiction: Jurisdiction code (e.g., 'NJ', 'NY', or 'NYC')

    Returns:
        List of title strings (e.g., ['1', '2', '3', '4', '4A', '5', ...])
    """
    title_col = _get_title_column(jurisdiction)

    query = f"""
        SELECT DISTINCT {title_col}
        FROM regulatory_documents
        WHERE jurisdiction = %s
          AND type = 'regulation'
          AND {title_col} IS NOT NULL
          AND content IS NOT NULL
          AND content <> ''
        ORDER BY {title_col}
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [jurisdiction.upper()])
            titles = [row[0] for row in cur.fetchall()]

    return titles


def get_hierarchy_order(
    jurisdiction: str,
    title: Optional[str] = None,
) -> list[str]:
    """
    Get the bottom-up hierarchy level ordering for a jurisdiction/title.

    Uses the canonical ordering from config.HIERARCHY_ORDER, filtered to
    only levels that actually exist in the data for this jurisdiction/title.

    'section' is excluded — it's always the first phase.

    Args:
        jurisdiction: Jurisdiction code (e.g., 'NJ', 'NY', or 'NYC')
        title: Optional title filter

    Returns:
        List of hierarchy level names in bottom-up order, excluding 'section'.
        E.g., ['subpart', 'part', 'subchapter', 'chapter', 'title']
    """
    from config import HIERARCHY_ORDER

    canonical = HIERARCHY_ORDER.get(jurisdiction.upper())
    if canonical is None:
        raise ValueError(
            f"No hierarchy order configured for jurisdiction '{jurisdiction}'. "
            f"Add it to config.HIERARCHY_ORDER."
        )

    # Filter to levels that actually exist in this jurisdiction/title
    present = set(get_hierarchy_levels(jurisdiction, title))
    return [level for level in canonical if level in present]
