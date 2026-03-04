"""
Guidance document context for the research pipeline.

Builds context for guidance documents by fetching:
- Cited regulation summaries (via cross_references with source_guidance_id)
- Guidance document content and metadata

Guidance docs don't have hierarchy (no parent/child/sibling relationships),
so context comes from cross-references to the regulations they cite.
"""

from collections import defaultdict
from typing import Optional

from psycopg import Connection

from lib.db import get_db_connection


def fetch_cited_regulation_summaries(
    guidance_ids: list[int],
    conn: Optional[Connection] = None,
) -> dict[int, list[dict]]:
    """
    Fetch summaries of regulations cited by guidance documents.

    Joins cross_references (source_guidance_id) to regulatory_documents
    to get citation, title, summary, and section_type for each cited regulation.

    Args:
        guidance_ids: List of guidance_documents IDs
        conn: Optional database connection

    Returns:
        Dict mapping guidance_document_id -> list of cited regulation dicts:
        [{citation, title, summary, section_type, document_id}]
    """
    if not guidance_ids:
        return {}

    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    if conn is None:
        raise RuntimeError("Failed to establish database connection for guidance context")

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    cr.source_guidance_id,
                    rd.id as document_id,
                    rd.citation,
                    rd.title,
                    rd.summary,
                    rd.section_type
                FROM cross_references cr
                JOIN regulatory_documents rd ON cr.target_document_id = rd.id
                WHERE cr.source_guidance_id = ANY(%s)
                    AND cr.target_document_id IS NOT NULL
                    AND cr.is_resolved = true
                ORDER BY cr.source_guidance_id, rd.citation
            """, (guidance_ids,))

            results: dict[int, list[dict]] = defaultdict(list)
            for row in cur.fetchall():
                results[row[0]].append({
                    "document_id": row[1],
                    "citation": row[2] or "",
                    "title": row[3] or "",
                    "summary": row[4] or "",
                    "section_type": row[5] or "",
                })

            return dict(results)
    finally:
        if should_close:
            conn.close()


def build_guidance_batch_context(
    guidance_id: int,
    cited_summaries: list[dict],
    metadata: Optional[dict] = None,
) -> str:
    """
    Format cited regulation summaries as context for prompt insertion.

    Args:
        guidance_id: The guidance document ID
        cited_summaries: List of dicts from fetch_cited_regulation_summaries
        metadata: Optional guidance doc metadata (agency, doc_type, etc.)

    Returns:
        Formatted string for prompt context
    """
    if not cited_summaries:
        return "(no cited regulations resolved)"

    lines = []
    for reg in cited_summaries[:20]:  # Cap at 20 cited regulations
        citation = reg.get("citation", "")
        title = reg.get("title", "")
        summary = reg.get("summary", "")
        section_type = reg.get("section_type", "")

        header = citation or title
        if section_type:
            header += f" [{section_type}]"

        if summary:
            lines.append(f"- {header}: {summary[:300]}")
        else:
            lines.append(f"- {header}: (no summary available)")

    result = "\n".join(lines)
    if len(cited_summaries) > 20:
        result += f"\n... and {len(cited_summaries) - 20} more cited regulations"

    return result


def fetch_guidance_content_batch(
    guidance_ids: list[int],
    conn: Optional[Connection] = None,
) -> dict[int, dict]:
    """
    Fetch content and metadata from guidance_documents table.

    Args:
        guidance_ids: List of guidance document IDs
        conn: Optional database connection

    Returns:
        Dict mapping guidance_document_id -> {content, citation (from canonical_ref),
        title, agency, doc_type, date_published, status, cites_regulations}
    """
    if not guidance_ids:
        return {}

    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    if conn is None:
        raise RuntimeError("Failed to establish database connection for guidance content")

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id, content, canonical_ref, title,
                    agency, doc_type, date_published, status,
                    cites_regulations
                FROM guidance_documents
                WHERE id = ANY(%s)
            """, (guidance_ids,))

            results = {}
            for row in cur.fetchall():
                results[row[0]] = {
                    "content": row[1] or "",
                    "citation": row[2] or "",
                    "title": row[3] or "",
                    "agency": row[4] or "",
                    "doc_type": row[5] or "",
                    "date_published": str(row[6]) if row[6] else "",
                    "status": row[7] or "",
                    "cites_regulations": row[8] or [],
                }
            return results
    finally:
        if should_close:
            conn.close()


def format_guidance_preamble(metadata: dict) -> str:
    """
    Format guidance document metadata as a preamble for the LLM prompt.

    Args:
        metadata: Dict with agency, doc_type, date_published, status, cites_regulations

    Returns:
        Formatted preamble string
    """
    parts = []
    parts.append("=== GUIDANCE DOCUMENT (NOT A REGULATION) ===")
    parts.append("This is a guidance document — an agency interpretation, directive, or advisory.")
    parts.append("It does NOT have the force of law by itself.")
    parts.append("Characterize (do not assume) its relationship to any cited regulations.")

    if metadata.get("agency"):
        parts.append(f"Issuing agency: {metadata['agency']}")
    if metadata.get("doc_type"):
        parts.append(f"Document type: {metadata['doc_type']}")
    if metadata.get("date_published"):
        parts.append(f"Date published: {metadata['date_published']}")
    if metadata.get("status"):
        parts.append(f"Status: {metadata['status']}")
    if metadata.get("cites_regulations"):
        citations = metadata["cites_regulations"]
        if len(citations) <= 5:
            parts.append(f"Cites regulations: {', '.join(citations)}")
        else:
            parts.append(f"Cites regulations: {', '.join(citations[:5])} ... and {len(citations) - 5} more")

    parts.append("=" * 50)
    return "\n".join(parts)


# Shared batch_context_vars placeholder for guidance documents (no regulatory hierarchy).
# Used by tier1_runner and tier2_runner when building prompts for guidance units.
GUIDANCE_BATCH_CONTEXT_VARS: dict[str, str] = {
    "subchapter_citation": "(guidance document — no regulatory hierarchy)",
    "ancestor_summaries": "(guidance documents have no regulatory ancestors)",
    "sibling_catalog": "(guidance documents have no regulatory siblings)",
    "sibling_count": "0",
    "sibling_catalog_truncated": "",
    "keyword_sibling_summaries": "(not applicable for guidance documents)",
}
