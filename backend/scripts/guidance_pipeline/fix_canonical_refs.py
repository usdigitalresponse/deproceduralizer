"""Fix canonical_ref values using title + agency metadata (title-first approach).

Unlike canonical_ref_cleaner.py which extracts refs from content (causing
cross-contamination), this module derives refs exclusively from the document's
own title and agency metadata.
"""

import re

from lib.db import get_db_connection

from scripts.guidance_pipeline.canonical_ref_cleaner import is_valid_canonical_ref
from scripts.guidance_pipeline.catalog import _ATTACHMENT_SUFFIX

# --- Patterns for extracting refs from titles ---

# Full agency ref: 22-OCFS-ADM-05, 15-OTDA-LCM-03-R1, 9-OCFS-LCM-6
_FULL_AGENCY_REF = re.compile(
    r"(\d{1,2})[\s-]+(OCFS|OTDA|OMH|OPWDD|OASAS|NYSED|SED|DOH|DOL)[\s-]+"
    r"((?:ADM|LCM|INF|GIS|IB|RG|TA|IMM|IMP)[\s-]+\d+(?:[\s-]+R\d+)?)",
    re.IGNORECASE,
)

# Short ref (no agency): 15-ADM-03, 22-LCM-01
_SHORT_REF = re.compile(
    r"(\d{1,2})[\s-]+(ADM|LCM|INF|GIS|IB|RG|TA|IMM|IMP)[\s-]+(\d+(?:[\s-]+R\d+)?)",
    re.IGNORECASE,
)

# 4-digit year ref: 2003 INF-39, 2005 ADM-01
_FOUR_DIGIT_YEAR_REF = re.compile(
    r"((?:19|20)\d{2})[\s-]+(ADM|LCM|INF|GIS|IB|RG|TA|IMM|IMP)[\s-]+(\d+)",
    re.IGNORECASE,
)

# GIS ref: GIS 13 MA/01, GIS 23 TA/DC033
_GIS_REF = re.compile(
    r"(GIS\s+\d{2}\s+\w+/\w{1,5})",
    re.IGNORECASE,
)

# TSB-M ref: TSB-M-06(7)I, TSB-M-09(1)C
_TSB_M_REF = re.compile(
    r"(TSB-M-\d{2}\(\d+\)[A-Z](?:\.\d)?)",
    re.IGNORECASE,
)

# DAL ref: DAL 18-06, DAL 22-01-05
_DAL_REF = re.compile(
    r"(DAL\s+\d{2}-\d{2}(?:-\d{2})?)",
    re.IGNORECASE,
)

# DOCCS Directive: Directive #4911A
_DOCCS_DIRECTIVE = re.compile(
    r"(Directive\s*#?\s*\d{4}(?:[A-Z])?)",
    re.IGNORECASE,
)

# NYDFS Circular Letter: Circular Letter No. 2024-01
_NYDFS_CIRCULAR = re.compile(
    r"(Circular\s+Letter\s+(?:No\.\s*)?\d{4}-\d{1,3})",
    re.IGNORECASE,
)


def _normalize_ref(ref: str) -> str:
    """Normalize whitespace to hyphens and uppercase."""
    return re.sub(r"\s+", "-", ref.strip()).upper()


