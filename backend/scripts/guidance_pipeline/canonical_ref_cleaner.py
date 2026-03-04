"""Clean junk canonical_ref values in guidance_documents and re-extract from content."""

import re
import time

from lib.db import get_db_connection


# Expanded ref patterns — ported from nys-documents supersession.ts + additions
AGENCY_REF_PATTERN = re.compile(
    r"\b(\d{2}-(?:OCFS|OTDA|OMH|OASAS|OPWDD|DOH|SED|DOL|NYSED)-"
    r"(?:ADM|LCM|INF|GIS|IB|RG|TA|IMM|IMP)-\d{1,3}(?:-R\d)?)\b",
    re.IGNORECASE,
)
NYSDOH_GIS_PATTERN = re.compile(
    r"\b(GIS\s+\d{2}\s+\w+/\w{1,5})\b"
)
LEGACY_REF_PATTERN = re.compile(
    r"\b(\d{2}\s+(?:ADM|LCM|INF|GIS|IB)-\d{1,3})\b"
)
TSB_M_PATTERN = re.compile(
    r"\b(TSB-M-\d{2}\(\d+\)[A-Z](?:\.\d)?)\b", re.IGNORECASE
)
DAL_PATTERN = re.compile(
    r"\b(DAL\s+\d{2}-\d{2}(?:-\d{2})?)\b", re.IGNORECASE
)
DOCCS_DIRECTIVE_PATTERN = re.compile(
    r"\b(Directive\s*#?\s*\d{4}(?:[A-Z])?)\b", re.IGNORECASE
)
NYDFS_CIRCULAR_PATTERN = re.compile(
    r"\b(Circular\s+Letter\s+(?:No\.\s*)?\d{4}-\d{1,3})\b", re.IGNORECASE
)
TRANSMITTAL_PATTERN = re.compile(
    r"Transmittal:\s*(\S+)", re.IGNORECASE
)

ALL_PATTERNS = [
    AGENCY_REF_PATTERN,
    NYSDOH_GIS_PATTERN,
    LEGACY_REF_PATTERN,
    TSB_M_PATTERN,
    DAL_PATTERN,
    DOCCS_DIRECTIVE_PATTERN,
    NYDFS_CIRCULAR_PATTERN,
    TRANSMITTAL_PATTERN,
]


def is_valid_canonical_ref(ref: str | None) -> bool:
    """Check if a canonical_ref is valid (not junk)."""
    if not ref:
        return False
    ref = ref.strip()
    if len(ref) < 5:
        return False
    has_letter = any(c.isalpha() for c in ref)
    has_digit = any(c.isdigit() for c in ref)
    if not (has_letter and has_digit):
        return False
    # Reject if majority non-alphanumeric
    alnum_count = sum(1 for c in ref if c.isalnum())
    if alnum_count < len(ref) * 0.4:
        return False
    # Known junk patterns
    junk_starts = ("to:", "from:", "re:", "date:", "http")
    if ref.lower().startswith(junk_starts):
        return False
    return True


def extract_ref_from_text(text: str, limit: int = 2000) -> str | None:
    """Extract a canonical reference from document text (first N chars)."""
    snippet = text[:limit]
    for pattern in ALL_PATTERNS:
        m = pattern.search(snippet)
        if m:
            ref = m.group(1).strip()
            # Normalize whitespace to hyphens for agency-style refs
            ref = re.sub(r"\s+", "-", ref)
            if is_valid_canonical_ref(ref):
                return ref.upper()
    return None


