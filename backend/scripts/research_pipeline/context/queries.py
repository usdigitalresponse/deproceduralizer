"""
SQL query functions for batch context data fetching.

This module contains all the SQL query functions used to fetch context data
(siblings, cross-references, definitions, ancestors) for the research pipeline.
"""

from collections import defaultdict
from typing import Optional

import psycopg

from lib.db import get_db_connection, get_ancestors_batch

# Import retry decorator for DB operations
from scripts.research_pipeline.db.connection import retry_db_operation

# Import Pydantic models
from scripts.research_pipeline.models.context import (
    SiblingEntry,
    CrossRefEntry,
    AncestorEntry,
)


def _build_sibling_entry(
    document_id: int,
    citation: str,
    title: str,
    section_type: str,
    summary: Optional[str] = None,
) -> SiblingEntry:
    """Build a SiblingEntry with waiver/exemption detection from section_type and title."""
    title_lower = title.lower()
    return SiblingEntry(
        document_id=document_id,
        citation=citation,
        title=title,
        summary=summary,
        is_waiver_section=section_type == "exemptions" or "waiver" in title_lower,
        is_exemption_section=section_type == "exemptions" or "exempt" in title_lower,
    )


# =============================================================================
# Sibling Queries
# =============================================================================


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_sibling_summaries_batch(
    document_ids: list[int],
) -> dict[int, list[SiblingEntry]]:
    """
    Get all siblings for multiple documents in a single query.

    Returns siblings ordered by citation, with metadata about section type
    for detecting waiver/exemption sections.

    Args:
        document_ids: List of document IDs to get siblings for

    Returns:
        Dict mapping doc_id -> list of SiblingEntry objects
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Get siblings by finding documents with the same parent.
    # Self-inclusion is intentional — it ensures all sections in a subchapter
    # produce identical sibling lists, which is required for Layer 2 prompt
    # caching in both JenAI and research pipelines. The only cosmetic side
    # effect is that the context registry counts self as "sibling" before "self".
    # See .claude/skills/pipeline-caching/SKILL.md for caching rules.
    query = """
        WITH doc_parents AS (
            SELECT id, parent_id
            FROM regulatory_documents
            WHERE id = ANY(%s) AND parent_id IS NOT NULL
        )
        SELECT
            dp.id as origin_id,
            rd.id as sibling_id,
            rd.citation,
            rd.title,
            rd.short_title,
            rd.summary,
            rd.section_type
        FROM regulatory_documents rd
        JOIN doc_parents dp ON rd.parent_id = dp.parent_id
        ORDER BY dp.id, rd.citation
    """

    with conn.cursor() as cur:
        cur.execute(query, [document_ids])
        rows = cur.fetchall()

    conn.commit()
    conn.close()

    # Group by origin_id and convert to SiblingEntry
    result: dict[int, list[SiblingEntry]] = {doc_id: [] for doc_id in document_ids}
    for row in rows:
        origin_id = row[0]
        entry = _build_sibling_entry(
            document_id=row[1],
            citation=row[2] or "",
            title=row[3] or row[4] or "",
            summary=row[5],
            section_type=row[6] or "",
        )
        result[origin_id].append(entry)

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_immediate_siblings_batch(
    document_ids: list[int],
) -> dict[int, dict[str, Optional[SiblingEntry]]]:
    """
    Get just the immediate prev/next siblings for multiple documents.

    This is used by Tier 1 to provide minimal sibling context without
    showing the full sibling list.

    Args:
        document_ids: List of document IDs

    Returns:
        Dict mapping doc_id -> {"prev": SiblingEntry|None, "next": SiblingEntry|None}
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Use window functions to get prev/next siblings
    query = """
        WITH doc_parents AS (
            SELECT id, parent_id, citation
            FROM regulatory_documents
            WHERE id = ANY(%s) AND parent_id IS NOT NULL
        ),
        siblings_with_position AS (
            SELECT
                dp.id as origin_id,
                rd.id as sibling_id,
                rd.citation,
                rd.title,
                rd.short_title,
                rd.summary,
                rd.section_type,
                LAG(rd.id) OVER (PARTITION BY dp.id ORDER BY rd.citation) as prev_sibling_id,
                LEAD(rd.id) OVER (PARTITION BY dp.id ORDER BY rd.citation) as next_sibling_id
            FROM regulatory_documents rd
            JOIN doc_parents dp ON rd.parent_id = dp.parent_id
        )
        SELECT
            origin_id,
            sibling_id,
            citation,
            title,
            short_title,
            summary,
            section_type,
            CASE WHEN sibling_id = origin_id THEN 'self' END as is_self,
            prev_sibling_id,
            next_sibling_id
        FROM siblings_with_position
        WHERE sibling_id = origin_id
    """

    with conn.cursor() as cur:
        cur.execute(query, [document_ids])
        rows = cur.fetchall()

    # Now fetch the actual prev/next siblings based on the IDs we found
    sibling_ids = set()
    origin_to_prev_next: dict[int, tuple[Optional[int], Optional[int]]] = {}
    for row in rows:
        origin_id = row[0]
        prev_id = row[8]
        next_id = row[9]
        origin_to_prev_next[origin_id] = (prev_id, next_id)
        if prev_id:
            sibling_ids.add(prev_id)
        if next_id:
            sibling_ids.add(next_id)

    # Fetch sibling details
    sibling_details: dict[int, dict] = {}
    if sibling_ids:
        detail_query = """
            SELECT id, citation, title, short_title, summary, section_type
            FROM regulatory_documents
            WHERE id = ANY(%s)
        """
        with conn.cursor() as cur:
            cur.execute(detail_query, [list(sibling_ids)])
            for row in cur.fetchall():
                sibling_details[row[0]] = {
                    "citation": row[1] or "",
                    "title": row[2] or row[3] or "",
                    "summary": row[4],  # Include summary (can be None)
                    "section_type": row[5] or "",
                }

    conn.commit()
    conn.close()

    # Build result
    result: dict[int, dict[str, Optional[SiblingEntry]]] = {
        doc_id: {"prev": None, "next": None} for doc_id in document_ids
    }

    for origin_id, (prev_id, next_id) in origin_to_prev_next.items():
        if prev_id and prev_id in sibling_details:
            d = sibling_details[prev_id]
            result[origin_id]["prev"] = _build_sibling_entry(
                document_id=prev_id,
                citation=d["citation"],
                title=d["title"],
                section_type=d["section_type"],
                summary=d["summary"],
            )
        if next_id and next_id in sibling_details:
            d = sibling_details[next_id]
            result[origin_id]["next"] = _build_sibling_entry(
                document_id=next_id,
                citation=d["citation"],
                title=d["title"],
                section_type=d["section_type"],
                summary=d["summary"],
            )

    return result


