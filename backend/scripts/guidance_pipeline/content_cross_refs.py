"""Extract cross-references from guidance document content.

Scans guidance_documents.content for:
1. NYCRR citations (e.g., "18 NYCRR 430.12") -> resolves to regulatory_documents
2. Guidance-to-guidance refs (e.g., "23-OCFS-ADM-15") -> resolves to guidance_documents
3. Form numbers (e.g., "OCFS-5019", "LDSS-2999") -> unresolved, tracked for display
4. SSL references (e.g., "SSL § 366") -> unresolved, tracked for display
5. NY statute references (e.g., "PHL § 2803") -> unresolved, tracked for display

Extracts citations directly from document text content using the shared
regex pattern library (patterns.py), filtering to relevant reference types.
"""

import re
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from lib.db import get_db_connection
from scripts.cross_references.patterns import (
    extract_all_matches,
    RefType,
)


def _build_regulation_lookups(cur, state: str) -> tuple[dict[tuple, int], dict[tuple, list[int]]]:
    """Build section and part lookup dicts from regulatory_documents."""
    cur.execute(
        """
        SELECT id, nycrr_title, nycrr_part, nycrr_section
        FROM regulatory_documents
        WHERE jurisdiction = %s AND type = 'regulation'
          AND nycrr_section IS NOT NULL
        """,
        (state,),
    )
    section_lookup: dict[tuple, int] = {}
    part_lookup: dict[tuple, list[int]] = {}
    for row in cur.fetchall():
        db_id, title, part, section = row
        if title and section:
            section_lookup[(str(title), section)] = db_id
        if title and part:
            key = (str(title), str(part))
            part_lookup.setdefault(key, []).append(db_id)

    cur.execute(
        """
        SELECT id, nycrr_title, nycrr_part
        FROM regulatory_documents
        WHERE jurisdiction = %s AND type = 'regulation'
          AND nycrr_part IS NOT NULL
          AND nycrr_section IS NULL
        """,
        (state,),
    )
    for row in cur.fetchall():
        db_id, title, part = row
        if title and part:
            key = (str(title), str(part))
            part_lookup.setdefault(key, []).append(db_id)

    return section_lookup, part_lookup


def _resolve_nycrr_citation(
    title: str,
    section_base: str,
    section_lookup: dict,
    part_lookup: dict,
) -> Optional[int]:
    """Resolve a parsed NYCRR citation to a regulatory_documents ID."""
    # Try exact section match
    target = section_lookup.get((title, section_base))
    if target:
        return target

    # Try part-level match (strip decimal)
    part_match = re.match(r'(\d+(?:-\d+)?)', section_base)
    if part_match:
        part = part_match.group(1)
        part_matches = part_lookup.get((title, part), [])
        if part_matches:
            return part_matches[0]

    return None


def _build_guidance_lookup(cur) -> dict[str, int]:
    """Build canonical_ref -> guidance_documents.id lookup."""
    cur.execute(
        "SELECT id, canonical_ref FROM guidance_documents WHERE canonical_ref IS NOT NULL"
    )
    return {row[1]: row[0] for row in cur.fetchall()}


# Known agencies that produce each doc type (for short-format resolution)
DOC_TYPE_AGENCIES = {
    "ADM": ["OTDA", "OCFS"],
    "LCM": ["OTDA", "OCFS"],
    "INF": ["OTDA", "OCFS"],
}
# GIS excluded — Format 3 handles GIS directly with no agency ambiguity


def _zero_pad_ref_number(normalized: str) -> str:
    """Zero-pad the trailing number in a guidance ref to 2 digits.

    E.g., '99-OTDA-ADM-5' -> '99-OTDA-ADM-05'
         '99 ADM-5' -> '99 ADM-05'
    """
    m = re.match(r'^(.+[-\s])(\d+)$', normalized)
    if m and len(m.group(2)) == 1:
        return f"{m.group(1)}{m.group(2).zfill(2)}"
    return normalized


