"""Re-resolve unresolved guidance cross-references against the current DB.

Lightweight alternative to full re-extraction: just re-checks unresolved
cross_references against the current guidance_documents table and updates
any that now match.
"""

import time
from typing import Optional

from dotenv import load_dotenv
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from lib.db import get_db_connection
from scripts.guidance_pipeline.content_cross_refs import (
    _build_guidance_lookup,
    _resolve_guidance_ref,
)
from scripts.cross_references.patterns import extract_all_matches, RefType


def re_resolve_guidance_refs(dry_run: bool = True) -> None:
    """Re-resolve unresolved guidance cross-references.

    Fetches all unresolved guidance refs from cross_references,
    attempts to resolve them against the current guidance_documents,
    and updates any that now match.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        # Build current guidance lookup
        print("Building guidance lookup...")
        guidance_lookup, latest_revision_lookup = _build_guidance_lookup(cur)
        print(f"  {len(guidance_lookup)} canonical_refs, {len(latest_revision_lookup)} with revisions")

        # Fetch all unresolved guidance refs
        cur.execute("""
            SELECT id, normalized_citation
            FROM cross_references
            WHERE ref_type = 'guidance'
              AND is_resolved = false
        """)
        unresolved = cur.fetchall()
        print(f"  {len(unresolved)} unresolved guidance cross-references")

        if not unresolved:
            print("Nothing to re-resolve.")
            return

        # Try to resolve each one
        resolved_count = 0
        resolved_updates: list[tuple[int, int]] = []  # (cross_ref_id, guidance_id)

        for ref_id, normalized in unresolved:
            # Try direct match first
            if normalized in guidance_lookup:
                resolved_updates.append((ref_id, guidance_lookup[normalized]))
                resolved_count += 1
                continue

            # Try reverse revision (base -> latest revision)
            if normalized in latest_revision_lookup:
                resolved_updates.append((ref_id, latest_revision_lookup[normalized]))
                resolved_count += 1
                continue

            # Try to re-parse and resolve with agency expansion
            # Parse the normalized citation to get components
            matches = extract_all_matches(normalized)
            for match in matches:
                if match.ref_type == RefType.GUIDANCE:
                    target_id = _resolve_guidance_ref(
                        match.normalized, match.components, guidance_lookup,
                        latest_revision_lookup,
                    )
                    if target_id:
                        resolved_updates.append((ref_id, target_id))
                        resolved_count += 1
                        break

        print(f"\n  Newly resolvable: {resolved_count}/{len(unresolved)} "
              f"({100 * resolved_count / len(unresolved):.1f}%)")

        if dry_run:
            print("\n[DRY RUN] Would update these cross-references.")
            # Show sample
            for ref_id, gid in resolved_updates[:20]:
                cur.execute("SELECT normalized_citation FROM cross_references WHERE id = %s", (ref_id,))
                citation = cur.fetchone()[0]
                cur.execute("SELECT canonical_ref, title FROM guidance_documents WHERE id = %s", (gid,))
                row = cur.fetchone()
                print(f"    {citation} -> {row[0]} ({row[1][:50]})")
            if len(resolved_updates) > 20:
                print(f"    ... and {len(resolved_updates) - 20} more")
            return

        # Apply updates
        print(f"\nUpdating {resolved_count} cross-references...")
        start = time.time()
        for i, (ref_id, gid) in enumerate(resolved_updates):
            cur.execute("""
                UPDATE cross_references
                SET target_guidance_id = %s,
                    is_resolved = true
                WHERE id = %s
            """, (gid, ref_id))
            if (i + 1) % 100 == 0:
                conn.commit()
                print(f"  Updated {i + 1}/{resolved_count}...")

        conn.commit()
        elapsed = time.time() - start
        print(f"  Done in {elapsed:.1f}s")

        # Report final state
        cur.execute("""
            SELECT is_resolved, count(*)
            FROM cross_references
            WHERE ref_type = 'guidance'
            GROUP BY is_resolved
        """)
        print("\nFinal guidance cross-ref resolution:")
        for row in cur.fetchall():
            print(f"  resolved={row[0]}: {row[1]}")

    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    dry_run = "--execute" not in sys.argv
    re_resolve_guidance_refs(dry_run=dry_run)