# =============================================================================
# Cross-Reference Queries
# =============================================================================


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_crossrefs_batch(
    document_ids: list[int],
) -> dict[int, list[CrossRefEntry]]:
    """
    Get cross-references for multiple source documents in a single query.

    Only returns resolved cross-references (where target_document_id is set).
    Detects if the target is a definitions section.

    Args:
        document_ids: List of source document IDs

    Returns:
        Dict mapping doc_id -> list of CrossRefEntry objects
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Query 1: Cross-refs to regulatory documents
    reg_query = """
        SELECT
            cr.source_document_id,
            cr.target_document_id,
            rd.citation,
            rd.title,
            rd.short_title,
            rd.section_type
        FROM cross_references cr
        JOIN regulatory_documents rd ON cr.target_document_id = rd.id
        WHERE cr.source_document_id = ANY(%s)
          AND cr.is_resolved = true
        ORDER BY cr.source_document_id, rd.citation
    """

    # Query 2: Cross-refs to guidance documents (deduplicated by target)
    guidance_query = """
        SELECT DISTINCT ON (cr.source_document_id, gd.id)
            cr.source_document_id,
            cr.target_guidance_id,
            gd.canonical_ref,
            gd.title,
            gd.title,  -- no short_title for guidance; duplicated to match reg query shape
            gd.section_type
        FROM cross_references cr
        JOIN guidance_documents gd ON cr.target_guidance_id = gd.id
        WHERE cr.source_document_id = ANY(%s)
          AND cr.target_guidance_id IS NOT NULL
          AND cr.is_resolved = true
        ORDER BY cr.source_document_id, gd.id, gd.canonical_ref
    """

    with conn.cursor() as cur:
        cur.execute(reg_query, [document_ids])
        reg_rows = cur.fetchall()
        cur.execute(guidance_query, [document_ids])
        guidance_rows = cur.fetchall()

    conn.commit()
    conn.close()

    # Group by source_document_id
    result: dict[int, list[CrossRefEntry]] = {doc_id: [] for doc_id in document_ids}

    # Add regulatory cross-refs
    for row in reg_rows:
        source_id = row[0]
        section_type = row[5] or ""
        entry = CrossRefEntry(
            target_id=row[1],
            citation=row[2] or "",
            target_title=row[4] or row[3],
            is_definitions_section=section_type == "definitions",
        )
        result[source_id].append(entry)

    # Add guidance cross-refs
    for row in guidance_rows:
        source_id = row[0]
        entry = CrossRefEntry(
            target_id=row[1],
            citation=row[2] or "",
            target_title=row[3] or "",
            is_definitions_section=False,
            is_guidance=True,
        )
        result[source_id].append(entry)

    return result


# =============================================================================
# Definition Queries
# =============================================================================


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_definitions_batch(
    document_ids: list[int],
    ancestors_map: Optional[dict] = None,
) -> dict[int, list[str]]:
    """
    Get applicable definition terms for multiple documents.

    Uses scope inheritance - a document inherits definitions from:
    1. Definitions scoped to itself
    2. Definitions scoped to any ancestor in the hierarchy

    This is efficient because it uses a single recursive CTE to get
    all ancestors for all documents, then joins to definitions.

    Args:
        document_ids: List of document IDs
        ancestors_map: Optional pre-fetched ancestors (to avoid redundant queries)

    Returns:
        Dict mapping doc_id -> list of term strings (just the terms, not definitions)
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Use provided ancestors or fetch them
    if ancestors_map is None:
        ancestors_map = get_ancestors_batch(document_ids)

    # Build a set of all ancestor IDs (including the documents themselves)
    # and track which documents each ancestor belongs to
    all_scope_ids: set[int] = set(document_ids)
    doc_to_ancestors: dict[int, set[int]] = {doc_id: {doc_id} for doc_id in document_ids}

    for doc_id, ancestors in ancestors_map.items():
        for ancestor in ancestors:
            ancestor_id = ancestor["id"]
            all_scope_ids.add(ancestor_id)
            doc_to_ancestors[doc_id].add(ancestor_id)

    # Now fetch definitions that are scoped to any of these documents
    query = """
        SELECT scope_document_id, term
        FROM definitions
        WHERE scope_document_id = ANY(%s)
        ORDER BY term
    """

    with conn.cursor() as cur:
        cur.execute(query, [list(all_scope_ids)])
        rows = cur.fetchall()

    conn.commit()
    conn.close()

    # Map scope_document_id -> terms
    scope_to_terms: dict[int, set[str]] = defaultdict(set)
    for row in rows:
        scope_id, term = row
        scope_to_terms[scope_id].add(term)

    # Build result - each document gets terms from itself and all ancestors
    result: dict[int, list[str]] = {}
    for doc_id in document_ids:
        terms: set[str] = set()
        for scope_id in doc_to_ancestors[doc_id]:
            terms.update(scope_to_terms.get(scope_id, set()))
        result[doc_id] = sorted(terms)

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_definitions_with_text_batch(
    document_ids: list[int],
    ancestors_map: Optional[dict] = None,
) -> dict[int, list[dict]]:
    """
    Get applicable definitions with their full text for multiple documents.

    Similar to get_definitions_batch but returns full definition objects
    including verbatim_text and rephrased_definition.

    Used by Tier 2+ when definitions are needed for context.

    Args:
        document_ids: List of document IDs
        ancestors_map: Optional pre-fetched ancestors (to avoid redundant queries)

    Returns:
        Dict mapping doc_id -> list of definition dicts with term, verbatim_text, etc.
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Use provided ancestors or fetch them
    if ancestors_map is None:
        ancestors_map = get_ancestors_batch(document_ids)

    # Build scope IDs and ordered mapping
    # Use list to preserve order: self first, then ancestors from nearest to root
    all_scope_ids: set[int] = set(document_ids)
    doc_to_ordered_ancestors: dict[int, list[int]] = {doc_id: [doc_id] for doc_id in document_ids}

    for doc_id, ancestors in ancestors_map.items():
        for ancestor in ancestors:
            ancestor_id = ancestor["id"]
            all_scope_ids.add(ancestor_id)
            doc_to_ordered_ancestors[doc_id].append(ancestor_id)

    # Fetch full definition details
    query = """
        SELECT
            id,
            scope_document_id,
            term,
            verbatim_text,
            rephrased_definition,
            is_verbatim_text_complete,
            scope_level,
            is_cross_reference
        FROM definitions
        WHERE scope_document_id = ANY(%s)
        ORDER BY term
    """

    with conn.cursor() as cur:
        cur.execute(query, [list(all_scope_ids)])
        rows = cur.fetchall()

    conn.commit()
    conn.close()

    # Map scope_document_id -> definitions
    scope_to_defs: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        def_dict = {
            "id": row[0],
            "scope_document_id": row[1],
            "term": row[2],
            "verbatim_text": row[3],
            "rephrased_definition": row[4],
            "is_verbatim_text_complete": row[5],
            "scope_level": row[6],
            "is_cross_reference": row[7],
        }
        scope_to_defs[row[1]].append(def_dict)

    # Build result
    result: dict[int, list[dict]] = {}
    for doc_id in document_ids:
        defs: list[dict] = []
        seen_terms: set[str] = set()  # Lowercase terms for case-insensitive matching
        # Process from most specific to least specific scope (self, parent, grandparent, etc.)
        for scope_id in doc_to_ordered_ancestors[doc_id]:
            for def_dict in scope_to_defs.get(scope_id, []):
                # Skip if we already have this term from a more specific scope
                # Use case-insensitive matching to handle variations like "Widget" vs "widget"
                term_lower = def_dict["term"].lower()
                if term_lower not in seen_terms:
                    defs.append(def_dict)
                    seen_terms.add(term_lower)
        result[doc_id] = sorted(defs, key=lambda d: d["term"].lower())

    return result


# =============================================================================
# Ancestor Queries (wrapper around existing)
# =============================================================================


def get_ancestor_entries_batch(
    document_ids: list[int],
    raw_ancestors_map: Optional[dict] = None,
) -> dict[int, list[AncestorEntry]]:
    """
    Get ancestor chain as AncestorEntry objects for multiple documents.

    This is a wrapper around get_ancestors_batch that converts the results
    to AncestorEntry Pydantic models.

    Args:
        document_ids: List of document IDs
        raw_ancestors_map: Optional pre-fetched ancestors (to avoid redundant queries)

    Returns:
        Dict mapping doc_id -> list of AncestorEntry objects
    """
    if not document_ids:
        return {}

    # Use provided ancestors or fetch them
    if raw_ancestors_map is None:
        ancestors_map = get_ancestors_batch(document_ids)
    else:
        ancestors_map = raw_ancestors_map

    result: dict[int, list[AncestorEntry]] = {}
    for doc_id, ancestors in ancestors_map.items():
        result[doc_id] = [
            AncestorEntry(
                document_id=a.get("id"),
                citation=a.get("citation") or "",
                title=a.get("title") or a.get("short_title") or "",
                hierarchy_level=a.get("hierarchy_level") or "",
            )
            for a in ancestors
        ]

    # Ensure all requested docs are in result
    for doc_id in document_ids:
        if doc_id not in result:
            result[doc_id] = []

    return result


# =============================================================================
# Cache Batching Queries
# =============================================================================


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_subchapter_ids_batch(
    document_ids: list[int],
) -> dict[int, Optional[int]]:
    """
    Get the subchapter ID (or nearest container) for each document.

    This is used for grouping documents to maximize prompt cache hits,
    since siblings in the same subchapter share context.

    Args:
        document_ids: List of document IDs

    Returns:
        Dict mapping doc_id -> subchapter_id (or None if not found)
    """
    if not document_ids:
        return {}

    # Use ancestors to find the subchapter for each document
    ancestors_map = get_ancestors_batch(document_ids)

    result: dict[int, Optional[int]] = {}
    for doc_id in document_ids:
        ancestors = ancestors_map.get(doc_id, [])
        subchapter_id = None

        # Find the first ancestor that is a subchapter (or chapter if no subchapter)
        for ancestor in ancestors:
            level = ancestor.get("hierarchy_level", "")
            if level == "subchapter":
                subchapter_id = ancestor["id"]
                break
            elif level == "chapter" and subchapter_id is None:
                subchapter_id = ancestor["id"]

        result[doc_id] = subchapter_id

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_subchapter_info(subchapter_id: int) -> dict:
    """
    Get basic info for a subchapter document.

    Args:
        subchapter_id: The subchapter document ID

    Returns:
        Dict with citation, title, etc.
    """
    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")
    query = """
        SELECT id, citation, title, short_title, summary
        FROM regulatory_documents
        WHERE id = %s
    """
    with conn.cursor() as cur:
        cur.execute(query, [subchapter_id])
        row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return {"id": subchapter_id, "citation": "", "title": ""}

    return {
        "id": row[0],
        "citation": row[1] or "",
        "title": row[2] or row[3] or "",
        "summary": row[4] or "",
    }


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_children_of_parent(parent_id: int) -> list[SiblingEntry]:
    """
    Get all children (siblings) of a parent document.

    Args:
        parent_id: The parent document ID

    Returns:
        List of SiblingEntry objects for all children
    """
    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")
    query = """
        SELECT
            id, citation, title, short_title, summary, section_type
        FROM regulatory_documents
        WHERE parent_id = %s
        ORDER BY citation
    """
    with conn.cursor() as cur:
        cur.execute(query, [parent_id])
        rows = cur.fetchall()
    conn.commit()
    conn.close()

    result: list[SiblingEntry] = []
    for row in rows:
        result.append(_build_sibling_entry(
            document_id=row[0],
            citation=row[1] or "",
            title=row[2] or row[3] or "",
            section_type=row[5] or "",
            summary=row[4],
        ))

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_subchapter_info_batch(subchapter_ids: list[int]) -> dict[int, dict]:
    """
    Get basic info for multiple subchapter documents in a single query.

    Args:
        subchapter_ids: List of subchapter document IDs

    Returns:
        Dict mapping subchapter_id -> info dict
    """
    if not subchapter_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    query = """
        SELECT id, citation, title, short_title, summary
        FROM regulatory_documents
        WHERE id = ANY(%s)
    """
    with conn.cursor() as cur:
        cur.execute(query, [subchapter_ids])
        rows = cur.fetchall()
    conn.commit()
    conn.close()

    result: dict[int, dict] = {}
    for row in rows:
        result[row[0]] = {
            "id": row[0],
            "citation": row[1] or "",
            "title": row[2] or row[3] or "",
            "summary": row[4] or "",
        }

    # Fill in missing IDs with defaults
    for sid in subchapter_ids:
        if sid not in result:
            result[sid] = {"id": sid, "citation": "", "title": ""}

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_children_of_parents_batch(parent_ids: list[int]) -> dict[int, list[SiblingEntry]]:
    """
    Get all children (siblings) for multiple parent documents in a single query.

    Args:
        parent_ids: List of parent document IDs

    Returns:
        Dict mapping parent_id -> list of SiblingEntry objects
    """
    if not parent_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    query = """
        SELECT
            parent_id, id, citation, title, short_title, summary, section_type
        FROM regulatory_documents
        WHERE parent_id = ANY(%s)
        ORDER BY parent_id, citation
    """
    with conn.cursor() as cur:
        cur.execute(query, [parent_ids])
        rows = cur.fetchall()
    conn.commit()
    conn.close()

    result: dict[int, list[SiblingEntry]] = {pid: [] for pid in parent_ids}
    for row in rows:
        parent_id = row[0]
        result[parent_id].append(_build_sibling_entry(
            document_id=row[1],
            citation=row[2] or "",
            title=row[3] or row[4] or "",
            section_type=row[6] or "",
            summary=row[5],
        ))

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_definitions_for_scopes_batch(scope_ids: list[int]) -> dict[int, list[str]]:
    """
    Get definition terms scoped to multiple documents in a single batch.

    For each scope_id, includes definitions inherited from ancestors.

    Args:
        scope_ids: List of scope document IDs (typically subchapter or chapter)

    Returns:
        Dict mapping scope_id -> list of term strings
    """
    if not scope_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Get ancestors for all scope docs in one batch
    ancestors_map = get_ancestors_batch(scope_ids)

    # Build per-scope ancestor ID lists
    scope_to_ancestor_ids: dict[int, list[int]] = {}
    all_ancestor_ids: set[int] = set(scope_ids)
    for scope_id in scope_ids:
        ancestor_ids = [scope_id]
        for ancestor in ancestors_map.get(scope_id, []):
            ancestor_ids.append(ancestor["id"])
            all_ancestor_ids.add(ancestor["id"])
        scope_to_ancestor_ids[scope_id] = ancestor_ids

    # Single query for all definitions
    query = """
        SELECT scope_document_id, term
        FROM definitions
        WHERE scope_document_id = ANY(%s)
        ORDER BY term
    """
    with conn.cursor() as cur:
        cur.execute(query, [list(all_ancestor_ids)])
        rows = cur.fetchall()
    conn.commit()
    conn.close()

    # Map scope_document_id -> terms
    scope_to_terms: dict[int, set[str]] = defaultdict(set)
    for row in rows:
        if row[1]:
            scope_to_terms[row[0]].add(row[1])

    # Build result: each scope gets its own terms + inherited from ancestors
    result: dict[int, list[str]] = {}
    for scope_id in scope_ids:
        terms: set[str] = set()
        for ancestor_id in scope_to_ancestor_ids[scope_id]:
            terms.update(scope_to_terms.get(ancestor_id, set()))
        result[scope_id] = sorted(terms)

    return result


@retry_db_operation(max_retries=5, base_delay=1.0)
def get_definitions_for_scope(scope_id: int) -> list[str]:
    """
    Get definition terms scoped to a specific document.

    Args:
        scope_id: The scope document ID (typically subchapter or chapter)

    Returns:
        List of term strings
    """
    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")

    # Get ancestors of the scope document to include inherited definitions
    ancestors_map = get_ancestors_batch([scope_id])
    ancestor_ids = [scope_id]
    for ancestor in ancestors_map.get(scope_id, []):
        ancestor_ids.append(ancestor["id"])

    query = """
        SELECT DISTINCT term
        FROM definitions
        WHERE scope_document_id = ANY(%s)
        ORDER BY term
    """
    with conn.cursor() as cur:
        cur.execute(query, [ancestor_ids])
        rows = cur.fetchall()
    conn.commit()
    conn.close()

    return [row[0] for row in rows if row[0]]