def compute_ref_from_title(title: str, agency: str | None, is_attachment: bool) -> str | None:
    """Compute the correct canonical_ref from title + agency metadata.

    Returns None if no ref can be extracted or the doc is an attachment.
    """
    if not title:
        return None

    # 1. Full agency ref in title (22-OCFS-ADM-05, 9-OCFS-LCM-6)
    m = _FULL_AGENCY_REF.search(title)
    if m:
        remainder = title[m.end():]
        if remainder and _ATTACHMENT_SUFFIX.match(remainder):
            return None
        yy = m.group(1).zfill(2)
        agency_name = m.group(2).upper()
        type_and_num = _normalize_ref(m.group(3))
        return f"{yy}-{agency_name}-{type_and_num}"

    # 2. Attachment check — if DB says it's an attachment, don't extract
    if is_attachment:
        return None

    # 3. Short ref + agency column (15-ADM-03 with agency=OCFS -> 15-OCFS-ADM-03)
    m = _SHORT_REF.search(title)
    if m:
        remainder = title[m.end():]
        if remainder and _ATTACHMENT_SUFFIX.match(remainder):
            return None
        yy = m.group(1).zfill(2)
        doc_type = m.group(2).upper()
        num = re.sub(r"\s+", "-", m.group(3).strip()).upper()
        if agency:
            return f"{yy}-{agency.upper()}-{doc_type}-{num}"
        # No agency — still use the short ref (better than content-extracted)
        return f"{yy}-{doc_type}-{num}"

    # 4. 4-digit year ref (2003 INF-39 -> 03-{AGENCY}-INF-39)
    m = _FOUR_DIGIT_YEAR_REF.search(title)
    if m:
        yy = m.group(1)[2:]  # 2003 -> 03
        doc_type = m.group(2).upper()
        num = m.group(3)
        if agency:
            return f"{yy}-{agency.upper()}-{doc_type}-{num}"
        return f"{yy}-{doc_type}-{num}"

    # 5. GIS ref (GIS 13 MA/01)
    m = _GIS_REF.search(title)
    if m:
        return _normalize_ref(m.group(1))

    # 6. TSB-M ref
    m = _TSB_M_REF.search(title)
    if m:
        return m.group(1).upper()

    # 7. DAL ref
    m = _DAL_REF.search(title)
    if m:
        return _normalize_ref(m.group(1))

    # 8. DOCCS Directive
    m = _DOCCS_DIRECTIVE.search(title)
    if m:
        return _normalize_ref(m.group(1))

    # 9. NYDFS Circular Letter
    m = _NYDFS_CIRCULAR.search(title)
    if m:
        return _normalize_ref(m.group(1))

    # No match — don't guess from content
    return None


def fix_canonical_refs(dry_run: bool = True) -> dict:
    """Fix canonical_ref values using title + agency metadata.

    For every guidance_document, recompute the canonical_ref from title/agency
    and compare to the existing value. Only updates rows where the value differs.

    Returns summary stats.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, canonical_ref, title, agency, source_project, is_attachment
            FROM guidance_documents
            ORDER BY id
        """)
        rows = cur.fetchall()
        cur.close()

        print(f"Loaded {len(rows)} guidance documents")

        unchanged = 0
        fixed = 0
        cleared_to_null = 0
        newly_extracted = 0
        changes: list[tuple[int, str | None, str | None, str]] = []  # (id, old, new, title)

        for row in rows:
            doc_id, old_ref, title, agency, source_project, is_attachment = row
            new_ref = compute_ref_from_title(title or "", agency, bool(is_attachment))

            # Validate the computed ref
            if new_ref and not is_valid_canonical_ref(new_ref):
                new_ref = None

            if new_ref == old_ref:
                unchanged += 1
                continue

            if old_ref is None and new_ref is not None:
                newly_extracted += 1
            elif old_ref is not None and new_ref is None:
                cleared_to_null += 1
            else:
                fixed += 1

            changes.append((doc_id, old_ref, new_ref, title or ""))

        # Print sample changes
        sample_size = min(20, len(changes))
        if sample_size:
            print(f"\nSample changes ({sample_size} of {len(changes)}):")
            for doc_id, old_ref, new_ref, title in changes[:sample_size]:
                old_display = f"'{old_ref}'" if old_ref else "NULL"
                new_display = f"'{new_ref}'" if new_ref else "NULL"
                print(f"  {old_display:30s} -> {new_display:30s}  (id={doc_id}, {title[:60]})")

        # Apply changes
        if not dry_run and changes:
            try:
                cur = conn.cursor()
                for doc_id, _old_ref, new_ref, _title in changes:
                    cur.execute(
                        "UPDATE guidance_documents SET canonical_ref = %s WHERE id = %s",
                        (new_ref, doc_id),
                    )
                conn.commit()
                cur.close()
            except Exception:
                conn.rollback()
                raise

        mode = "DRY RUN" if dry_run else "EXECUTED"
        total_changes = fixed + cleared_to_null + newly_extracted
        print(f"\n[{mode}] Title-based canonical_ref fix summary:")
        print(f"  Total documents: {len(rows)}")
        print(f"  Unchanged: {unchanged}")
        print(f"  Fixed (old -> new): {fixed}")
        print(f"  Cleared to NULL: {cleared_to_null}")
        print(f"  Newly extracted: {newly_extracted}")
        print(f"  Total changes: {total_changes}")

        return {
            "total": len(rows),
            "unchanged": unchanged,
            "fixed": fixed,
            "cleared_to_null": cleared_to_null,
            "newly_extracted": newly_extracted,
        }
    finally:
        conn.close()
