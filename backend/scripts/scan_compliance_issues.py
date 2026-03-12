#!/usr/bin/env python3
"""
Compliance Issues Scanner.

Scans regulations for compliance issues using regex patterns and saves
matches to the compliance_issues table. LLM analysis is handled separately
by the research pipeline (Tier 1-3).

Regex matching runs in PostgreSQL (content ~* pattern) so document content
is never transferred over the network for non-matching docs.

Usage:
    python scan_compliance_issues.py --state ny
    python scan_compliance_issues.py --state ny --issue wet_signature
    python scan_compliance_issues.py --state ny --dry-run
    python scan_compliance_issues.py --state ny --limit 50
    python scan_compliance_issues.py --state ny --tag scan:compliance
    python scan_compliance_issues.py --list-issues
"""

import argparse
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

from compliance_issues.config import STATES, ISSUE_TYPES, list_issue_types
from lib.db import get_db_connection
from lib.jurisdictions import VALID_JURISDICTIONS_LOWER


def _translate_for_postgres(pattern: str) -> str:
    r"""Translate Python regex syntax to PostgreSQL ARE (Advanced Regular Expression).

    PostgreSQL POSIX regex uses \y for word boundaries instead of Python's \b.
    Other common Python regex features (\d, \s, (?:...)) are natively supported
    by PostgreSQL ARE. Lookaheads/lookbehinds are NOT supported in PostgreSQL.
    """
    return pattern.replace(r'\b', r'\y')


def _combine_patterns_for_postgres(patterns: list[str]) -> str | None:
    """Combine regex patterns into a single PostgreSQL regex alternation.

    Returns None if the pattern list is empty.
    """
    if not patterns:
        return None
    return "|".join(f"({_translate_for_postgres(p)})" for p in patterns)


def _combine_patterns(issue_type: str) -> str:
    """Combine an issue type's inclusion patterns for PostgreSQL."""
    config = ISSUE_TYPES[issue_type]
    return _combine_patterns_for_postgres(config.patterns) or ""


def _combine_exclusion_patterns(issue_type: str) -> str | None:
    """Combine an issue type's exclusion patterns for PostgreSQL. None if empty."""
    config = ISSUE_TYPES[issue_type]
    return _combine_patterns_for_postgres(config.exclusion_patterns)


def _find_matches_in_db(conn, state_config, issue_type, tag=None, limit=None):
    """Find matching document IDs using PostgreSQL regex (no content transfer).

    Returns list of (id, title, url) tuples.
    """
    config = ISSUE_TYPES[issue_type]
    combined_pattern = _combine_patterns(issue_type)
    exclusion_pattern = _combine_exclusion_patterns(issue_type)
    prefix = state_config.citation_prefix
    state_code = state_config.state_code

    tag_join = ""
    tag_param = []
    if tag:
        tag_join = "JOIN document_tags dt ON dt.document_id = rd.id AND dt.tag = %s"
        tag_param = [tag]

    exclusion_clause = ""
    exclusion_param = []
    if exclusion_pattern:
        exclusion_clause = "AND rd.content !~* %s"
        exclusion_param = [exclusion_pattern]

    limit_clause = ""
    limit_param = []
    if limit:
        limit_clause = "LIMIT %s"
        limit_param = [limit]

    query = f"""
        SELECT rd.id, rd.title, rd.url
        FROM regulatory_documents rd
        {tag_join}
        WHERE rd.jurisdiction = %s
          AND rd.type = 'regulation'
          AND rd.content IS NOT NULL
          AND (rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)
          AND rd.content ~* %s
          {exclusion_clause}
          AND NOT EXISTS (
              SELECT 1 FROM compliance_issues ci
              WHERE ci.document_id = rd.id
                AND ci.issue_type = %s
                AND ci.jurisdiction = %s
          )
        ORDER BY rd.id
        {limit_clause}
    """
    params = tag_param + [state_code, combined_pattern] + exclusion_param + [config.db_issue_type, state_code] + limit_param
    return conn.execute(query, params).fetchall()


def _fetch_content_batch(conn, doc_ids):
    """Fetch content for a batch of document IDs."""
    if not doc_ids:
        return {}
    placeholders = ",".join(["%s"] * len(doc_ids))
    rows = conn.execute(
        f"SELECT id, content FROM regulatory_documents WHERE id IN ({placeholders})",
        list(doc_ids),
    ).fetchall()
    return {row[0]: row[1] for row in rows}


def _extract_context(content, patterns):
    """Find first regex match in content and return surrounding context."""
    for pattern in patterns:
        match_obj = pattern.search(content)
        if match_obj:
            start = max(0, match_obj.start() - 300)
            end = min(len(content), match_obj.end() + 300)
            return content[start:end].strip(), pattern.pattern
    return content[:600], None


