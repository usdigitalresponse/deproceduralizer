"""
Hierarchy stats refresh and time formatting utilities.
"""

import time


def format_time(seconds: float) -> str:
    """
    Format seconds into human-readable time string.

    Args:
        seconds: Number of seconds to format

    Returns:
        Formatted string like "45s", "5m 30s", or "2h 15m"
    """
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m {secs}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h {mins}m"


def refresh_structure_stats(conn, state: str) -> int:
    """
    Refresh structural hierarchy stats (children counts) for all documents.

    Updates: direct_child_count, descendant_count

    Should be called after data import.
    """
    print(f"  Computing structure stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Direct children count
        cur.execute("""
            WITH direct_children AS (
                SELECT parent_id, COUNT(*) as direct_child_count
                FROM regulatory_documents
                WHERE state = %s AND parent_id IS NOT NULL
                GROUP BY parent_id
            ),
            structure_stats AS (
                SELECT
                    rd.id,
                    COALESCE(dc.direct_child_count, 0) as direct_child_count
                FROM regulatory_documents rd
                LEFT JOIN direct_children dc ON rd.id = dc.parent_id
                WHERE rd.state = %s
            )
            UPDATE regulatory_documents rd
            SET direct_child_count = ss.direct_child_count
            FROM structure_stats ss
            WHERE rd.id = ss.id
        """, (state, state))

        conn.commit()

        # Descendants using recursive CTE
        cur.execute("""
            WITH RECURSIVE all_descendants AS (
                SELECT id, parent_id, 1 as depth
                FROM regulatory_documents
                WHERE state = %s

                UNION ALL

                SELECT ad.id, p.parent_id, ad.depth + 1
                FROM all_descendants ad
                JOIN regulatory_documents p ON p.id = ad.parent_id
                WHERE ad.depth < 100
            ),
            descendant_counts AS (
                SELECT parent_id, COUNT(DISTINCT id) as descendant_count
                FROM all_descendants
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET descendant_count = COALESCE(dc.descendant_count, 0)
            FROM descendant_counts dc
            WHERE rd.id = dc.parent_id
        """, (state,))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_analysis_stats(conn, state: str) -> int:
    """
    Refresh analysis-related hierarchy stats.

    Updates: descendant_flag_count, descendant_max_severity, has_descendant_analysis

    Should be called after red flag analysis.
    """
    print(f"  Computing analysis stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        cur.execute("""
            WITH RECURSIVE descendant_analysis AS (
                SELECT
                    rd.id as descendant_id,
                    rd.parent_id,
                    COALESCE(a.num_flags, 0) as num_flags,
                    a.max_severity,
                    a.id IS NOT NULL as has_analysis
                FROM regulatory_documents rd
                LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
                WHERE rd.state = %s

                UNION ALL

                SELECT
                    da.descendant_id,
                    p.parent_id,
                    da.num_flags,
                    da.max_severity,
                    da.has_analysis
                FROM descendant_analysis da
                JOIN regulatory_documents p ON p.id = da.parent_id
            ),
            analysis_stats AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(num_flags), 0)::int as descendant_flag_count,
                    MAX(max_severity) as descendant_max_severity,
                    BOOL_OR(has_analysis) as has_descendant_analysis
                FROM descendant_analysis
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET
                descendant_flag_count = ast.descendant_flag_count,
                descendant_max_severity = ast.descendant_max_severity,
                has_descendant_analysis = COALESCE(ast.has_descendant_analysis, false)
            FROM analysis_stats ast
            WHERE rd.id = ast.id AND rd.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_compliance_stats(conn, state: str) -> int:
    """
    Refresh compliance issue stats.

    Updates: compliance_issue_count, descendant_compliance_issue_count

    NOTE: Only counts issues where requirement_found = TRUE (LLM-confirmed).
    LLM-rejected matches (requirement_found = FALSE) are excluded from counts
    but remain visible in review mode for QA purposes.

    Should be called after compliance issue detection.
    """
    print(f"  Computing compliance stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Direct compliance issue counts (only LLM-confirmed issues)
        cur.execute("""
            WITH direct_issues AS (
                SELECT document_id, COUNT(*) as issue_count
                FROM compliance_issues
                WHERE state = %s AND requirement_found = TRUE
                GROUP BY document_id
            )
            UPDATE regulatory_documents rd
            SET compliance_issue_count = COALESCE(di.issue_count, 0)
            FROM (
                SELECT rd2.id, COALESCE(di.issue_count, 0) as issue_count
                FROM regulatory_documents rd2
                LEFT JOIN direct_issues di ON rd2.id = di.document_id
                WHERE rd2.state = %s
            ) di
            WHERE rd.id = di.id
        """, (state, state))

        conn.commit()

        # Descendant compliance issue counts
        cur.execute("""
            WITH RECURSIVE descendant_issues AS (
                SELECT
                    rd.id as descendant_id,
                    rd.parent_id,
                    COALESCE(rd.compliance_issue_count, 0) as issue_count
                FROM regulatory_documents rd
                WHERE rd.state = %s

                UNION ALL

                SELECT
                    di.descendant_id,
                    p.parent_id,
                    di.issue_count
                FROM descendant_issues di
                JOIN regulatory_documents p ON p.id = di.parent_id
            ),
            descendant_counts AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(issue_count), 0)::int as descendant_compliance_issue_count
                FROM descendant_issues
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET descendant_compliance_issue_count = dc.descendant_compliance_issue_count
            FROM descendant_counts dc
            WHERE rd.id = dc.id AND rd.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_statute_link_stats(conn, state: str) -> int:
    """
    Refresh precomputed descendant regulation link counts on the statutes table.

    Updates: descendant_linked_regulation_count, descendant_enabling_authority_count

    Uses a recursive CTE to walk the statutes.parent_id hierarchy and sum
    regulation_statute_links counts from all descendants.

    Should be called after statute linking.
    """
    print(f"  Computing statute link stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        cur.execute("""
            WITH RECURSIVE descendant_links AS (
                -- Base: each statute's own direct link counts
                SELECT
                    s.id as descendant_id,
                    s.parent_id,
                    (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id) as linked_regulation_count,
                    (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id AND rsl.link_type = 'enabling_authority') as enabling_authority_count
                FROM statutes s
                WHERE s.state = %s

                UNION ALL

                -- Recursive: propagate counts up to each parent
                SELECT
                    dl.descendant_id,
                    p.parent_id,
                    dl.linked_regulation_count,
                    dl.enabling_authority_count
                FROM descendant_links dl
                JOIN statutes p ON p.id = dl.parent_id
            ),
            aggregated AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(linked_regulation_count), 0)::int as descendant_linked_regulation_count,
                    COALESCE(SUM(enabling_authority_count), 0)::int as descendant_enabling_authority_count
                FROM descendant_links
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE statutes s
            SET
                descendant_linked_regulation_count = a.descendant_linked_regulation_count,
                descendant_enabling_authority_count = a.descendant_enabling_authority_count
            FROM aggregated a
            WHERE s.id = a.id AND s.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

        # Zero out statutes that have no descendants with links
        cur.execute("""
            UPDATE statutes
            SET descendant_linked_regulation_count = 0,
                descendant_enabling_authority_count = 0
            WHERE state = %s
              AND id NOT IN (
                  SELECT DISTINCT parent_id FROM statutes WHERE parent_id IS NOT NULL AND state = %s
              )
              AND (descendant_linked_regulation_count != 0 OR descendant_enabling_authority_count != 0)
        """, (state, state))

        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} statutes in {elapsed:.1f}s")
    return updated_count


def refresh_all_stats(conn, state: str) -> int:
    """
    Refresh ALL hierarchy stats (structural, analysis, and compliance).

    Returns the number of documents updated.
    """
    print(f"Refreshing all hierarchy stats for {state}...")
    start = time.time()

    updated1 = refresh_structure_stats(conn, state)
    updated2 = refresh_analysis_stats(conn, state)
    updated3 = refresh_compliance_stats(conn, state)
    updated4 = refresh_statute_link_stats(conn, state)

    elapsed = time.time() - start
    updated_count = max(updated1, updated2, updated3, updated4)
    print(f"✓ All stats complete in {elapsed:.1f}s")
    return updated_count
