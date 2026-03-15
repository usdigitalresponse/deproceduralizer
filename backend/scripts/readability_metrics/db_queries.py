"""Database queries for readability metrics computation.

Follows patterns from scripts/summarization/import_summaries.py for
batch updates with chunking and deadlock retry.
"""

import time
from typing import Optional

import psycopg

from lib.db import get_db_connection


def get_connection() -> psycopg.Connection:
    """Get database connection via shared pool (includes statement timeout)."""
    conn = get_db_connection()
    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection")
    return conn


def get_guidance_docs_for_readability(
    agency: Optional[str] = None,
    resume: bool = True,
    limit: Optional[int] = None,
) -> list[dict]:
    """
    Get guidance documents eligible for readability computation.

    Args:
        agency: Optional agency filter (e.g., 'OCFS')
        resume: If True, skip docs that already have word_count computed
        limit: Max number of documents to return

    Returns:
        List of dicts with id and content fields
    """
    conditions = [
        "content IS NOT NULL",
        "content <> ''",
        "content NOT LIKE %s",
    ]
    params: list = ["%%PDF-%%"]

    if resume:
        conditions.append("word_count IS NULL")

    if agency:
        conditions.append("agency = %s")
        params.append(agency)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT id, content
        FROM guidance_documents
        WHERE {where_clause}
        ORDER BY id
    """

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    conn = get_connection()
    try:
        with conn.cursor(name="readability_fetch") as cur:
            cur.itersize = 500
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            rows = [dict(zip(columns, row)) for row in cur]
        conn.commit()
        conn.close()
        return rows
    except Exception:
        conn.close()
        raise


def get_readability_stats() -> dict:
    """
    Get readability computation status.

    Returns:
        Dict with total_with_content, computed, and pending counts
    """
    conn = get_connection()
    try:
        pdf_pattern = "%%PDF-%%"
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (
                        WHERE content IS NOT NULL
                          AND content <> ''
                          AND content NOT LIKE %s
                    ) AS total_with_content,
                    COUNT(*) FILTER (
                        WHERE word_count IS NOT NULL
                    ) AS computed,
                    COUNT(*) FILTER (
                        WHERE content IS NOT NULL
                          AND content <> ''
                          AND content NOT LIKE %s
                          AND word_count IS NULL
                    ) AS pending
                FROM guidance_documents
            """, [pdf_pattern, pdf_pattern])
            row = cur.fetchone()
        conn.commit()
        conn.close()
        return {
            "total_with_content": row[0],
            "computed": row[1],
            "pending": row[2],
        }
    except Exception:
        conn.close()
        raise


def batch_update_readability(
    updates: list[dict],
    max_retries: int = 5,
) -> int:
    """
    Batch update guidance_documents with readability metrics.

    Uses VALUES clause with chunking (5000 rows per chunk) to stay
    within PostgreSQL's 65535 parameter limit. Retries on deadlock
    with exponential backoff.

    Args:
        updates: List of dicts with id and all 12 readability columns
        max_retries: Max retry attempts per chunk on deadlock

    Returns:
        Number of rows updated
    """
    if not updates:
        return 0

    # PostgreSQL has a 65535 parameter limit. With 13 params per row,
    # we can fit ~5000 rows per batch.
    CHUNK_SIZE = 5000
    total_updated = 0

    conn = get_connection()
    try:
        for i in range(0, len(updates), CHUNK_SIZE):
            chunk = updates[i : i + CHUNK_SIZE]

            placeholders = []
            params: list = []

            for u in chunk:
                placeholders.append(
                    "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                )
                params.extend([
                    u["id"],
                    u["flesch_kincaid_grade"],
                    u["flesch_reading_ease"],
                    u["gunning_fog"],
                    u["automated_readability_index"],
                    u["coleman_liau_index"],
                    u["smog_index"],
                    u["dale_chall_readability_score"],
                    u["linsear_write_formula"],
                    u["reading_grade_level"],
                    u["difficult_word_count"],
                    u["word_count"],
                    u["sentence_count"],
                ])

            query = f"""
                UPDATE guidance_documents AS gd
                SET
                    flesch_kincaid_grade = v.flesch_kincaid_grade,
                    flesch_reading_ease = v.flesch_reading_ease,
                    gunning_fog = v.gunning_fog,
                    automated_readability_index = v.automated_readability_index,
                    coleman_liau_index = v.coleman_liau_index,
                    smog_index = v.smog_index,
                    dale_chall_readability_score = v.dale_chall_readability_score,
                    linsear_write_formula = v.linsear_write_formula,
                    reading_grade_level = v.reading_grade_level,
                    difficult_word_count = v.difficult_word_count,
                    word_count = v.word_count,
                    sentence_count = v.sentence_count
                FROM (VALUES {", ".join(placeholders)}) AS v(
                    doc_id,
                    flesch_kincaid_grade,
                    flesch_reading_ease,
                    gunning_fog,
                    automated_readability_index,
                    coleman_liau_index,
                    smog_index,
                    dale_chall_readability_score,
                    linsear_write_formula,
                    reading_grade_level,
                    difficult_word_count,
                    word_count,
                    sentence_count
                )
                WHERE gd.id = v.doc_id::bigint
            """

            for attempt in range(max_retries):
                try:
                    with conn.cursor() as cur:
                        cur.execute(query, params)
                        total_updated += cur.rowcount
                    conn.commit()
                    break
                except psycopg.errors.DeadlockDetected:
                    conn.rollback()
                    if attempt < max_retries - 1:
                        wait = 2**attempt + time.time() % 1
                        print(
                            f"  Deadlock on chunk {i // CHUNK_SIZE + 1}, "
                            f"retrying in {wait:.1f}s "
                            f"(attempt {attempt + 2}/{max_retries})"
                        )
                        time.sleep(wait)
                    else:
                        raise
    finally:
        conn.close()

    return total_updated
