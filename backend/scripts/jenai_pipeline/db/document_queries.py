"""Database queries for fetching regulatory sections for JenAI analysis."""
from lib.db import get_db_connection


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
        return []

    prefix = 'njac' if jurisdiction.lower() == 'nj' else 'nycrr'

    conditions = [
        "rd.state = %s",
        "rd.hierarchy_level = 'section'",
        "(rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)",
        "rd.content IS NOT NULL",
        "LENGTH(rd.content) > 50",
    ]
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
            rd.state,
            rd.summary,
            rd.url,
            rd.hierarchy_level,
            rd.parent_id
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
        conn.close()
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        print(f"ERROR fetching sections: {e}")
        if conn:
            conn.close()
        return []
