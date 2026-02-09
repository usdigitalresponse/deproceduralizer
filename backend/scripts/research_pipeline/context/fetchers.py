"""
Content fetching functions for the research pipeline.

This module contains functions for fetching document content, summaries,
and full text for context items requested by the LLM.

All database functions are wrapped with retry_db_operation for resilience
to connection failures during long-running batch processes.
"""

from typing import Optional
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from shared_utils import get_db_connection

# Import existing batch queries
from scripts.local_summarization.db_queries import get_ancestors_batch

# Import Pydantic models
from scripts.research_pipeline.models.context import ContextRequest

# Import proactive helpers (for summary fallback)
from .proactive import get_summary_or_fallback, SUMMARY_FALLBACK_LENGTH

# Import retry decorator for connection resilience
from scripts.research_pipeline.db.connection import retry_db_operation


# =============================================================================
# Scope Chain Helpers
# =============================================================================


def build_scope_chains(
    scope_doc_ids: set[int],
    ancestors_map: dict[int, list[dict]],
) -> tuple[dict[int, list[int]], set[int]]:
    """
    Build ordered scope chains for definition lookup.

    Given a set of document IDs and their ancestor mappings, builds chains
    from each document up through its hierarchy. Used for scope-aware
    definition lookups where definitions can be inherited from parent docs.

    Args:
        scope_doc_ids: Set of document IDs to build chains for
        ancestors_map: Mapping of doc_id -> list of ancestor dicts with "id" key

    Returns:
        Tuple of:
        - doc_to_scope_chain: Mapping of doc_id -> [self, parent, grandparent, ...]
        - all_scope_ids: Set of all scope IDs appearing in any chain
    """
    doc_to_scope_chain: dict[int, list[int]] = {}
    all_scope_ids: set[int] = set(scope_doc_ids)

    for doc_id in scope_doc_ids:
        chain = [doc_id]
        for ancestor in ancestors_map.get(doc_id, []):
            chain.append(ancestor["id"])
            all_scope_ids.add(ancestor["id"])
        doc_to_scope_chain[doc_id] = chain

    return doc_to_scope_chain, all_scope_ids


# =============================================================================
# Document Content Fetchers
# =============================================================================