def scan_and_save(state_code: str, issues: list[str], limit: int | None, tag: str | None):
    """Scan for regex matches and save to database."""
    state_config = STATES[state_code]

    print("\n" + "=" * 70)
    print(f"COMPLIANCE ISSUES SCANNER - {state_code.upper()}")
    print("=" * 70)
    print(f"Issue types: {len(issues)}")
    if tag:
        print(f"Tag filter: {tag}")
    print("Mode: Regex scan + save (no LLM)")

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    t0 = time.time()
    total_saved = 0
    total_matches = 0

    for i, issue_type in enumerate(issues):
        config = ISSUE_TYPES[issue_type]
        t_issue = time.time()

        # Phase 1: Find matching doc IDs in PostgreSQL (no content transfer)
        rows = _find_matches_in_db(conn, state_config, issue_type, tag, limit)
        conn.commit()

        if not rows:
            continue

        match_count = len(rows)
        total_matches += match_count

        # Phase 2: Fetch content only for matching docs
        doc_ids = [row[0] for row in rows]
        content_map = _fetch_content_batch(conn, doc_ids)

        # Phase 3: Extract context and save
        compiled = config.compiled_patterns
        saved = 0
        errors = 0
        for doc_id, title, url in rows:
            content = content_map.get(doc_id)
            if not content:
                continue

            context, term_matched = _extract_context(content, compiled)

            try:
                conn.execute("SAVEPOINT sp")
                conn.execute(
                    """
                    INSERT INTO compliance_issues
                    (document_id, issue_type, occurrence_number,
                     regex_match_pattern, regex_match_context, url, jurisdiction)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (doc_id, config.db_issue_type, 1, term_matched, context, url or '', state_config.state_code),
                )
                conn.execute("RELEASE SAVEPOINT sp")
                saved += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Error saving {issue_type} (doc {doc_id}): {e}")
                try:
                    conn.execute("ROLLBACK TO SAVEPOINT sp")
                except Exception:
                    pass

        conn.commit()
        if errors > 3:
            print(f"  ... and {errors - 3} more error(s) for {issue_type}")
        total_saved += saved
        elapsed_issue = time.time() - t_issue
        print(f"  [{i+1}/{len(issues)}] {issue_type}: {match_count} matches, {saved} saved ({elapsed_issue:.1f}s)")

    conn.close()
    elapsed = time.time() - t0

    print("\n" + "=" * 70)
    print(f"TOTAL: {total_saved} regex matches saved ({elapsed:.1f}s)")
    print(f"\nNext step: Run the research pipeline for LLM analysis:")
    print(f"  python -m scripts.research_pipeline.cli --state {state_code} --all-issues --execute")


def dry_run(state_code: str, issues: list[str], limit: int | None, tag: str | None):
    """Search only, no save."""
    state_config = STATES[state_code]

    print("\n" + "=" * 70)
    print(f"DRY RUN - {state_code.upper()}")
    if tag:
        print(f"Tag filter: {tag}")
    print("=" * 70)

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    t0 = time.time()
    total = 0

    for issue_type in issues:
        config = ISSUE_TYPES[issue_type]
        combined_pattern = _combine_patterns(issue_type)
        exclusion_pattern = _combine_exclusion_patterns(issue_type)

        # Count matches in PostgreSQL — no content transfer at all
        tag_join = ""
        tag_param = []
        if tag:
            tag_join = "JOIN document_tags dt ON dt.document_id = rd.id AND dt.tag = %s"
            tag_param = [tag]

        exclusion_clause = ""
        exclusion_param = []
        if exclusion_pattern:
            exclusion_clause = "AND rd.content !~* %s"
            exclusion_param = [exclusion_pattern]

        query = f"""
            SELECT COUNT(*)
            FROM regulatory_documents rd
            {tag_join}
            WHERE rd.jurisdiction = %s
              AND rd.type = 'regulation'
              AND rd.content IS NOT NULL
              AND (rd.exclude_from_analysis = FALSE OR rd.exclude_from_analysis IS NULL)
              AND rd.content ~* %s
              {exclusion_clause}
              AND NOT EXISTS (
                  SELECT 1 FROM compliance_issues ci
                  WHERE ci.document_id = rd.id
                    AND ci.issue_type = %s
                    AND ci.jurisdiction = %s
              )
        """
        params = tag_param + [state_config.state_code, combined_pattern] + exclusion_param + [config.db_issue_type, state_config.state_code]
        count = conn.execute(query, params).fetchone()[0]
        conn.commit()

        if count:
            print(f"  {issue_type}: {count} matches")
            total += count

    conn.close()
    elapsed = time.time() - t0
    print(f"\nTotal: {total} matches across {len(issues)} issue types ({elapsed:.1f}s)")


def main():
    parser = argparse.ArgumentParser(
        description='Scan regulations for compliance issues (regex only)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument('--state', '-s', choices=VALID_JURISDICTIONS_LOWER, help='State to scan')
    parser.add_argument('--issue', '-i', help='Specific issue type (default: all)')
    parser.add_argument('--tag', '-t', help='Only scan documents with this tag (e.g., scan:compliance)')
    parser.add_argument('--limit', '-l', type=int, help='Limit matches per issue type')
    parser.add_argument('--dry-run', action='store_true', help='Search only, no save')
    parser.add_argument('--list-issues', action='store_true', help='List issue types')

    args = parser.parse_args()

    if args.list_issues:
        list_issue_types()
        return

    if not args.state:
        parser.error("--state required (or use --list-issues)")

    if args.issue:
        if args.issue not in ISSUE_TYPES:
            print(f"Unknown issue: {args.issue}")
            sys.exit(1)
        issues = [args.issue]
    else:
        issues = sorted(ISSUE_TYPES.keys())

    if args.dry_run:
        dry_run(args.state, issues, args.limit, args.tag)
    else:
        scan_and_save(args.state, issues, args.limit, args.tag)


if __name__ == '__main__':
    main()
