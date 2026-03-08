"""Database queries for fetching regulatory sections for JenAI analysis."""
import logging

from lib.db import get_db_connection
from lib.jurisdictions import jurisdiction_prefix

logger = logging.getLogger(__name__)


"""Section types excluded by default (low analytical value)."""
EXCLUDED_SECTION_TYPES = ('reserved', 'definitions', 'scope')

def get_sections_for_analysis(
    jurisdiction: str,
    title: int | None = None,
    part: str | None = None,
    limit: int | None = None,
    exclude_analyzed: bool = True,
    include_all_types: bool = False,
    document_ids: list[int] | None = None,
) -> list[dict]:
    """Fetch regulatory sections eligible for JenAI analysis.

    Args:
        jurisdiction: Jurisdiction code ('nj', 'ny', or 'nyc')
        title: Optional title number to filter by
        part: Optional part number to filter by (e.g. '413' for child care)
        limit: Max sections to return
        exclude_analyzed: If True, skip sections with existing jenai_analyses
        include_all_types: If True, include reserved/definitions/scope sections
        document_ids: Optional list of specific document IDs to analyze

    Returns:
        List of dicts with section data
    """
    conn = get_db_connection()
    if not conn:
        logger.warning("get_sections_for_analysis: no DB connection, returning empty list")
        return []

    prefix = jurisdiction_prefix(jurisdiction)

    conditions = [
        "rd.jurisdiction = %s",
        "rd.type = 'regulation'",
        "rd.hierarchy_level IN ('section', 'subpart')",
        "(rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)",
        "rd.content IS NOT NULL",
        "LENGTH(rd.content) > 50",
    ]
    # Only enforce leaf-only when not targeting specific documents —
    # explicit --document-id should not be silently filtered out
    if not document_ids:
        conditions.append("rd.direct_child_count = 0")
    params: list = [jurisdiction.upper()]

    if not include_all_types:
        placeholders = ', '.join(['%s'] * len(EXCLUDED_SECTION_TYPES))
        conditions.append(
            f"(rd.section_type IS NULL OR rd.section_type NOT IN ({placeholders}))"
        )
        params.extend(EXCLUDED_SECTION_TYPES)

    if title is not None:
        conditions.append(f"rd.{prefix}_title = %s")
        params.append(str(title))

    if part is not None:
        conditions.append(f"rd.{prefix}_part = %s")
        params.append(str(part))

    if document_ids:
        placeholders = ', '.join(['%s'] * len(document_ids))
        conditions.append(f"rd.id IN ({placeholders})")
        params.extend(document_ids)

    if exclude_analyzed:
        conditions.append(
            "NOT EXISTS (SELECT 1 FROM jenai_analyses ja WHERE ja.document_id = rd.id)"
        )

    query = f"""
        SELECT
            rd.id,
            rd.citation,
            rd.title,
            rd.content,
            rd.jurisdiction,
            rd.summary,
            rd.url,
            rd.hierarchy_level,
            rd.parent_id,
            rd.{prefix}_title AS reg_title_num
        FROM regulatory_documents rd
        WHERE {' AND '.join(conditions)}
        ORDER BY rd.id
    """

    if limit is not None:
        query += " LIMIT %s"
        params.append(limit)

    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        conn.commit()
        conn.close()
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        print(f"ERROR fetching sections: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return []


def get_guidance_for_analysis(
    jurisdiction: str,
    agency: str | None = None,
    doc_type: str | None = None,
    limit: int | None = None,
    exclude_analyzed: bool = True,
    document_ids: list[int] | None = None,
) -> list[dict]:
    """Fetch guidance documents eligible for JenAI analysis.

    Args:
        jurisdiction: Jurisdiction code ('nj', 'ny', or 'nyc')
        agency: Optional agency filter (e.g., 'OCFS')
        doc_type: Optional document type filter (e.g., 'ADM')
        limit: Max documents to return
        exclude_analyzed: If True, skip documents with existing jenai_analyses
        document_ids: Optional list of specific guidance document IDs

    Returns:
        List of dicts with guidance document data, keyed for compatibility
        with the regulation pipeline (id, citation, title, content, jurisdiction).
    """
    conn = get_db_connection()
    if not conn:
        logger.warning("get_guidance_for_analysis: no DB connection, returning empty list")
        return []

    conditions = [
        "gd.jurisdiction = %s",
        "gd.content IS NOT NULL",
        "LENGTH(gd.content) > 50",
    ]
    params: list = [jurisdiction.upper()]

    if agency is not None:
        conditions.append("gd.agency = %s")
        params.append(agency)

    if doc_type is not None:
        conditions.append("gd.doc_type = %s")
        params.append(doc_type)

    if document_ids:
        placeholders = ', '.join(['%s'] * len(document_ids))
        conditions.append(f"gd.id IN ({placeholders})")
        params.extend(document_ids)

    if exclude_analyzed:
        conditions.append(
            "NOT EXISTS (SELECT 1 FROM jenai_analyses ja WHERE ja.guidance_document_id = gd.id)"
        )

    query = f"""
        SELECT
            gd.id,
            gd.canonical_ref AS citation,
            gd.title,
            gd.content,
            gd.jurisdiction,
            NULL AS summary,
            gd.url,
            NULL AS hierarchy_level,
            NULL AS parent_id,
            gd.agency,
            gd.doc_type,
            gd.date_published,
            gd.status,
            gd.cites_regulations
        FROM guidance_documents gd
        WHERE {' AND '.join(conditions)}
        ORDER BY gd.id
    """

    if limit is not None:
        query += " LIMIT %s"
        params.append(limit)

    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        conn.commit()
        conn.close()
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        print(f"ERROR fetching guidance documents: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return []