@retry_db_operation()
def fetch_document_content_batch(
    document_ids: list[int],
) -> dict[int, dict]:
    """
    Fetch full document content for multiple documents.

    Used by Tier 2+ when full text is needed for analysis.

    Args:
        document_ids: List of document IDs

    Returns:
        Dict mapping doc_id -> {content, citation, title, summary}
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection")

    query = """
        SELECT id, content, citation, title, short_title, summary
        FROM regulatory_documents
        WHERE id = ANY(%s)
    """

    with conn.cursor() as cur:
        cur.execute(query, [document_ids])
        rows = cur.fetchall()

    conn.close()

    return {
        row[0]: {
            "content": row[1] or "",
            "citation": row[2] or "",
            "title": row[3] or row[4] or "",
            "summary": row[5] or "",
        }
        for row in rows
    }


def fetch_document_summaries_batch(document_ids: list[int]) -> dict[int, str]:
    """
    Fetch summaries for target documents using fallback strategy.

    Uses get_summary_or_fallback to provide meaningful text even when
    summary column is empty (falls back to truncated content or title).

    This is used by Tier 1 to get the document summary for the target
    document being analyzed.

    Args:
        document_ids: List of document IDs to fetch summaries for

    Returns:
        Dict mapping doc_id -> summary text (always non-empty)
    """
    if not document_ids:
        return {}

    content_map = fetch_document_content_batch(document_ids)
    result: dict[int, str] = {}

    for doc_id in document_ids:
        data = content_map.get(doc_id, {})
        summary_text, _ = get_summary_or_fallback(
            data.get("summary"),
            data.get("content"),
            data.get("title", "Unknown"),
        )
        result[doc_id] = summary_text

    return result


# =============================================================================
# Context Request Fetchers
# =============================================================================


@retry_db_operation()
def fetch_summaries_for_requests(
    context_requests: list[ContextRequest],
) -> dict[str, str]:
    """
    Fetch summaries for context items requested by the LLM.

    Groups requests by type and fetches in batch.
    Returns summaries keyed by identifier (citation or term).

    For definitions, uses scope_document_id to find the most specific
    applicable definition in the document's scope chain.

    Args:
        context_requests: List of ContextRequest objects from LLM

    Returns:
        Dict mapping identifier -> summary text
    """
    if not context_requests:
        return {}

    # Group requests by type
    doc_citations: list[str] = []
    # Map citation -> list of composite keys (same citation may appear under multiple types)
    citation_to_keys: dict[str, list[str]] = {}
    definition_requests: list[ContextRequest] = []

    for req in context_requests:
        if req.need_level != "summary":
            continue  # Only fetch summaries
        if req.context_type in ("sibling", "cross_reference", "hierarchy"):
            doc_citations.append(req.identifier)
            composite_key = f"{req.context_type}:{req.identifier}"
            citation_to_keys.setdefault(req.identifier, []).append(composite_key)
        elif req.context_type == "definition":
            definition_requests.append(req)

    result: dict[str, str] = {}
    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection")

    # Fetch document summaries by citation
    if doc_citations:
        query = """
            SELECT citation, summary
            FROM regulatory_documents
            WHERE citation = ANY(%s) AND summary IS NOT NULL
        """
        with conn.cursor() as cur:
            cur.execute(query, [doc_citations])
            for row in cur.fetchall():
                if row[1]:
                    # Store under each composite key that references this citation
                    for key in citation_to_keys.get(row[0], []):
                        result[key] = row[1]

    # Fetch definitions with scope-aware lookup
    if definition_requests:
        # Group requests by scope_document_id
        scope_doc_ids = set()
        for req in definition_requests:
            if req.scope_document_id:
                scope_doc_ids.add(req.scope_document_id)

        if scope_doc_ids:
            # Get ancestor chains for all scope documents
            ancestors_map = get_ancestors_batch(list(scope_doc_ids))
            doc_to_scope_chain, all_scope_ids = build_scope_chains(
                scope_doc_ids, ancestors_map
            )

            # Fetch all definitions from any scope in any chain
            terms_lower = [req.identifier.lower() for req in definition_requests]
            query = """
                SELECT scope_document_id, term,
                       COALESCE(
                           CASE WHEN is_verbatim_text_complete THEN verbatim_text END,
                           rephrased_definition,
                           verbatim_text
                       ) as definition_text
                FROM definitions
                WHERE scope_document_id = ANY(%s) AND LOWER(term) = ANY(%s)
            """
            with conn.cursor() as cur:
                cur.execute(query, [list(all_scope_ids), terms_lower])
                rows = cur.fetchall()

            # Map scope_id -> term_lower -> definition_text (nested for cleaner lookup)
            scope_to_defs: dict[int, dict[str, str]] = {}
            for row in rows:
                if row[2]:
                    scope_id, term, def_text = row[0], row[1].lower(), row[2]
                    if scope_id not in scope_to_defs:
                        scope_to_defs[scope_id] = {}
                    scope_to_defs[scope_id][term] = def_text

            # For each request, find the best definition (most specific scope)
            # Use composite key to avoid collision when multiple docs request same term
            for req in definition_requests:
                if not req.scope_document_id:
                    continue
                term_lower = req.identifier.lower()
                chain = doc_to_scope_chain.get(req.scope_document_id, [req.scope_document_id])
                for scope_id in chain:  # Nearest first
                    if scope_id in scope_to_defs and term_lower in scope_to_defs[scope_id]:
                        # Composite key: def:{scope_document_id}:{term}
                        key = f"def:{req.scope_document_id}:{term_lower}"
                        result[key] = scope_to_defs[scope_id][term_lower]
                        break

        # Fallback for requests without scope_document_id
        terms_without_scope = [
            req.identifier.lower()
            for req in definition_requests
            if not req.scope_document_id and req.identifier.lower() not in result
        ]
        if terms_without_scope:
            query = """
                SELECT term,
                       COALESCE(
                           CASE WHEN is_verbatim_text_complete THEN verbatim_text END,
                           rephrased_definition,
                           verbatim_text
                       ) as definition_text
                FROM definitions
                WHERE LOWER(term) = ANY(%s)
            """
            with conn.cursor() as cur:
                cur.execute(query, [terms_without_scope])
                for row in cur.fetchall():
                    if row[1]:
                        term_key = (row[0] or "").lower()
                        if term_key and term_key not in result:
                            result[term_key] = row[1]

    conn.close()
    return result


@retry_db_operation()
def fetch_full_text_for_requests(
    context_requests: list[ContextRequest],
) -> dict[str, str]:
    """
    Fetch full text for context items requested by the LLM (Tier 3).

    For definitions, uses scope_document_id to find the most specific
    applicable definition in the document's scope chain.

    Args:
        context_requests: List of ContextRequest objects from LLM

    Returns:
        Dict mapping identifier -> full text content
    """
    if not context_requests:
        return {}

    # Group requests by type
    doc_citations: list[str] = []
    # Map citation -> list of composite keys (same citation may appear under multiple types)
    citation_to_keys: dict[str, list[str]] = {}
    definition_requests: list[ContextRequest] = []

    for req in context_requests:
        if req.need_level != "full_text":
            continue
        if req.context_type in ("sibling", "cross_reference", "hierarchy"):
            doc_citations.append(req.identifier)
            composite_key = f"{req.context_type}:{req.identifier}"
            citation_to_keys.setdefault(req.identifier, []).append(composite_key)
        elif req.context_type == "definition":
            definition_requests.append(req)

    result: dict[str, str] = {}
    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection")

    # Fetch document content by citation
    # OPTIMIZATION: Cross-references to definitions sections get definitions
    # instead of full document content (saves tokens)
    if doc_citations:
        # First, identify which citations are definitions sections
        query = """
            SELECT id, citation, content, section_type
            FROM regulatory_documents
            WHERE citation = ANY(%s) AND content IS NOT NULL
        """
        regular_docs: list[tuple[str, str]] = []  # (citation, content)
        definitions_doc_ids: list[int] = []
        definitions_citations: dict[int, str] = {}  # id -> citation

        with conn.cursor() as cur:
            cur.execute(query, [doc_citations])
            for row in cur.fetchall():
                doc_id, citation, content, section_type = row
                if section_type == "definitions":
                    # This is a definitions section - fetch definitions instead
                    definitions_doc_ids.append(doc_id)
                    definitions_citations[doc_id] = citation
                else:
                    # Regular document - use content directly
                    if content:
                        regular_docs.append((citation, content))

        # Add regular document content to result with composite keys
        for citation, content in regular_docs:
            for key in citation_to_keys.get(citation, []):
                result[key] = content

        # For definitions sections, fetch all definitions scoped to them
        if definitions_doc_ids:
            defs_query = """
                SELECT scope_document_id, term, verbatim_text
                FROM definitions
                WHERE scope_document_id = ANY(%s)
                ORDER BY scope_document_id, term
            """
            with conn.cursor() as cur:
                cur.execute(defs_query, [definitions_doc_ids])
                rows = cur.fetchall()

            # Group definitions by scope_document_id and format as text
            defs_by_doc: dict[int, list[str]] = {}
            for row in rows:
                scope_id, term, verbatim = row
                if verbatim:
                    if scope_id not in defs_by_doc:
                        defs_by_doc[scope_id] = []
                    defs_by_doc[scope_id].append(f'"{term}": {verbatim}')

            # Build formatted definitions text for each citation with composite keys
            for doc_id, citation in definitions_citations.items():
                if doc_id in defs_by_doc:
                    defs_text = "\n\n".join(defs_by_doc[doc_id])
                    for key in citation_to_keys.get(citation, []):
                        result[key] = f"[Definitions Section]\n\n{defs_text}"

    # Fetch definitions with scope-aware lookup
    if definition_requests:
        # Group requests by scope_document_id
        scope_doc_ids = set()
        for req in definition_requests:
            if req.scope_document_id:
                scope_doc_ids.add(req.scope_document_id)

        if scope_doc_ids:
            # Get ancestor chains for all scope documents
            ancestors_map = get_ancestors_batch(list(scope_doc_ids))
            doc_to_scope_chain, all_scope_ids = build_scope_chains(
                scope_doc_ids, ancestors_map
            )

            # Fetch all definitions from any scope in any chain
            terms_lower = [req.identifier.lower() for req in definition_requests]
            query = """
                SELECT scope_document_id, term, verbatim_text
                FROM definitions
                WHERE scope_document_id = ANY(%s) AND LOWER(term) = ANY(%s)
            """
            with conn.cursor() as cur:
                cur.execute(query, [list(all_scope_ids), terms_lower])
                rows = cur.fetchall()

            # Map scope_id -> term_lower -> verbatim_text (nested for cleaner lookup)
            scope_to_defs: dict[int, dict[str, str]] = {}
            for row in rows:
                if row[2]:
                    scope_id, term, verbatim = row[0], row[1].lower(), row[2]
                    if scope_id not in scope_to_defs:
                        scope_to_defs[scope_id] = {}
                    scope_to_defs[scope_id][term] = verbatim

            # For each request, find the best definition (most specific scope)
            # Use composite key to avoid collision when multiple docs request same term
            for req in definition_requests:
                if not req.scope_document_id:
                    continue
                term_lower = req.identifier.lower()
                chain = doc_to_scope_chain.get(req.scope_document_id, [req.scope_document_id])
                for scope_id in chain:  # Nearest first
                    if scope_id in scope_to_defs and term_lower in scope_to_defs[scope_id]:
                        # Composite key: def:{scope_document_id}:{term}
                        key = f"def:{req.scope_document_id}:{term_lower}"
                        result[key] = scope_to_defs[scope_id][term_lower]
                        break

        # Fallback for requests without scope_document_id
        terms_without_scope = [
            req.identifier.lower()
            for req in definition_requests
            if not req.scope_document_id and req.identifier.lower() not in result
        ]
        if terms_without_scope:
            query = """
                SELECT term, verbatim_text
                FROM definitions
                WHERE LOWER(term) = ANY(%s)
            """
            with conn.cursor() as cur:
                cur.execute(query, [terms_without_scope])
                for row in cur.fetchall():
                    if row[1]:
                        term_key = (row[0] or "").lower()
                        if term_key and term_key not in result:
                            result[term_key] = row[1]

    conn.close()
    return result
