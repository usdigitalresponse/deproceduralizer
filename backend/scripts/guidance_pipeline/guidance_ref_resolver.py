"""Resolve guidance-to-guidance references (cites_documents → guidance_documents).

The cites_documents array contains references like '90 ADM-31', '23-OCFS-LCM-12',
or 'TSB-M-12(12)S'. These need to be matched to canonical_ref values like
'90-OTDA-ADM-31', '23-OCFS-LCM-12', or 'TSB-M-12(12)S'.

Two strategies:
1. Direct match: ref == canonical_ref (already 21% match rate)
2. Normalized match: short-format refs like '90 ADM-31' → try all agencies
   that produce that doc_type (e.g., OTDA, OCFS) to match '90-OTDA-ADM-31'
"""

import re
import time

from lib.db import get_db_connection

# Map doc types to known agencies that produce them
DOC_TYPE_AGENCIES = {
    "ADM": ["OTDA", "OCFS"],
    "LCM": ["OTDA", "OCFS"],
    "INF": ["OTDA", "OCFS"],
    "GIS": [],  # GIS uses different format: GIS-20-MA/10
}

# Pattern for short-format refs: "90 ADM-31", "04 INF-22", "00 LCM-20"
SHORT_FORMAT = re.compile(r"^(\d{2})\s+(ADM|LCM|INF|GIS)-(.+)$", re.IGNORECASE)

# Pattern for agency-prefixed refs: "23-OCFS-ADM-15", "07-OCFS-LCM-12"
AGENCY_FORMAT = re.compile(r"^(\d{2})-(\w+)-(ADM|LCM|INF|GIS)-(.+)$", re.IGNORECASE)

# Pattern for TSB-M refs: "TSB-M-12(12)S"
TSBM_FORMAT = re.compile(r"^TSB-M-", re.IGNORECASE)


def _build_canonical_lookup(cur) -> dict[str, int]:
    """Build a lookup from canonical_ref → guidance_documents.id."""
    cur.execute(
        "SELECT id, canonical_ref FROM guidance_documents WHERE canonical_ref IS NOT NULL"
    )
    return {row[1]: row[0] for row in cur.fetchall()}


def _normalize_ref(ref: str) -> list[str]:
    """Generate candidate canonical_ref values for a given reference string.

    Returns a list of candidates to try, most specific first.
    """
    candidates = [ref]  # always try direct match first

    # Short format: "90 ADM-31" → try "90-OTDA-ADM-31", "90-OCFS-ADM-31"
    m = SHORT_FORMAT.match(ref)
    if m:
        year, doc_type, num = m.group(1), m.group(2).upper(), m.group(3)
        agencies = DOC_TYPE_AGENCIES.get(doc_type, [])
        for agency in agencies:
            candidates.append(f"{year}-{agency}-{doc_type}-{num}")
            # Also try zero-padded and non-zero-padded number variants
            if num.lstrip("0") != num and num.lstrip("0"):
                candidates.append(f"{year}-{agency}-{doc_type}-{num.lstrip('0')}")
            if len(num) == 1:
                candidates.append(f"{year}-{agency}-{doc_type}-0{num}")
        return candidates

    # TSB-M: direct match is usually sufficient
    if TSBM_FORMAT.match(ref):
        return candidates

    return candidates


def resolve_guidance_refs(dry_run: bool = True) -> None:
    """Resolve cites_documents references to guidance_documents rows.

    Reports match statistics and optionally updates the database.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        # Build canonical_ref lookup
        canonical_lookup = _build_canonical_lookup(cur)
        print(f"Loaded {len(canonical_lookup)} canonical_ref entries")

        # Fetch all docs with cites_documents
        cur.execute(
            """
            SELECT id, canonical_ref, doc_type, agency, cites_documents
            FROM guidance_documents
            WHERE cites_documents IS NOT NULL
              AND array_length(cites_documents, 1) > 0
            """
        )
        docs = cur.fetchall()
        print(f"Found {len(docs)} docs with cites_documents")

        # Collect all unique refs
        all_refs: dict[str, list[int]] = {}  # ref → list of source doc IDs
        for doc_id, _, _, _, cites in docs:
            for ref in cites:
                all_refs.setdefault(ref, []).append(doc_id)

        print(f"Total unique references: {len(all_refs)}")

        # Try to resolve each
        resolved: dict[str, int] = {}  # ref → target guidance_documents.id
        unresolved: list[str] = []

        for ref in all_refs:
            candidates = _normalize_ref(ref)
            target_id = None
            for candidate in candidates:
                if candidate in canonical_lookup:
                    target_id = canonical_lookup[candidate]
                    break

            if target_id:
                resolved[ref] = target_id
            else:
                unresolved.append(ref)

        total_ref_instances = sum(len(v) for v in all_refs.values())
        resolved_instances = sum(len(all_refs[ref]) for ref in resolved)
        print(f"\nResolution results:")
        print(f"  Unique refs resolved: {len(resolved)}/{len(all_refs)} ({100 * len(resolved) / len(all_refs):.1f}%)")
        print(f"  Ref instances resolved: {resolved_instances}/{total_ref_instances} ({100 * resolved_instances / total_ref_instances:.1f}%)")

        # Break down unresolved by apparent type
        type_counts: dict[str, int] = {}
        for ref in unresolved:
            if SHORT_FORMAT.match(ref):
                m = SHORT_FORMAT.match(ref)
                dtype = m.group(2).upper()
                type_counts[f"short-{dtype}"] = type_counts.get(f"short-{dtype}", 0) + 1
            elif AGENCY_FORMAT.match(ref):
                type_counts["agency-prefixed"] = type_counts.get("agency-prefixed", 0) + 1
            elif TSBM_FORMAT.match(ref):
                type_counts["TSB-M"] = type_counts.get("TSB-M", 0) + 1
            else:
                type_counts["other"] = type_counts.get("other", 0) + 1

        print(f"\n  Unresolved by type:")
        for t, cnt in sorted(type_counts.items(), key=lambda x: -x[1]):
            print(f"    {t:<25} {cnt:>5}")

        # Sample unresolved
        print(f"\n  Sample unresolved refs:")
        for ref in sorted(unresolved)[:15]:
            candidates = _normalize_ref(ref)
            print(f"    {ref:<35} tried: {candidates[:3]}")

        if dry_run:
            print("\n(dry run — use --execute to write cross_references)")
            return

        # Write cross_references rows
        print("\nWriting cross_references...")
        start = time.time()
        written = 0

        for doc_id, canonical_ref, doc_type, agency, cites in docs:
            for ref in cites:
                target_id = resolved.get(ref)
                cur.execute(
                    """
                    INSERT INTO cross_references
                    (source_guidance_id, ref_type, raw_text, normalized_citation,
                     target_guidance_id, is_resolved, jurisdiction,
                     source_jurisdiction, target_jurisdiction)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (
                        doc_id,
                        "guidance",
                        ref,
                        ref,
                        target_id,
                        target_id is not None,
                        "NY",
                        "NY",
                        "NY" if target_id else None,
                    ),
                )
                written += 1

            if written % 1000 == 0:
                conn.commit()
                elapsed = time.time() - start
                print(f"  Written {written}/{total_ref_instances}, {elapsed:.0f}s elapsed")

        conn.commit()
        print(f"\nDone. Wrote {written} cross_references ({len(resolved)} resolved, {len(unresolved)} unresolved).")

    finally:
        conn.close()
