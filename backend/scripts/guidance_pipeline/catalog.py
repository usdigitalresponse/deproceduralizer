"""Load and merge guidance documents from nys-documents catalog and text directories."""

import hashlib
import json
import re
from pathlib import Path

from scripts.guidance_pipeline.canonical_ref_cleaner import is_valid_canonical_ref


def load_catalog(source_dir: str) -> list[dict]:
    """Load documents from enriched_catalog.json.

    Returns list of doc dicts with enrichment metadata.
    """
    catalog_path = Path(source_dir) / "data" / "enriched_catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Catalog not found at {catalog_path}")

    with open(catalog_path) as f:
        catalog = json.load(f)

    return catalog.get("documents", [])


def load_text(source_dir: str, text_path: str) -> str | None:
    """Load extracted text for a document."""
    if not text_path:
        return None
    full_path = Path(source_dir) / text_path
    if not full_path.exists():
        return None
    try:
        text = full_path.read_text(encoding="utf-8", errors="replace")
        # Strip NUL bytes (PostgreSQL text fields cannot contain them)
        return text.replace("\x00", "")
    except Exception as e:
        print(f"  Warning: Could not read {full_path}: {e}")
        return None


def load_text_dir_docs(source_dir: str, catalog_text_paths: set[str]) -> list[dict]:
    """Scan text_output subdirectories for docs not in the enriched catalog.

    Builds doc dicts from filename conventions (e.g., '22-OCFS-ADM-05.txt').
    Skips any doc whose text_path already appears in the catalog.
    """
    text_output_dir = Path(source_dir) / "data" / "text_output"
    if not text_output_dir.exists():
        return []

    ID_OFFSET = 100000
    docs = []

    for subdir in sorted(text_output_dir.iterdir()):
        if not subdir.is_dir():
            continue
        subdir_name = subdir.name
        for txt_file in sorted(subdir.iterdir()):
            if txt_file.suffix != ".txt":
                continue

            text_path = str(txt_file.relative_to(Path(source_dir)))

            if text_path in catalog_text_paths:
                continue

            fname = txt_file.stem
            stable_key = f"{subdir_name}/{fname}"
            source_index = ID_OFFSET + int(hashlib.sha256(stable_key.encode()).hexdigest(), 16) % 900000

            doc_type = _classify_filename(fname)
            agency = _extract_agency(fname, subdir_name)
            domain = "childcare" if subdir_name in ("ocfs", "ocfs-new", "childcare") else "general"

            docs.append({
                "id": str(source_index),
                "title": fname.replace("-", " ").replace("_", " "),
                "agency": agency,
                "domain": domain,
                "doc_type": doc_type,
                "text_path": text_path,
                "extraction_status": "success",
                "source_project": f"text_dir:{subdir_name}",
                "url": "",
            })

    return docs


_BLOCKED_DOC_TYPES = {"regulation", "regulation_text"}

_NYCRR_TITLE_PATTERN = re.compile(
    r"\bTit(?:le)?\.?\s+\d+\s*[-–—]\s*.*NYCRR\b|\bNYCRR\b.*\bTit(?:le)?\.?\s+\d+",
    re.IGNORECASE,
)


