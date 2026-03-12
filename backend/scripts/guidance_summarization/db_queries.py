"""Database queries for guidance document summarization."""

from typing import Optional

from lib.db import get_db_connection


def get_connection():
    """Get database connection."""
    conn = get_db_connection()
    if conn is None:
        raise RuntimeError("Failed to establish database connection")
    return conn


def get_guidance_docs(
    agency: Optional[str] = None,
    doc_type: Optional[str] = None,
    resume: bool = False,
    limit: Optional[int] = None,
) -> list[dict]:
    """
    Get guidance documents to summarize.

    Args:
        agency: Filter by agency (e.g., 'OCFS', 'OTDA')
        doc_type: Filter by doc_type (e.g., 'ADM', 'LCM')
        resume: Skip docs that already have summaries
        limit: Max number of docs to return

    Returns:
        List of guidance doc dicts
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
    ]
    params: list = []

    if agency:
        conditions.append("agency = %s")
        params.append(agency.upper())

    if doc_type:
        conditions.append("doc_type = %s")
        params.append(doc_type)

    if resume:
        conditions.append("summary IS NULL")

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            id,
            title,
            content,
            agency,
            doc_type,
            canonical_ref,
            date_published,
            status,
            programs,
            cites_regulations
        FROM guidance_documents
        WHERE {where_clause}
        ORDER BY agency, doc_type, date_published DESC NULLS LAST
    """

    if limit:
        query += f" LIMIT {int(limit)}"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

    return [dict(zip(columns, row)) for row in rows]


def get_cross_ref_summaries(guidance_ids: list[int]) -> dict[int, list[dict]]:
    """
    Get regulation summaries cited by guidance documents via cross_references.

    Args:
        guidance_ids: List of guidance document IDs

    Returns:
        Dict mapping guidance_id -> list of {citation, summary} dicts
    """
    if not guidance_ids:
        return {}

    query = """
        SELECT
            cr.source_guidance_id,
            rd.citation,
            rd.summary,
            rd.title
        FROM cross_references cr
        JOIN regulatory_documents rd ON cr.target_document_id = rd.id
        WHERE cr.source_guidance_id = ANY(%s)
          AND rd.summary IS NOT NULL
        ORDER BY cr.source_guidance_id, rd.citation
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, [guidance_ids])
            rows = cur.fetchall()

    result: dict[int, list[dict]] = {gid: [] for gid in guidance_ids}
    for source_id, citation, summary, title in rows:
        result[source_id].append({
            "citation": citation or title,
            "summary": summary,
        })

    return result


def get_summarization_stats() -> dict:
    """Get counts of summarized vs unsummarized guidance docs."""
    query = """
        SELECT
            COUNT(*) FILTER (WHERE content IS NOT NULL AND content <> '') as total_with_content,
            COUNT(*) FILTER (WHERE summary IS NOT NULL) as summarized,
            COUNT(*) FILTER (WHERE content IS NOT NULL AND content <> '' AND summary IS NULL) as pending
        FROM guidance_documents
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            row = cur.fetchone()

    return {
        "total_with_content": row[0],
        "summarized": row[1],
        "pending": row[2],
    }


def batch_update_guidance_summaries(
    updates: list[dict],
    dry_run: bool = False,
) -> int:
    """
    Batch update guidance_documents with summary metadata.

    Args:
        updates: List of dicts with id, summary, section_type, keywords, applies_to, has_form, has_ibr
        dry_run: If True, don't commit

    Returns:
        Number of rows updated
    """
    if not updates:
        return 0

    from scripts.summarization.import_summaries import to_pg_array

    CHUNK_SIZE = 5000
    total_updated = 0

    with get_connection() as conn:
        for i in range(0, len(updates), CHUNK_SIZE):
            chunk = updates[i:i + CHUNK_SIZE]

            placeholders = []
            params = []

            for u in chunk:
                placeholders.append("(%s, %s, %s, %s::text[], %s::text[], %s, %s)")
                params.extend([
                    u["id"],
                    u["summary"],
                    u["section_type"],
                    to_pg_array(u.get("keywords", [])),
                    to_pg_array(u.get("applies_to", [])),
                    u.get("has_form", False),
                    u.get("has_ibr", False),
                ])

            query = f"""
                UPDATE guidance_documents AS gd
                SET
                    summary = v.summary,
                    section_type = v.section_type,
                    keywords = v.keywords,
                    applies_to = v.applies_to,
                    has_form = v.has_form,
                    has_ibr = v.has_ibr
                FROM (VALUES {", ".join(placeholders)}) AS v(
                    doc_id, summary, section_type, keywords, applies_to, has_form, has_ibr
                )
                WHERE gd.id = v.doc_id::bigint
            """

            # Each chunk is independently committed; rollback ensures clean
            # connection state for next chunk.
            conn.rollback()
            with conn.cursor() as cur:
                cur.execute(query, params)
                total_updated += cur.rowcount

            if not dry_run:
                conn.commit()

    return total_updated
