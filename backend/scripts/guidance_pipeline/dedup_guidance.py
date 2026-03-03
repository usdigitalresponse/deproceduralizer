"""Deduplicate guidance_documents rows that share the same text_path.

The OCFS-new import used Python's non-deterministic hash() for catalog_id,
so each import run created new rows instead of upserting. This script:
1. Groups duplicates by text_path
2. Picks the "best" row per group (most metadata, correct status, lowest ID)
3. Reassigns FK references from duplicate IDs to the keeper
4. Deletes duplicate rows

Dry-run by default. Pass --execute to apply changes.
"""

import argparse
import sys
from pathlib import Path

# Add backend/ to path so we can import lib
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from lib.db import get_db_connection


def find_duplicate_groups(cur) -> list[dict]:
    """Find text_path values with more than one row."""
    cur.execute("""
        SELECT text_path, array_agg(id ORDER BY id) AS ids
        FROM guidance_documents
        WHERE text_path IS NOT NULL
        GROUP BY text_path
        HAVING COUNT(*) > 1
    """)
    return [{"text_path": row[0], "ids": row[1]} for row in cur.fetchall()]


def pick_keeper(cur, ids: list[int]) -> int:
    """Pick the best row from a group of duplicates.

    Scoring: prefer rows with more supersedure metadata populated,
    correct status (active > superseded > others), and lowest ID as tiebreaker.
    """
    placeholders = ",".join(["%s"] * len(ids))
    cur.execute(f"""
        SELECT id,
            -- Score: count of non-null supersedure-related fields
            (CASE WHEN canonical_ref IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN supersedes IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN superseded_by IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN revision_of IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN status = 'active' THEN 2
                    WHEN status = 'superseded' THEN 1
                    ELSE 0 END
            ) AS score
        FROM guidance_documents
        WHERE id IN ({placeholders})
        ORDER BY score DESC, id ASC
        LIMIT 1
    """, ids)
    return cur.fetchone()[0]


def _column_exists(cur, table: str, column: str) -> bool:
    """Check if a column exists in a table."""
    cur.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
    """, [table, column])
    return cur.fetchone() is not None


def get_active_fk_tables(cur) -> list[tuple[str, str]]:
    """Return only FK_TABLES entries where the column actually exists."""
    return [(t, c) for t, c in FK_TABLES if _column_exists(cur, t, c)]


def count_fk_references(cur, ids: list[int], active_fks: list[tuple[str, str]]) -> dict[str, int]:
    """Count FK references pointing to any of the given IDs."""
    placeholders = ",".join(["%s"] * len(ids))
    counts = {}

    for table, col in active_fks:
        cur.execute(
            f"SELECT COUNT(*) FROM {table} WHERE {col} IN ({placeholders})",
            ids,
        )
        counts[f"{table}.{col}"] = cur.fetchone()[0]

    return counts


# FK references to reassign: (table, column)
FK_TABLES = [
    ("compliance_issues", "guidance_document_id"),
    ("compliance_issue_analyses", "guidance_document_id"),
    ("cross_references", "source_guidance_id"),
    ("cross_references", "target_guidance_id"),
]


def reassign_fks(cur, duplicate_ids: list[int], keeper_id: int, active_fks: list[tuple[str, str]]) -> dict[str, int]:
    """Reassign or delete FK references from duplicate IDs to keeper ID.

    Three behaviors depending on the FK table:
    - compliance_issues: DELETE (keeper already has its own regex scan results;
      UPDATEing would hit the unique constraint on (guidance_document_id, issue_type, ...))
    - compliance_issue_analyses: DELETE (keeper already has its own analyses;
      UPDATEing would hit the partial unique indexes from migration 0058)
    - cross_references: UPDATE to keeper (no conflicting unique constraint)

    Returns dict of affected row counts.
    """
    placeholders = ",".join(["%s"] * len(duplicate_ids))
    counts = {}

    for table, col in active_fks:
        if table in ("compliance_issues", "compliance_issue_analyses"):
            # Delete rows pointing to duplicates — the keeper already has
            # its own rows, so UPDATE would violate unique constraints.
            cur.execute(
                f"DELETE FROM {table} WHERE {col} IN ({placeholders})",
                duplicate_ids,
            )
            counts[f"{table}.{col}"] = cur.rowcount
        else:
            cur.execute(
                f"UPDATE {table} SET {col} = %s WHERE {col} IN ({placeholders})",
                [keeper_id] + duplicate_ids,
            )
            counts[f"{table}.{col}"] = cur.rowcount

    return counts


def delete_duplicates(cur, duplicate_ids: list[int]) -> int:
    """Delete duplicate rows."""
    placeholders = ",".join(["%s"] * len(duplicate_ids))
    cur.execute(
        f"DELETE FROM guidance_documents WHERE id IN ({placeholders})",
        duplicate_ids,
    )
    return cur.rowcount


def run_dedup(execute: bool = False) -> None:
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        sys.exit(1)

    try:
        cur = conn.cursor()

        # Get total row count for context
        cur.execute("SELECT COUNT(*) FROM guidance_documents")
        total_rows = cur.fetchone()[0]

        groups = find_duplicate_groups(cur)
        if not groups:
            print("No duplicates found.")
            return

        total_dupes = sum(len(g["ids"]) - 1 for g in groups)
        print(f"Found {len(groups)} duplicate groups ({total_dupes} duplicate rows out of {total_rows} total)")

        # Detect which FK columns actually exist in the DB
        active_fks = get_active_fk_tables(cur)
        skipped_fks = [(t, c) for t, c in FK_TABLES if (t, c) not in active_fks]
        if skipped_fks:
            print(f"  Note: skipping FK columns not yet in DB: {skipped_fks}")

        # Process each group
        total_fk_reassigned = {}
        total_deleted = 0
        keepers = []

        for i, group in enumerate(groups):
            keeper_id = pick_keeper(cur, group["ids"])
            duplicate_ids = [id_ for id_ in group["ids"] if id_ != keeper_id]
            keepers.append(keeper_id)

            if execute:
                fk_counts = reassign_fks(cur, duplicate_ids, keeper_id, active_fks)
                deleted = delete_duplicates(cur, duplicate_ids)
                total_deleted += deleted

                for key, count in fk_counts.items():
                    total_fk_reassigned[key] = total_fk_reassigned.get(key, 0) + count

                if (i + 1) % 100 == 0:
                    print(f"  Processed {i + 1}/{len(groups)} groups...")
            else:
                # Dry-run: just count FK references
                fk_counts = count_fk_references(cur, duplicate_ids, active_fks)
                for key, count in fk_counts.items():
                    total_fk_reassigned[key] = total_fk_reassigned.get(key, 0) + count

        if execute:
            conn.commit()

        # Summary
        mode = "EXECUTED" if execute else "DRY RUN"
        print(f"\n[{mode}] Summary:")
        print(f"  Duplicate groups: {len(groups)}")
        print(f"  Rows {'deleted' if execute else 'to delete'}: {total_dupes}")
        if execute:
            print(f"  Rows actually deleted: {total_deleted}")
        print(f"  FK references {'reassigned' if execute else 'to reassign'}:")
        for key, count in sorted(total_fk_reassigned.items()):
            if count > 0:
                print(f"    {key}: {count}")
        if not any(total_fk_reassigned.values()):
            print(f"    (none)")

        if not execute:
            print(f"\nRe-run with --execute to apply changes.")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Deduplicate guidance_documents rows sharing the same text_path"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually apply changes (default is dry-run)",
    )
    args = parser.parse_args()

    run_dedup(execute=args.execute)


if __name__ == "__main__":
    main()
