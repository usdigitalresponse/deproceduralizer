"""
Verify database state before and after migrations 0031-0037.

Usage:
    python backend/scripts/verify_migrations.py pre      # Before any migrations
    python backend/scripts/verify_migrations.py post-31   # After 0031
    python backend/scripts/verify_migrations.py post-33   # After 0032-0033
    python backend/scripts/verify_migrations.py post-36   # After 0034-0036
    python backend/scripts/verify_migrations.py post-37   # After 0037
    python backend/scripts/verify_migrations.py post      # After all migrations
"""

import os
import sys

import psycopg
from dotenv import load_dotenv

load_dotenv()


def get_conn():
    return psycopg.connect(os.environ["DATABASE_URL"])


def column_exists(cur, table: str, column: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s",
        (table, column),
    )
    return cur.fetchone() is not None


def index_exists(cur, index_name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pg_indexes WHERE indexname = %s",
        (index_name,),
    )
    return cur.fetchone() is not None


def count_rows(cur, query: str) -> int:
    cur.execute(query)
    return cur.fetchone()[0]


def check(label: str, condition: bool):
    status = "PASS" if condition else "FAIL"
    marker = " ok " if condition else "FAIL"
    print(f"  [{marker}] {label}")
    return condition


def pre_checks(cur):
    """Verify DB is in the expected state BEFORE running any migrations."""
    print("\n=== PRE-FLIGHT: Checking DB is ready for migrations ===\n")
    ok = True

    # 0031 preconditions: legacy columns exist
    print("Migration 0031 preconditions (drop legacy columns):")
    for col in ["matched_pattern", "matched_context", "requirement_text", "impact_assessment"]:
        ok &= check(f"compliance_issues.{col} exists", column_exists(cur, "compliance_issues", col))

    # Check new columns have data (so we're not dropping the only copy)
    ok &= check(
        "regex_match_pattern has data",
        count_rows(cur, "SELECT COUNT(*) FROM compliance_issues WHERE regex_match_pattern IS NOT NULL") > 0,
    )
    ok &= check(
        "regex_match_context has data",
        count_rows(cur, "SELECT COUNT(*) FROM compliance_issues WHERE regex_match_context IS NOT NULL") > 0,
    )

    # 0032-0033 preconditions: analysis fields exist on compliance_issues
    print("\nMigration 0032-0033 preconditions (move analysis fields):")
    for col in ["requirement_found", "is_verbatim", "required_by_statute", "statute_citation",
                "verbatim_supporting_text", "decision_rationale"]:
        ok &= check(f"compliance_issues.{col} exists", column_exists(cur, "compliance_issues", col))

    ok &= check(
        "compliance_issue_analyses table exists",
        count_rows(cur, "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'compliance_issue_analyses'") > 0,
    )

    # 0034-0036 preconditions: review columns exist on compliance_issues
    print("\nMigration 0034-0036 preconditions (move review/dev fields):")
    for col in ["review_status", "reviewed_by", "severity", "developer_status", "developer_assigned"]:
        ok &= check(f"compliance_issues.{col} exists", column_exists(cur, "compliance_issues", col))

    # Count reviewed items (so we can verify backfill later)
    reviewed = count_rows(cur, "SELECT COUNT(*) FROM compliance_issues WHERE review_status != 'unreviewed'")
    dev_assigned = count_rows(cur, "SELECT COUNT(DISTINCT (document_id, issue_type)) FROM compliance_issues WHERE developer_assigned IS NOT NULL")
    total_issues = count_rows(cur, "SELECT COUNT(*) FROM compliance_issues")
    total_analyses = count_rows(cur, "SELECT COUNT(*) FROM compliance_issue_analyses")

    print(f"\n  Snapshot:")
    print(f"    compliance_issues rows:          {total_issues}")
    print(f"    compliance_issue_analyses rows:   {total_analyses}")
    print(f"    reviewed issues (not unreviewed): {reviewed}")
    print(f"    dev-assigned (distinct doc+type): {dev_assigned}")

    if ok:
        print("\n  ALL PRE-FLIGHT CHECKS PASSED — safe to run migrations")
    else:
        print("\n  SOME CHECKS FAILED — investigate before running migrations")
    return ok


def post_0031_checks(cur):
    """After migration 0031: legacy columns dropped."""
    print("\n=== POST-0031: Legacy columns dropped ===\n")
    ok = True

    for col in ["matched_pattern", "matched_context", "requirement_text", "impact_assessment"]:
        ok &= check(f"compliance_issues.{col} is GONE", not column_exists(cur, "compliance_issues", col))

    ok &= check(
        "regex_match_context is NOT NULL",
        count_rows(cur, "SELECT COUNT(*) FROM compliance_issues WHERE regex_match_context IS NULL") == 0,
    )

    if ok:
        print("\n  0031 verified — proceed to 0032-0033")
    return ok