def _resolve_guidance_ref(
    normalized: str,
    components: dict,
    guidance_lookup: dict[str, int],
) -> Optional[int]:
    """Resolve a guidance reference to a guidance_documents.id."""
    # Try direct match
    if normalized in guidance_lookup:
        return guidance_lookup[normalized]

    # Try zero-padded variant (e.g., "99-OTDA-ADM-5" -> "99-OTDA-ADM-05")
    padded = _zero_pad_ref_number(normalized)
    if padded != normalized and padded in guidance_lookup:
        return guidance_lookup[padded]

    # Strip revision suffixes (-R1, -R2, etc.) and try base version
    revision_match = re.match(r'^(.+)-R\d+$', normalized)
    if revision_match:
        base_ref = revision_match.group(1)
        if base_ref in guidance_lookup:
            return guidance_lookup[base_ref]

    # For short-format refs ("90 ADM-31"), try agency-prefixed variants
    fmt = components.get('format')
    if fmt == 'short':
        year = components.get('year', '')
        doc_type = components.get('doc_type', '')
        number = components.get('number', '')
        padded_number = number.zfill(2)
        agencies = DOC_TYPE_AGENCIES.get(doc_type, [])
        for agency in agencies:
            candidate = f"{year}-{agency}-{doc_type}-{number}"
            if candidate in guidance_lookup:
                return guidance_lookup[candidate]
            # Try with zero-padded number (e.g., '5' -> '05')
            if padded_number != number:
                candidate_padded = f"{year}-{agency}-{doc_type}-{padded_number}"
                if candidate_padded in guidance_lookup:
                    return guidance_lookup[candidate_padded]
            # Try with leading zeros stripped (e.g., '06' -> '6')
            if number.lstrip("0") != number and number.lstrip("0"):
                candidate2 = f"{year}-{agency}-{doc_type}-{number.lstrip('0')}"
                if candidate2 in guidance_lookup:
                    return guidance_lookup[candidate2]

    # For TSB-M refs, the canonical_ref in the DB is already "TSB-M-YY(N)X"
    if fmt == 'tsb_m':
        number = components.get('number', '')
        year = components.get('year', '')
        tax_type = components.get('tax_type', '')
        # Try with leading zeros stripped (e.g., '06' -> '6')
        if number.lstrip("0") != number and number.lstrip("0"):
            stripped = f"TSB-M-{year}({number.lstrip('0')}){tax_type}"
            if stripped in guidance_lookup:
                return guidance_lookup[stripped]
        # Try with zero-padded number (e.g., '1' -> '01')
        padded_number = number.zfill(2)
        if padded_number != number:
            padded_tsb = f"TSB-M-{year}({padded_number}){tax_type}"
            if padded_tsb in guidance_lookup:
                return guidance_lookup[padded_tsb]

    return None