def find_junk_refs(conn) -> list[dict]:
    """Query guidance_documents with suspicious canonical_refs."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, canonical_ref, title, LEFT(content, 2000) as content_start, agency
        FROM guidance_documents
        WHERE canonical_ref IS NOT NULL
          AND (
            LENGTH(canonical_ref) < 5
            OR canonical_ref ~ '^[^a-zA-Z]*$'
            OR canonical_ref ~ '^[^0-9]*$'
            OR canonical_ref ~ '^(To:|From:|Re:|Date:|\u00a6|http)'
          )
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()
    return [
        {"id": r[0], "canonical_ref": r[1], "title": r[2], "content_start": r[3], "agency": r[4]}
        for r in rows
    ]


def find_missing_refs(conn) -> list[dict]:
    """Query guidance_documents with NULL canonical_ref that might be extractable."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, canonical_ref, title, LEFT(content, 2000) as content_start, agency
        FROM guidance_documents
        WHERE canonical_ref IS NULL
        ORDER BY id
    """)
    rows = cur.fetchall()
    cur.close()
    return [
        {"id": r[0], "canonical_ref": r[1], "title": r[2], "content_start": r[3], "agency": r[4]}
        for r in rows
    ]


def clean_canonical_refs(dry_run: bool = True) -> dict:
    """Clean junk canonical_refs and extract missing ones.

    Returns summary stats.
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    # Phase 1: Fix junk refs
    junk_docs = find_junk_refs(conn)
    print(f"\nFound {len(junk_docs)} documents with junk canonical_refs")

    fixed = 0
    cleared = 0
    for doc in junk_docs:
        new_ref = None
        # Try title first
        title = doc["title"] or ""
        for pattern in ALL_PATTERNS:
            m = pattern.search(title)
            if m:
                candidate = re.sub(r"\s+", "-", m.group(1).strip()).upper()
                if is_valid_canonical_ref(candidate):
                    new_ref = candidate
                    break

        # Try content
        if not new_ref and doc["content_start"]:
            new_ref = extract_ref_from_text(doc["content_start"])

        if new_ref:
            if not dry_run:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE guidance_documents SET canonical_ref = %s WHERE id = %s",
                    (new_ref, doc["id"]),
                )
                cur.close()
            fixed += 1
            if fixed <= 10:
                print(f"  Fix: '{doc['canonical_ref']}' -> '{new_ref}' (id={doc['id']}, {doc['title'][:60]})")
        else:
            # Clear the junk value
            if not dry_run:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE guidance_documents SET canonical_ref = NULL WHERE id = %s",
                    (doc["id"],),
                )
                cur.close()
            cleared += 1
            if cleared <= 10:
                print(f"  Clear: '{doc['canonical_ref']}' -> NULL (id={doc['id']}, {doc['title'][:60]})")

    # Phase 2: Extract refs for docs with NULL canonical_ref
    missing_docs = find_missing_refs(conn)
    print(f"\nFound {len(missing_docs)} documents with NULL canonical_ref")

    extracted = 0
    for doc in missing_docs:
        new_ref = None
        title = doc["title"] or ""
        for pattern in ALL_PATTERNS:
            m = pattern.search(title)
            if m:
                candidate = re.sub(r"\s+", "-", m.group(1).strip()).upper()
                if is_valid_canonical_ref(candidate):
                    new_ref = candidate
                    break

        if not new_ref and doc["content_start"]:
            new_ref = extract_ref_from_text(doc["content_start"])

        if new_ref:
            if not dry_run:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE guidance_documents SET canonical_ref = %s WHERE id = %s",
                    (new_ref, doc["id"]),
                )
                cur.close()
            extracted += 1
            if extracted <= 10:
                print(f"  Extract: NULL -> '{new_ref}' (id={doc['id']}, {doc['title'][:60]})")

    if not dry_run:
        conn.commit()
    conn.close()

    mode = "DRY RUN" if dry_run else "EXECUTED"
    print(f"\n[{mode}] Canonical ref cleanup summary:")
    print(f"  Junk refs found: {len(junk_docs)}")
    print(f"    Fixed (re-extracted): {fixed}")
    print(f"    Cleared (set to NULL): {cleared}")
    print(f"  Missing refs found: {len(missing_docs)}")
    print(f"    Newly extracted: {extracted}")

    return {
        "junk_found": len(junk_docs),
        "fixed": fixed,
        "cleared": cleared,
        "missing_found": len(missing_docs),
        "extracted": extracted,
    }