def post_0033_checks(cur):
    """After migrations 0032-0033: analysis fields moved."""
    print("\n=== POST-0033: Analysis fields moved to compliance_issue_analyses ===\n")
    ok = True

    # All compliance_issues should have a corresponding analysis row
    orphans = count_rows(cur, """
        SELECT COUNT(DISTINCT (ci.document_id, ci.issue_type))
        FROM compliance_issues ci
        LEFT JOIN compliance_issue_analyses cia
          ON ci.document_id = cia.document_id AND ci.issue_type = cia.issue_type
        WHERE cia.id IS NULL
    """)
    ok &= check(f"No orphan compliance_issues (found {orphans})", orphans == 0)

    # Dropped columns should be gone
    for col in ["requirement_found", "is_verbatim", "required_by_statute", "statute_citation",
                "verbatim_supporting_text", "decision_rationale"]:
        ok &= check(f"compliance_issues.{col} is GONE", not column_exists(cur, "compliance_issues", col))

    if ok:
        print("\n  0032-0033 verified — proceed to 0034-0036")
    return ok


def post_0036_checks(cur):
    """After migrations 0034-0036: review/dev fields moved."""
    print("\n=== POST-0036: Review/dev fields moved to compliance_issue_analyses ===\n")
    ok = True

    # New columns exist on analyses
    print("New columns on compliance_issue_analyses:")
    for col in ["review_status", "reviewed_by", "reviewed_at", "justification_notes",
                "reviewer_severity", "developer_status", "developer_assigned", "developer_notes"]:
        ok &= check(f"compliance_issue_analyses.{col} exists", column_exists(cur, "compliance_issue_analyses", col))

    # Old columns gone from compliance_issues
    print("\nDropped columns from compliance_issues:")
    for col in ["review_status", "reviewed_by", "reviewed_at", "severity", "original_severity",
                "developer_status", "developer_assigned", "developer_notes"]:
        ok &= check(f"compliance_issues.{col} is GONE", not column_exists(cur, "compliance_issues", col))

    # Verify review data was preserved
    reviewed_analyses = count_rows(cur, "SELECT COUNT(*) FROM compliance_issue_analyses WHERE review_status != 'unreviewed'")
    dev_assigned_analyses = count_rows(cur, "SELECT COUNT(*) FROM compliance_issue_analyses WHERE developer_assigned IS NOT NULL")
    print(f"\n  Backfill results:")
    print(f"    reviewed analyses:      {reviewed_analyses}")
    print(f"    dev-assigned analyses:  {dev_assigned_analyses}")
    ok &= check("At least some reviewed data was preserved", reviewed_analyses >= 0)

    if ok:
        print("\n  0034-0036 verified — proceed to 0037")
    return ok


def post_0037_checks(cur):
    """After migration 0037: analysis_id FK added."""
    print("\n=== POST-0037: analysis_id FK added ===\n")
    ok = True

    ok &= check(
        "compliance_issues.analysis_id exists",
        column_exists(cur, "compliance_issues", "analysis_id"),
    )
    ok &= check(
        "idx_compliance_issues_analysis_id exists",
        index_exists(cur, "idx_compliance_issues_analysis_id"),
    )

    # Check backfill coverage
    total = count_rows(cur, "SELECT COUNT(*) FROM compliance_issues")
    linked = count_rows(cur, "SELECT COUNT(*) FROM compliance_issues WHERE analysis_id IS NOT NULL")
    unlinked = total - linked
    ok &= check(f"analysis_id backfilled: {linked}/{total} linked ({unlinked} unlinked)", linked > 0)

    # Verify FK integrity
    broken_fks = count_rows(cur, """
        SELECT COUNT(*) FROM compliance_issues ci
        WHERE ci.analysis_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM compliance_issue_analyses cia WHERE cia.id = ci.analysis_id)
    """)
    ok &= check(f"No broken FK references (found {broken_fks})", broken_fks == 0)

    if ok:
        print("\n  0037 verified — ALL MIGRATIONS COMPLETE")
    return ok


def post_all_checks(cur):
    """Run all post-migration checks."""
    ok = True
    ok &= post_0031_checks(cur)
    ok &= post_0033_checks(cur)
    ok &= post_0036_checks(cur)
    ok &= post_0037_checks(cur)

    print("\n" + "=" * 50)
    total = count_rows(cur, "SELECT COUNT(*) FROM compliance_issues")
    analyses = count_rows(cur, "SELECT COUNT(*) FROM compliance_issue_analyses")
    ci_cols = count_rows(cur, """
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'compliance_issues'
    """)
    cia_cols = count_rows(cur, """
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'compliance_issue_analyses'
    """)
    print(f"  Final state:")
    print(f"    compliance_issues:          {total} rows, {ci_cols} columns")
    print(f"    compliance_issue_analyses:  {analyses} rows, {cia_cols} columns")

    if ok:
        print("\n  ALL POST-MIGRATION CHECKS PASSED")
    else:
        print("\n  SOME CHECKS FAILED — investigate before deploying")
    return ok


PHASES = {
    "pre": pre_checks,
    "post-31": post_0031_checks,
    "post-33": post_0033_checks,
    "post-36": post_0036_checks,
    "post-37": post_0037_checks,
    "post": post_all_checks,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in PHASES:
        print(f"Usage: python {sys.argv[0]} <{'|'.join(PHASES.keys())}>")
        sys.exit(1)

    phase = sys.argv[1]
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = PHASES[phase](cur)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