def extract_content_cross_refs(
    dry_run: bool = True,
    limit: Optional[int] = None,
    agency: Optional[str] = None,
    state: str = "NY",
) -> None:
    """Extract NYCRR and guidance refs from guidance document content.

    Scans guidance_documents.content using regex patterns and inserts
    resolved cross_references.

    Args:
        dry_run: If True, report stats without writing to DB.
        limit: Max docs to process.
        agency: Filter to specific agency.
        state: Jurisdiction code (default: "NY").
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()

        state_upper = state.upper()

        # Build lookups
        print("Building lookup caches...")
        section_lookup, part_lookup = _build_regulation_lookups(cur, state_upper)
        print(f"  Regulation lookups: {len(section_lookup)} sections, {len(part_lookup)} parts")

        guidance_lookup = _build_guidance_lookup(cur)
        print(f"  Guidance lookup: {len(guidance_lookup)} canonical_refs")

        # Fetch guidance docs with content
        conditions = [
            "content IS NOT NULL",
            "LENGTH(content) > 100",
        ]
        params: list = []

        if agency:
            conditions.append("agency = %s")
            params.append(agency)

        where = " AND ".join(conditions)
        limit_clause = ""
        if limit:
            limit_clause = "LIMIT %s"
            params.append(limit)

        cur.execute(
            f"""
            SELECT id, canonical_ref, agency, content
            FROM guidance_documents
            WHERE {where}
            ORDER BY id
            {limit_clause}
            """,
            params,
        )
        docs = cur.fetchall()
        print(f"\nProcessing {len(docs)} guidance documents...")

        # Ref types we extract from guidance content
        ACCEPTED_REF_TYPES = {
            RefType.NYCRR, RefType.GUIDANCE, RefType.FORM,
            RefType.SSL, RefType.NY_STATUTE,
        }

        # Stats per ref type
        stats: dict[str, dict[str, int]] = {}
        for rt in ACCEPTED_REF_TYPES:
            stats[rt.value] = {'total': 0, 'resolved': 0}
        docs_with_refs = 0
        docs_processed = 0
        docs_errored = 0
        start_time = time.time()

        # Batch: collect all rows to insert
        rows_to_insert: list[tuple] = []
        source_ids_to_clean: list[int] = []

        for doc_id, canonical_ref, doc_agency, content in docs:
            try:
                # Extract all matches from content
                matches = extract_all_matches(content)

                # Filter to accepted ref types
                accepted = [m for m in matches if m.ref_type in ACCEPTED_REF_TYPES]

                # Always add to cleanup list so stale refs are deleted on re-run
                source_ids_to_clean.append(doc_id)

                if not accepted:
                    docs_processed += 1
                    continue

                docs_with_refs += 1

                for m in accepted:
                    ref_type_str = m.ref_type.value
                    stats[ref_type_str]['total'] += 1

                    # Resolve based on ref type
                    target_doc_id = None
                    target_guidance_id = None
                    is_resolved = False

                    if m.ref_type == RefType.NYCRR:
                        title = m.components.get('title', '')
                        section_base = m.components.get('section_base', '')
                        target_doc_id = _resolve_nycrr_citation(
                            title, section_base, section_lookup, part_lookup
                        )
                        is_resolved = target_doc_id is not None

                    elif m.ref_type == RefType.GUIDANCE:
                        target_guidance_id = _resolve_guidance_ref(
                            m.normalized, m.components, guidance_lookup
                        )
                        is_resolved = target_guidance_id is not None
                        # Don't create self-references
                        if target_guidance_id == doc_id:
                            stats[ref_type_str]['total'] -= 1
                            continue

                    # FORM, SSL, NY_STATUTE: unresolved by default (no lookup target)

                    if is_resolved:
                        stats[ref_type_str]['resolved'] += 1

                    # Context
                    ctx_start = max(0, m.start - 50)
                    ctx_end = min(len(content), m.end + 50)
                    context_before = ' '.join(content[ctx_start:m.start].split())
                    context_after = ' '.join(content[m.end:ctx_end].split())

                    rows_to_insert.append((
                        doc_id,              # source_guidance_id
                        ref_type_str,        # ref_type
                        m.raw_text,          # raw_text
                        m.normalized,        # normalized_citation
                        m.start,             # start_offset
                        m.end,               # end_offset
                        context_before,
                        context_after,
                        target_doc_id,       # target_document_id
                        target_guidance_id,  # target_guidance_id
                        is_resolved,
                        state_upper,         # jurisdiction
                        state_upper,         # source_jurisdiction
                        state_upper if (target_doc_id or target_guidance_id) else None,
                    ))

                docs_processed += 1
                if docs_processed % 500 == 0:
                    elapsed = time.time() - start_time
                    rate = docs_processed / elapsed if elapsed > 0 else 0
                    remaining = (len(docs) - docs_processed) / rate if rate > 0 else 0
                    ref_summary = ", ".join(
                        f"{s['total']} {rt}" for rt, s in stats.items() if s['total'] > 0
                    )
                    print(
                        f"  Processed {docs_processed}/{len(docs)} docs, "
                        f"{ref_summary}, "
                        f"ETA: {remaining:.0f}s"
                    )
            except Exception as e:
                docs_errored += 1
                print(f"  WARNING: Failed to process doc {doc_id} ({canonical_ref}): {e}")
                continue

        # Report
        print(f"\n{'=' * 60}")
        print("CONTENT CROSS-REFERENCE EXTRACTION RESULTS")
        print(f"{'=' * 60}")
        print(f"Documents processed: {docs_processed}")
        print(f"Documents with refs: {docs_with_refs}")
        if docs_errored:
            print(f"Documents errored:   {docs_errored}")

        for ref_type_str, s in stats.items():
            if s['total'] > 0:
                print(f"\n{ref_type_str} references: {s['total']}")
                if s['resolved']:
                    print(f"  Resolved: {s['resolved']}/{s['total']} ({100 * s['resolved'] / s['total']:.1f}%)")

        print(f"\nTotal rows to insert: {len(rows_to_insert)}")

        if dry_run:
            print("\n(dry run -- use --execute to write to database)")

            # Show samples per type
            for ref_type_str in stats:
                samples = [r for r in rows_to_insert if r[1] == ref_type_str][:5]
                if samples:
                    print(f"\nSample {ref_type_str} refs:")
                    for row in samples:
                        resolved = "+" if row[10] else "x"
                        target = row[8] or row[9] or "-"
                        print(f"  [{resolved}] doc {row[0]}: {row[2]} -> {row[3]} (target: {target})")

            return

        # Write to database
        print("\nWriting to database...")

        try:
            # Delete existing content-extracted cross-refs for these source docs
            # We identify content-extracted refs by source_guidance_id + start_offset IS NOT NULL
            if source_ids_to_clean:
                cur.execute(
                    """
                    DELETE FROM cross_references
                    WHERE source_guidance_id = ANY(%s)
                      AND start_offset IS NOT NULL
                    """,
                    (source_ids_to_clean,),
                )
                deleted = cur.rowcount
                print(f"  Deleted {deleted} existing content-extracted refs")

            # Batch insert
            if rows_to_insert:
                cur.executemany(
                    """
                    INSERT INTO cross_references
                    (source_guidance_id, ref_type, raw_text, normalized_citation,
                     start_offset, end_offset, context_before, context_after,
                     target_document_id, target_guidance_id, is_resolved,
                     jurisdiction, source_jurisdiction, target_jurisdiction)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    rows_to_insert,
                )
                print(f"  Inserted {len(rows_to_insert)} cross-references")

            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"ERROR: Write failed, rolled back all changes: {e}")
            raise

        elapsed = time.time() - start_time
        print(f"\nDone in {elapsed:.1f}s.")
    finally:
        cur.close()
        conn.close()