def filter_docs(
    docs: list[dict],
    source_project: str | None = None,
    agency: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """Filter docs to those eligible for import."""
    eligible = []
    for d in docs:
        if d.get("extraction_status") != "success":
            continue
        if not d.get("text_path"):
            continue
        if source_project and d.get("source_project") != source_project:
            continue
        if agency and d.get("agency", "").upper() != agency.upper():
            continue
        # Block regulatory documents that don't belong in guidance table
        doc_type = (d.get("doc_type") or "").lower()
        if doc_type in _BLOCKED_DOC_TYPES:
            continue
        if _NYCRR_TITLE_PATTERN.search(d.get("title", "")):
            continue
        eligible.append(d)

    if limit:
        eligible = eligible[:limit]

    return eligible


def merge_catalog_and_text_dirs(
    source_dir: str,
    source_project: str | None = None,
    agency: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """Load and merge documents from catalog + text directories.

    This is the main entry point for the catalog module.
    Returns a filtered, merged list of doc dicts ready for import.
    """
    catalog_docs = load_catalog(source_dir)
    print(f"Catalog: {len(catalog_docs)} total documents")

    catalog_eligible = filter_docs(catalog_docs, source_project=source_project, agency=agency)
    print(f"  Catalog eligible: {len(catalog_eligible)}")

    # Text dirs: only scan if not filtering by project
    catalog_text_paths = {d.get("text_path", "") for d in catalog_docs if d.get("text_path")}
    if source_project:
        text_dir_docs = []
    else:
        text_dir_docs = load_text_dir_docs(source_dir, catalog_text_paths)
        text_dir_docs = filter_docs(text_dir_docs, agency=agency)
        print(f"  Text dirs (not in catalog): {len(text_dir_docs)}")

    all_docs = catalog_eligible + text_dir_docs
    if limit:
        all_docs = all_docs[:limit]

    print(f"Total eligible for import: {len(all_docs)}")
    return all_docs


_ATTACHMENT_SUFFIX = re.compile(
    r"\s+(?:Att(?:achment)?|App(?:endix)?|Enclosure|Enc)[\s\d]",
    re.IGNORECASE,
)


def extract_canonical_ref(doc: dict) -> str | None:
    """Extract canonical reference from doc title or metadata.

    Handles patterns like '22-OCFS-ADM-05', '24-OCFS-ADM-01-R1',
    'TSB-M-06(7)I', 'GIS 23 TA/DC033', etc.

    Returns None for attachment documents (title contains 'Att A', 'App B', etc.
    after the base ref) since they share the parent doc's ref and would cause
    ambiguous canonical_ref lookups.
    """
    # Try enrichment field first, but validate it
    if doc.get("canonical_ref"):
        ref = doc["canonical_ref"].strip()
        if is_valid_canonical_ref(ref):
            return ref

    title = doc.get("title", "")
    # OCFS/OTDA style: YY-AGENCY-TYPE-NN[-R1]
    m = re.match(
        r"(\d{2}[\s-]+(?:OCFS|OTDA|OMH|OPWDD|OASAS|NYSED|SED|DOH|DOL)[\s-]+"
        r"(?:ADM|LCM|INF|GIS|IB|RG|TA|IMM|IMP)[\s-]+\d+(?:[\s-]+R\d+)?)",
        title,
        re.IGNORECASE,
    )
    if m:
        # Check if the rest of the title indicates this is an attachment
        remainder = title[m.end():]
        if remainder and _ATTACHMENT_SUFFIX.match(remainder):
            return None
        return re.sub(r"\s+", "-", m.group(1).strip()).upper()

    return None


def extract_year(doc: dict) -> int | None:
    """Extract year from document metadata, canonical ref, or title."""
    # From enrichment
    if doc.get("date_published"):
        try:
            return int(str(doc["date_published"])[:4])
        except (ValueError, IndexError):
            pass
    if doc.get("year"):
        try:
            return int(doc["year"])
        except (ValueError, TypeError):
            pass

    # From canonical ref (2-digit year prefix)
    ref = extract_canonical_ref(doc)
    if ref:
        m = re.match(r"(\d{2})-", ref)
        if m:
            yy = int(m.group(1))
            return 2000 + yy if yy < 50 else 1900 + yy

    # From title — look for 4-digit year or AG opinion-style "YYYY-NN"
    title = doc.get("title", "")
    if title:
        # AG opinion pattern: "2008-08 Town of Carmel" or "2007-F2 NYS Thruway"
        m = re.match(r"((?:19|20)\d{2})-", title)
        if m:
            return int(m.group(1))
        # NYSDOH DAL pattern: "DAL 07-01-04" -> year is first 2-digit group
        m = re.match(r"DAL\s+(\d{2})", title, re.IGNORECASE)
        if m:
            yy = int(m.group(1))
            return 2000 + yy if yy < 50 else 1900 + yy
        # Generic: first 4-digit year in title
        m = re.search(r"\b((?:19|20)\d{2})\b", title)
        if m:
            return int(m.group(1))

    # From URL
    url = doc.get("url", "")
    if url:
        m = re.search(r"/((?:19|20)\d{2})/", url)
        if m:
            return int(m.group(1))

    return None


def _classify_filename(fname: str) -> str:
    """Classify a document type from its filename."""
    f = fname.upper()
    if "-ADM-" in f:
        return "ADM"
    if "-LCM-" in f:
        return "LCM"
    if "-INF-" in f:
        return "INF"
    if "-GIS-" in f:
        return "GIS"
    if "CPS-MANUAL" in f:
        return "CPS-Manual"
    if "TSB-M" in f:
        return "TSB-M"
    return "other"


def _extract_agency(fname: str, subdir_name: str) -> str:
    """Extract agency from filename or directory."""
    f = fname.upper()
    if "OCFS" in f:
        return "OCFS"
    if "OTDA" in f:
        return "OTDA"
    if "OMH" in f:
        return "OMH"
    if "OPWDD" in f:
        return "OPWDD"
    if "OASAS" in f:
        return "OASAS"

    dir_to_agency = {
        "ocfs": "OCFS", "ocfs-new": "OCFS", "childcare": "OCFS",
        "otda": "OTDA", "sla": "SLA", "nysdec": "NYSDEC",
        "nysed": "NYSED", "omh": "OMH", "opwdd": "OPWDD",
        "hcr": "HCR", "nysdol": "NYSDOL", "nysdoh": "NYSDOH",
        "tax": "TAX", "dos": "DOS", "oasas": "OASAS", "ocm": "OCM",
        "nydfs": "NYDFS", "nysdot": "NYSDOT",
    }
    return dir_to_agency.get(subdir_name, subdir_name.upper())
