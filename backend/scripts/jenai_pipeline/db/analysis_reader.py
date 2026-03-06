"""Read existing JenAI analysis data from the database."""
from lib.db import get_db_connection


def get_existing_analyses(
    document_ids: list[int],
) -> dict[int, dict]:
    """Fetch existing JenAI analyses for given document IDs.

    Used for resume: check what has already been analyzed.

    Args:
        document_ids: List of regulatory_documents IDs

    Returns:
        Dict mapping document_id -> analysis info dict with keys:
            analysis_id, classification
    """
    if not document_ids:
        return {}

    conn = get_db_connection()
    if not conn:
        return {}

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    document_id,
                    id AS analysis_id,
                    classification
                FROM jenai_analyses
                WHERE document_id = ANY(%s)
            """, (document_ids,))

            result = {}
            for row in cur.fetchall():
                result[row[0]] = {
                    'analysis_id': row[1],
                    'classification': row[2],
                }
        conn.commit()
        conn.close()
        return result
    except Exception as e:
        print(f"ERROR fetching existing analyses: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return {}
