#!/usr/bin/env python3
"""
Batch definition extraction using Anthropic Message Batches API.

Provides 50% cost reduction compared to sequential processing.
Batches are processed asynchronously (up to 24 hours).

Commands:
    submit  - Submit sections for batch processing
    status  - Check batch status via Anthropic API
    process - Process completed batch results
    resume  - Retry failed requests from a batch

Examples:
    # Submit all NJ definitions
    python batch_definitions.py submit --state NJ

    # Submit NJ Title 3A only
    python batch_definitions.py submit --state NJ --title 3A

    # Submit NY Title 18, Chapter II, skip already-processed
    python batch_definitions.py submit --state NY --title 18 --chapter II --skip-done

    # Check status of all batches
    python batch_definitions.py status

    # Process completed batch
    python batch_definitions.py process --batch-id msgbatch_xxx
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from observability.types import LLMTraceContext
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from difflib import SequenceMatcher

from config import PROJECT_ROOT, OUTPUTS_DIR
from lib.db import get_db_connection, normalize_scope_level, get_filtered_documents, get_already_extracted_ids
from lib.jurisdictions import jurisdiction_prefix, VALID_JURISDICTIONS
from lib.llm import get_anthropic_client, get_async_anthropic_client, call_llm_parse, call_llm_parse_async, DEFAULT_MODEL
from lib.batch import format_batch_request
from lib.prompts import load_prompt, load_prompt_parts
from lib.stats import format_time

load_dotenv(PROJECT_ROOT / '.env')

# Re-export DEFAULT_MODEL as MODEL_VERSION for backwards compatibility
MODEL_VERSION = DEFAULT_MODEL

# Batches directory
BATCHES_DIR = OUTPUTS_DIR / 'batches'


# ============================================================================
# Pydantic Models (same as extract_definitions.py)
# ============================================================================

class Definition(BaseModel):
    """A single term definition extracted from regulation text."""
    term: str = Field(description="The term being defined")
    verbatim_text: str = Field(description="The exact text extracted from the regulation")
    is_verbatim_text_complete: bool = Field(default=True, description="True if verbatim_text is a complete, usable definition on its own")
    rephrased_definition: Optional[str] = Field(default=None, description="Plain-language definition when verbatim is insufficient")
    scope: Optional[str] = Field(default=None, description="Scope like 'in this section', 'in this part'")
    source_location: Optional[str] = Field(default=None, description="Where it appears, e.g. 'section 1.1'")
    scope_level: Optional[str] = Field(default=None, description="section/subpart/part/chapter/title")
    definition_type: str = Field(default="formal", description="'formal' or 'abbreviation'")
    is_cross_reference: bool = Field(default=False, description="True if points to another definition")
    # Cross-reference categorization (two dimensions)
    reference_completeness: Optional[str] = Field(default=None, description="'pure_pointer' or 'hybrid' when is_cross_reference=true")
    reference_target: Optional[str] = Field(default=None, description="'same_corpus', 'federal', 'external_standard', or 'other'")


class DefinitionsResponse(BaseModel):
    """Response containing all extracted definitions."""
    definitions: List[Definition] = Field(default_factory=list)


# ============================================================================
# Helper Functions
# ============================================================================

# Maximum characters per LLM request (~25K tokens, safe under Haiku 4.5's 200K context limit)
MAX_CHARS_PER_REQUEST = 100000


def chunk_content(content: str, chunk_size: int = MAX_CHARS_PER_REQUEST, overlap: int = 500) -> List[tuple]:
    """Split long content into overlapping chunks.

    Args:
        content: The text content to chunk
        chunk_size: Maximum characters per chunk (default: 100K)
        overlap: Number of overlapping characters between chunks (default: 500)

    Returns:
        List of (start_offset, chunk_text) tuples.
        For content <= chunk_size, returns [(0, content)].
    """
    if len(content) <= chunk_size:
        return [(0, content)]

    chunks = []
    start = 0
    while start < len(content):
        end = min(start + chunk_size, len(content))
        chunks.append((start, content[start:end]))
        if end >= len(content):
            break
        start = end - overlap  # Overlap for context continuity
    return chunks


def get_sections_from_db(
    jurisdiction: str,
    title: Optional[str] = None,
    chapter: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict]:
    """
    Query sections from database matching definition patterns.
    (Same as extract_definitions.py)
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return []

    prefix = jurisdiction_prefix(jurisdiction)

    conditions = [
        "jurisdiction = %s",
        "hierarchy_level = 'section'",
        "(exclude_from_analysis = FALSE OR exclude_from_analysis IS NULL)",
        """(
            title ~* 'definition'
            OR title ~* 'glossary'
            OR title ~* 'meaning of'
            OR title ~* 'words (and|&) (terms|phrases)'
            OR title ~* 'terminology'
            OR content ~* 'shall mean'
            OR content ~* 'shall have the following meaning'
            OR content ~* 'have the meanings'
            OR content ~* 'as used in this'
            OR content ~* 'when used in this'
            OR content ~* 'for (the )?purpose(s)? of this'
            OR content ~* 'the term.*means'
            OR content ~* 'hereinafter'
            OR content ~ '\\("[\\w]+"\\)'
            OR content ~* 'referred to as'
        )"""
    ]
    params = [jurisdiction.upper()]

    if title:
        conditions.append(f"{prefix}_title = %s")
        params.append(title)

    if chapter:
        conditions.append(f"{prefix}_chapter = %s")
        params.append(chapter)

    query = f"""
    SELECT id, title, content, url, {prefix}_title, {prefix}_chapter, hierarchy_level
    FROM regulatory_documents
    WHERE {' AND '.join(conditions)}
    ORDER BY id
    """

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    try:
        result = conn.execute(query, params)
        rows = result.fetchall()
        conn.close()

        sections = []
        for row in rows:
            sections.append({
                'id': row[0],
                'title': row[1],
                'content': row[2],
                'url': row[3],
                f'{prefix}_title': row[4],
                f'{prefix}_chapter': row[5],
                'hierarchy_level': row[6],
            })

        return sections
    except Exception as e:
        print(f"ERROR querying database: {e}")
        if conn:
            conn.close()
        return []


def calculate_definition_overlap(definition: str, content: str) -> float:
    """Calculate definition overlap using substring or fuzzy matching."""
    definition_lower = definition.lower()
    content_lower = content.lower()

    if definition_lower in content_lower:
        return 1.0

    matcher = SequenceMatcher(None, definition_lower, content_lower)
    return matcher.ratio()




def extract_with_llm(
    content: str,
    title: str,
    client=None,
    max_retries: int = 3,
    trace_context: Optional["LLMTraceContext"] = None,
) -> List[Dict]:
    """Extract definitions using LLM with Pydantic structured output (sync)."""
    if client is None:
        client = get_anthropic_client()

    # Use load_prompt_parts to get both system and user prompts, DO NOT TRUNCATE the content
    parts = load_prompt_parts("definition_extraction", title=title, content=content)
    # Combine system and user for non-batch calls
    prompt = f"{parts['system']}\n\n{parts['user']}" if parts.get('system') else parts['user']

    parsed = call_llm_parse(
        client=client,
        prompt=prompt,
        response_format=DefinitionsResponse,
        model=MODEL_VERSION,
        max_retries=max_retries,
        trace_context=trace_context,
    )

    if parsed is None:
        return []

    return [d.model_dump() for d in parsed.definitions]


async def extract_with_llm_async(
    content: str,
    title: str,
    client=None,
    max_retries: int = 3,
    trace_context: Optional["LLMTraceContext"] = None,
    cache=None,
    document_id=None,
) -> List[Dict]:
    """Extract definitions using LLM with Pydantic structured output (async)."""
    if client is None:
        client = get_async_anthropic_client()

    # Use load_prompt_parts to get both system and user prompts, DO NOT TRUNCATE the content
    parts = load_prompt_parts("definition_extraction", title=title, content=content)
    # Combine system and user for non-batch calls
    prompt = f"{parts['system']}\n\n{parts['user']}" if parts.get('system') else parts['user']

    parsed, _ = await call_llm_parse_async(
        client=client,
        prompt=prompt,
        response_format=DefinitionsResponse,
        model=MODEL_VERSION,
        max_retries=max_retries,
        trace_context=trace_context,
        cache=cache,
        cache_metadata={"pipeline": "definitions", "tier": None, "document_id": document_id},
    )

    if parsed is None:
        return []

    return [d.model_dump() for d in parsed.definitions]




def find_ancestor_at_level(conn, start_doc_id: int, target_level: str) -> Optional[int]:
    """
    Walk up from start_doc_id until we find a document at target_level.
    Returns the document ID or None if not found.
    """
    normalized_level = normalize_scope_level(target_level)
    if not normalized_level:
        return None

    result = conn.execute("""
        WITH RECURSIVE ancestors AS (
            SELECT id, parent_id, hierarchy_level, 0 as depth
            FROM regulatory_documents
            WHERE id = %s

            UNION ALL

            SELECT rd.id, rd.parent_id, rd.hierarchy_level, a.depth + 1
            FROM regulatory_documents rd
            INNER JOIN ancestors a ON rd.id = a.parent_id
            WHERE a.depth < 20
        )
        SELECT id FROM ancestors
        WHERE LOWER(hierarchy_level) = %s
        ORDER BY depth ASC
        LIMIT 1
    """, (start_doc_id, normalized_level)).fetchone()

    return result[0] if result else None


def infer_scope_level_from_phrase(conn=None, jurisdiction: str = None, dry_run: bool = False) -> int:
    """
    For definitions that have a scope phrase but no scope_level, infer scope_level
    from the phrase text using pattern matching.

    For "in this section" cases, also sets scope_document_id = document_id directly
    (since the scope IS the source document).

    Args:
        conn: Optional database connection (will create one if not provided)
        jurisdiction: Optional jurisdiction filter (e.g., 'NY', 'NJ', 'NYC')
        dry_run: If True, show what would be updated without making changes

    Returns:
        Number of definitions updated
    """
    import re as re_module

    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    # Patterns ordered from most specific to least specific
    # Each tuple: (compiled_regex, scope_level, set_scope_doc_to_self)
    patterns = [
        (re_module.compile(r'in this (?:regulation )?section', re_module.IGNORECASE), 'section', True),
        (re_module.compile(r'in this regulation$', re_module.IGNORECASE), 'section', True),
        (re_module.compile(r'in this (?:Executive )?Order', re_module.IGNORECASE), 'section', True),
        (re_module.compile(r'as used herein', re_module.IGNORECASE), 'section', True),
        (re_module.compile(r'in this Article', re_module.IGNORECASE), 'article', False),
        (re_module.compile(r'in this Subpart', re_module.IGNORECASE), 'subpart', False),
        (re_module.compile(r'in this Part', re_module.IGNORECASE), 'part', False),
        (re_module.compile(r'in this Subchapter', re_module.IGNORECASE), 'subchapter', False),
        (re_module.compile(r'in this Chapter', re_module.IGNORECASE), 'chapter', False),
        (re_module.compile(r'in this Subtitle', re_module.IGNORECASE), 'subtitle', False),
        (re_module.compile(r'in this (?:Title|Standard)', re_module.IGNORECASE), 'title', False),
    ]

    # Query definitions with scope phrase but no scope_level and no scope_document_id
    state_filter = ""
    params = []
    if jurisdiction:
        state_filter = """
            AND d.document_id IN (
                SELECT id FROM regulatory_documents WHERE jurisdiction = %s
            )
        """
        params.append(jurisdiction.upper())

    definitions = conn.execute(f"""
        SELECT d.id, d.scope, d.document_id
        FROM definitions d
        WHERE d.scope_level IS NULL
          AND d.scope IS NOT NULL
          AND d.scope_document_id IS NULL
          {state_filter}
        ORDER BY d.id
    """, params).fetchall()

    total = len(definitions)
    if total == 0:
        if should_close:
            conn.close()
        return 0

    if dry_run:
        matched = 0
        for def_id, scope_text, doc_id in definitions:
            for pattern, level, _ in patterns:
                if pattern.search(scope_text):
                    matched += 1
                    break
        print(f"  Would infer scope_level from phrase for {matched}/{total} definitions")
        if should_close:
            conn.close()
        return 0

    updated = 0
    for def_id, scope_text, doc_id in definitions:
        for pattern, level, set_self in patterns:
            if pattern.search(scope_text):
                if set_self:
                    conn.execute("""
                        UPDATE definitions
                        SET scope_level = %s, scope_document_id = %s
                        WHERE id = %s
                    """, (level, doc_id, def_id))
                else:
                    conn.execute("""
                        UPDATE definitions SET scope_level = %s WHERE id = %s
                    """, (level, def_id))
                updated += 1
                break

    conn.commit()
    if should_close:
        conn.close()

    return updated


def infer_scope_from_parent_section(doc_ids: List[int] = None, dry_run: bool = False):
    """
    For definitions with null scope_level (and no scope phrase) in sections that
    are clearly definition-oriented (titled definition/glossary/terminology/
    abbreviations/etc.), infer scope by walking up the document hierarchy to
    the first ancestor with a DIFFERENT hierarchy_level.

    Only applies to sections whose title matches definition-related patterns,
    since parent-walk inference is most reliable for dedicated definition sections.

    This runs AFTER infer_scope_level_from_phrase() (which handles defs with
    explicit scope phrases) and BEFORE populate_scope_document_ids().

    Args:
        doc_ids: Optional list of document IDs to limit the update to (for batch processing)
        dry_run: If True, show what would be updated without making changes
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    # Build query with optional document filter
    doc_filter = ""
    params = []
    if doc_ids:
        doc_filter = "AND d.document_id = ANY(%s)"
        params.append(doc_ids)

    # Use recursive CTE to find first ancestor with different hierarchy_level
    # This handles both cases:
    # - Parent has different level: stops immediately, uses parent
    # - Parent has same level: walks up until finding different level
    #
    # Only targets sections with definition-oriented titles (high confidence):
    #   definition, glossary, terminology, meaning of, words and phrases/terms,
    #   abbreviations
    base_cte = f"""
        WITH RECURSIVE ancestors AS (
            -- Base: start from the document where the definition lives
            SELECT
                d.id as def_id,
                section.id as start_doc_id,
                section.hierarchy_level as start_level,
                section.parent_id as current_parent_id,
                1 as depth
            FROM definitions d
            JOIN regulatory_documents section ON d.document_id = section.id
            WHERE d.scope_level IS NULL
              AND d.scope IS NULL
              AND d.scope_document_id IS NULL
              AND section.parent_id IS NOT NULL
              AND section.title ~* 'definition|glossary|terminology|meaning.of|words.*(and|&).*(terms|phrases)|abbreviation'
              {doc_filter}

            UNION ALL

            -- Recurse: keep walking up if parent has same level as start
            SELECT
                a.def_id,
                a.start_doc_id,
                a.start_level,
                parent.parent_id as current_parent_id,
                a.depth + 1
            FROM ancestors a
            JOIN regulatory_documents parent ON a.current_parent_id = parent.id
            WHERE parent.hierarchy_level = a.start_level
              AND parent.parent_id IS NOT NULL
              AND a.depth < 10
        ),
        first_different_ancestor AS (
            SELECT DISTINCT ON (a.def_id)
                a.def_id,
                ancestor.id as scope_doc_id,
                ancestor.hierarchy_level as scope_level
            FROM ancestors a
            JOIN regulatory_documents ancestor ON a.current_parent_id = ancestor.id
            WHERE ancestor.hierarchy_level != a.start_level
            ORDER BY a.def_id, a.depth
        )
    """

    # Count how many definitions would be affected
    count_query = base_cte + "SELECT COUNT(*) FROM first_different_ancestor"
    total = conn.execute(count_query, params).fetchone()[0]

    if total == 0:
        conn.close()
        return 0

    if dry_run:
        print(f"  Would infer scope from parent hierarchy for {total} definitions in definition-titled sections")
        conn.close()
        return 0

    # Apply the update
    update_query = base_cte + """
        UPDATE definitions d
        SET
            scope_level = fda.scope_level,
            scope_document_id = fda.scope_doc_id
        FROM first_different_ancestor fda
        WHERE d.id = fda.def_id
    """

    result = conn.execute(update_query, params)
    updated = result.rowcount
    conn.commit()
    conn.close()

    return updated


def infer_scope_from_any_section(jurisdiction: str = None, dry_run: bool = False) -> int:
    """
    For definitions with null scope_level AND null scope in ANY section
    (not just definition-titled ones), infer scope by walking up the
    document hierarchy to the first ancestor with a DIFFERENT hierarchy_level.

    This is a broader version of infer_scope_from_parent_section() that
    covers inline definitions extracted from "shall mean" patterns in
    substantive regulation sections. Lower confidence than definition-section
    inference, but covers ~4,700 otherwise-unlinked definitions.

    Args:
        jurisdiction: Optional jurisdiction filter (e.g., 'NY', 'NJ', 'NYC')
        dry_run: If True, show what would be updated without making changes

    Returns:
        Number of definitions updated
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return 0

    state_filter = ""
    params = []
    if jurisdiction:
        state_filter = "AND section.jurisdiction = %s"
        params.append(jurisdiction.upper())

    base_cte = f"""
        WITH RECURSIVE ancestors AS (
            SELECT
                d.id as def_id,
                section.id as start_doc_id,
                section.hierarchy_level as start_level,
                section.parent_id as current_parent_id,
                1 as depth
            FROM definitions d
            JOIN regulatory_documents section ON d.document_id = section.id
            WHERE (d.scope_level IS NULL OR d.scope_level = '' OR d.scope_level = 'null')
              AND (d.scope IS NULL OR d.scope = '')
              AND d.scope_document_id IS NULL
              AND section.parent_id IS NOT NULL
              {state_filter}

            UNION ALL

            SELECT
                a.def_id,
                a.start_doc_id,
                a.start_level,
                parent.parent_id as current_parent_id,
                a.depth + 1
            FROM ancestors a
            JOIN regulatory_documents parent ON a.current_parent_id = parent.id
            WHERE parent.hierarchy_level = a.start_level
              AND parent.parent_id IS NOT NULL
              AND a.depth < 10
        ),
        first_different_ancestor AS (
            SELECT DISTINCT ON (a.def_id)
                a.def_id,
                ancestor.id as scope_doc_id,
                ancestor.hierarchy_level as scope_level
            FROM ancestors a
            JOIN regulatory_documents ancestor ON a.current_parent_id = ancestor.id
            WHERE ancestor.hierarchy_level != a.start_level
            ORDER BY a.def_id, a.depth
        )
    """

    count_query = base_cte + "SELECT COUNT(*) FROM first_different_ancestor"
    total = conn.execute(count_query, params).fetchone()[0]

    state_label = f" ({jurisdiction.upper()})" if jurisdiction else ""
    print(f"  Found {total} definitions in any section needing parent-based scope{state_label}")

    if total == 0:
        conn.close()
        return 0

    if dry_run:
        # Show a sample
        sample_query = base_cte + """
            SELECT fda.def_id, fda.scope_level,
                   d.term, section.title as doc_title
            FROM first_different_ancestor fda
            JOIN definitions d ON d.id = fda.def_id
            JOIN regulatory_documents section ON d.document_id = section.id
            ORDER BY fda.def_id
            LIMIT 5
        """
        samples = conn.execute(sample_query, params).fetchall()
        for def_id, scope_level, term, doc_title in samples:
            print(f"    [{def_id}] \"{term[:30]}\" in {doc_title[:50]} → scope: {scope_level}")
        if total > 5:
            print(f"    ... and {total - 5} more")
        conn.close()
        return 0

    update_query = base_cte + """
        UPDATE definitions d
        SET
            scope_level = fda.scope_level,
            scope_document_id = fda.scope_doc_id
        FROM first_different_ancestor fda
        WHERE d.id = fda.def_id
    """

    result = conn.execute(update_query, params)
    updated = result.rowcount
    conn.commit()
    conn.close()

    return updated


def populate_scope_document_ids(dry_run: bool = False):
    """
    For each definition with scope_level set, walk up the hierarchy
    to find the ancestor matching that level and set scope_document_id.
    """
    import time

    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    definitions = conn.execute("""
        SELECT d.id, d.document_id, d.scope_level, d.term
        FROM definitions d
        WHERE d.document_id IS NOT NULL
          AND d.scope_level IS NOT NULL
          AND d.scope_document_id IS NULL
        ORDER BY d.id
    """).fetchall()

    total = len(definitions)
    print(f"  Found {total} definitions needing scope_document_id")

    if total == 0:
        conn.close()
        return

    if dry_run:
        print("  DRY RUN - showing first 5:")
        for i, defn in enumerate(definitions[:5], 1):
            def_id, doc_id, target_level, term = defn
            scope_doc_id = find_ancestor_at_level(conn, doc_id, target_level)
            status = f"→ {scope_doc_id}" if scope_doc_id else "→ NOT FOUND"
            print(f"    {i}. [{def_id}] \"{term[:30]}\" (scope: {target_level}) {status}")
        conn.close()
        return

    # Fallback chain: try progressively broader scope levels
    FALLBACK_CHAIN = {
        'section': ['subpart', 'part', 'subchapter', 'chapter', 'title'],
        'article': ['part', 'subchapter', 'chapter', 'title'],
        'subpart': ['part', 'subchapter', 'chapter', 'title'],
        'part': ['subchapter', 'chapter', 'title'],
        'subchapter': ['chapter', 'title'],
        'chapter': ['title'],
        'subtitle': ['title'],
    }

    start_time = time.time()
    updated = 0
    not_found = 0
    fallback_used = 0

    for i, defn in enumerate(definitions, 1):
        def_id, doc_id, target_level, term = defn
        scope_doc_id = find_ancestor_at_level(conn, doc_id, target_level)

        if scope_doc_id:
            conn.execute("""
                UPDATE definitions SET scope_document_id = %s WHERE id = %s
            """, (scope_doc_id, def_id))
            updated += 1
        else:
            # Try fallback levels
            fallback_levels = FALLBACK_CHAIN.get(target_level, [])
            found_fallback = False
            for fallback_level in fallback_levels:
                scope_doc_id = find_ancestor_at_level(conn, doc_id, fallback_level)
                if scope_doc_id:
                    conn.execute("""
                        UPDATE definitions SET scope_document_id = %s WHERE id = %s
                    """, (scope_doc_id, def_id))
                    updated += 1
                    fallback_used += 1
                    found_fallback = True
                    print(f"    Warning: [{def_id}] \"{term[:30]}\" scope_level={target_level} not found, used fallback={fallback_level}")
                    break
            if not found_fallback:
                not_found += 1

        if i % 100 == 0 or i == total:
            elapsed = time.time() - start_time
            pct = (i / total) * 100
            print(f"    [{i}/{total}] ({pct:.0f}%) Updated: {updated} | Not found: {not_found}")

    conn.commit()
    conn.close()

    print(f"  Scope linking complete: {updated} updated ({fallback_used} via fallback), {not_found} not found")



def find_batch_dir(batch_id: str) -> Optional[Path]:
    """Find batch directory by batch API ID."""
    if not BATCHES_DIR.exists():
        return None

    for batch_dir in BATCHES_DIR.iterdir():
        if not batch_dir.is_dir():
            continue
        info_file = batch_dir / 'batch_info.json'
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
            if info.get('batch_api_id') == batch_id:
                return batch_dir

    return None


def log_error(batch_dir: Path, doc_id: int, error_type: str, message: str):
    """Append error to batch error log."""
    errors_file = batch_dir / 'errors.log'
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(errors_file, 'a') as f:
        f.write(f"{timestamp} | doc_{doc_id} | {error_type} | {message}\n")


# ============================================================================
# Submit Command
# ============================================================================

def cmd_submit(args):
    """Submit sections for batch processing."""
    print("=" * 70)
    print("BATCH SUBMIT")
    print("=" * 70)
    print()

    # Query sections
    print(f"[1/3] Querying sections from database...")
    print(f"      State: {args.state}")
    if args.title:
        print(f"      Title: {args.title}")
    if args.chapter:
        print(f"      Chapter: {args.chapter}")
    if getattr(args, 'subchapter', None):
        print(f"      Subchapter: {args.subchapter}")
    if getattr(args, 'part', None):
        print(f"      Part: {args.part}")
    if args.limit:
        print(f"      Limit: {args.limit}")

    sections = get_sections_from_db(
        jurisdiction=args.state,
        title=args.title,
        chapter=args.chapter,
        limit=args.limit,
    )

    if not sections:
        print("No sections found matching criteria!")
        return

    print(f"      ✓ Found {len(sections)} sections")

    # Skip already-processed if requested
    if getattr(args, 'skip_done', False):
        already_done = get_already_extracted_ids(args.state)
        before_count = len(sections)
        sections = [s for s in sections if s['id'] not in already_done]
        skipped = before_count - len(sections)
        if skipped > 0:
            print(f"      Skipped {skipped} already-processed sections")
        print(f"      ✓ {len(sections)} sections to process")

    if not sections:
        print("All matching sections already processed!")
        return

    print()

    if args.dry_run:
        print("DRY RUN - Would submit these sections:")
        for i, section in enumerate(sections[:10], 1):
            print(f"  {i}. [{section['id']}] {section['title'][:60]}")
        if len(sections) > 10:
            print(f"  ... and {len(sections) - 10} more")
        print()
        print("Rerun without --dry-run to submit.")
        return

    # Create batch directory
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    title_part = f"_{args.title}" if args.title else "_full"
    batch_dir_name = f"{args.state}{title_part}_{timestamp}"
    batch_dir = BATCHES_DIR / batch_dir_name
    batch_dir.mkdir(parents=True, exist_ok=True)

    print(f"[2/3] Formatting batch requests...")

    # Format requests - use load_prompt_parts for system prompt caching
    requests = []
    doc_ids = []

    # Get system prompt once (cached across all requests)
    first_parts = load_prompt_parts(
        "definition_extraction",
        title="",  # Placeholder - only need system prompt
        content=""
    )
    system_prompt = first_parts.get('system')

    for section in sections:
        # Chunk long content to handle sections > 100K chars
        content_chunks = chunk_content(section['content'])

        for chunk_idx, (start_offset, chunk_text) in enumerate(content_chunks):
            parts = load_prompt_parts(
                "definition_extraction",
                title=section['title'],
                content=chunk_text
            )
            # Use chunk suffix for multi-chunk sections
            if len(content_chunks) > 1:
                custom_id = f"doc_{section['id']}_chunk_{chunk_idx}"
            else:
                custom_id = f"doc_{section['id']}"

            request = format_batch_request(
                custom_id=custom_id,
                prompt=parts['user'],
                response_format=DefinitionsResponse,
                system=system_prompt,  # Include system prompt with detailed instructions
            )
            requests.append(request)

        doc_ids.append(section['id'])

    print(f"      ✓ Formatted {len(requests)} requests")
    print()

    # Submit batch
    print(f"[3/3] Submitting to Anthropic Batch API...")

    client = get_anthropic_client()
    try:
        batch = client.beta.messages.batches.create(requests=requests)
        batch_api_id = batch.id

        print(f"      ✓ Submitted batch: {batch_api_id}")
        print()
    except Exception as e:
        print(f"      ❌ Failed to submit batch: {e}")
        return

    # Save batch info
    batch_info = {
        'batch_api_id': batch_api_id,
        'state': args.state,
        'title': args.title,
        'created_at': datetime.now().isoformat(),
        'total_requests': len(requests),
        'document_ids': doc_ids,
        'status': 'submitted',
    }

    info_file = batch_dir / 'batch_info.json'
    with open(info_file, 'w') as f:
        json.dump(batch_info, f, indent=2)

    print("=" * 70)
    print("BATCH SUBMITTED")
    print("=" * 70)
    print(f"Batch ID:    {batch_api_id}")
    print(f"Directory:   {batch_dir}")
    print(f"Requests:    {len(requests)}")
    print()
    print("Check status:")
    print(f"  python batch_definitions.py status")
    print()
    print("Process results when complete:")
    print(f"  python batch_definitions.py process --batch-id {batch_api_id}")
    print()


# ============================================================================
# Status Command
# ============================================================================

def cmd_status(args):
    """Check batch status via Anthropic API."""
    print("=" * 70)
    print("BATCH STATUS")
    print("=" * 70)
    print()

    client = get_anthropic_client()

    # If specific batch ID provided
    if args.batch_id:
        try:
            batch = client.beta.messages.batches.retrieve(args.batch_id)
            _print_batch_status(batch, args.batch_id)
        except Exception as e:
            print(f"ERROR: Could not retrieve batch {args.batch_id}: {e}")
        return

    # Otherwise, scan local batch directories
    if not BATCHES_DIR.exists():
        print("No batches found. Run 'submit' first.")
        return

    batch_dirs = sorted(BATCHES_DIR.iterdir(), reverse=True)
    if not batch_dirs:
        print("No batches found. Run 'submit' first.")
        return

    print(f"{'Directory':<35} {'Batch ID':<25} {'Status':<15} {'Progress'}")
    print("─" * 90)

    for batch_dir in batch_dirs:
        if not batch_dir.is_dir():
            continue

        info_file = batch_dir / 'batch_info.json'
        if not info_file.exists():
            continue

        with open(info_file) as f:
            info = json.load(f)

        batch_api_id = info.get('batch_api_id', 'unknown')

        try:
            batch = client.beta.messages.batches.retrieve(batch_api_id)
            status = batch.processing_status
            total = info.get('total_requests', 0)

            # Get counts from batch response
            counts = batch.request_counts
            succeeded = counts.succeeded if counts else 0
            errored = counts.errored if counts else 0
            expired = counts.expired if counts else 0
            canceled = counts.canceled if counts else 0
            processing = counts.processing if counts else 0

            completed = succeeded + errored + expired + canceled
            pct = (completed / total * 100) if total > 0 else 0

            if status == 'ended':
                progress = f"{completed}/{total} ✓"
            else:
                progress = f"{completed}/{total} ({pct:.0f}%)"

            print(f"{batch_dir.name:<35} {batch_api_id:<25} {status:<15} {progress}")

        except Exception as e:
            print(f"{batch_dir.name:<35} {batch_api_id:<25} {'error':<15} {str(e)[:20]}")

    print()

    # Show details for most recent batch
    if batch_dirs and args.verbose:
        print()
        latest = batch_dirs[0]
        info_file = latest / 'batch_info.json'
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
            batch_api_id = info.get('batch_api_id')
            try:
                batch = client.beta.messages.batches.retrieve(batch_api_id)
                _print_batch_status(batch, batch_api_id, info)
            except Exception:
                pass


def _print_batch_status(batch, batch_id: str, local_info: dict = None):
    """Print detailed batch status."""
    print(f"Details for {batch_id}:")
    print()

    if local_info:
        print(f"  State: {local_info.get('state', 'unknown')}")
        if local_info.get('title'):
            print(f"  Title: {local_info['title']}")
        print(f"  Created: {local_info.get('created_at', 'unknown')}")
        print()

    counts = batch.request_counts
    if counts:
        print(f"  Succeeded:  {counts.succeeded}")
        print(f"  Errored:    {counts.errored}")
        print(f"  Expired:    {counts.expired}")
        print(f"  Canceled:   {counts.canceled}")
        print(f"  Processing: {counts.processing}")
    print(f"  Status:     {batch.processing_status}")
    print()


# ============================================================================
# Process Command
# ============================================================================

def cmd_process(args):
    """Process completed batch results."""
    print("=" * 70)
    print("BATCH PROCESS")
    print("=" * 70)
    print()

    batch_id = args.batch_id

    # Find batch directory
    batch_dir = find_batch_dir(batch_id)
    if not batch_dir:
        print(f"ERROR: No local batch directory found for {batch_id}")
        print("Make sure you submitted this batch from this machine.")
        return

    # Load batch info
    info_file = batch_dir / 'batch_info.json'
    with open(info_file) as f:
        batch_info = json.load(f)

    print(f"Batch ID:   {batch_id}")
    print(f"Directory:  {batch_dir}")
    print(f"State:      {batch_info.get('state')}")
    print(f"Title:      {batch_info.get('title', 'full')}")
    print()

    # Check batch status
    print("[1/8] Checking batch status...")
    client = get_anthropic_client()

    try:
        batch = client.beta.messages.batches.retrieve(batch_id)
    except Exception as e:
        print(f"      ❌ Could not retrieve batch: {e}")
        return

    if batch.processing_status != 'ended':
        print(f"      ⚠️  Batch is still processing: {batch.processing_status}")
        counts = batch.request_counts
        if counts:
            completed = counts.succeeded + counts.errored + counts.expired + counts.canceled
            total = batch_info.get('total_requests', 0)
            print(f"      Progress: {completed}/{total}")
        print()
        print("Wait for batch to complete, then run this command again.")
        return

    print(f"      ✓ Batch completed")

    counts = batch.request_counts
    print(f"      Succeeded: {counts.succeeded}")
    print(f"      Errored: {counts.errored}")
    print(f"      Expired: {counts.expired}")
    print()

    # Retrieve results (streaming)
    print("[2/8] Retrieving and processing results...")
    print(f"      Streaming {batch_info.get('total_requests', 0)} results...")
    sys.stdout.flush()

    try:
        results_iter = client.beta.messages.batches.results(batch_id)
    except Exception as e:
        print(f"      ❌ Could not retrieve results: {e}")
        return

    # Process results and store definitions
    print("[3/8] Processing results and storing definitions...")
    sys.stdout.flush()

    conn = get_db_connection()
    if not conn:
        print("      ❌ Could not connect to database")
        return

    # Build document_id -> section info mapping
    doc_ids = batch_info.get('document_ids', [])
    sections_query = conn.execute(
        "SELECT id, content, url FROM regulatory_documents WHERE id = ANY(%s)",
        (doc_ids,)
    ).fetchall()
    sections_map = {row[0]: {'content': row[1], 'url': row[2]} for row in sections_query}

    # Optionally delete existing definitions
    if args.delete_existing:
        deleted = conn.execute(
            "DELETE FROM definitions WHERE document_id = ANY(%s)",
            (doc_ids,)
        ).rowcount
        print(f"      Deleted {deleted} existing definitions")

    total_defs = 0
    skipped_dups = 0
    succeeded = 0
    errored = 0
    processed = 0
    total_expected = batch_info.get('total_requests', 0)
    start_time = time.time()

    # Cache of existing terms per document (for deduplication)
    existing_terms_cache = {}

    for result in results_iter:
        custom_id = result.custom_id
        # Parse doc_id from custom_id (handles doc_123, doc_123_chunk_0, doc_123_continue, doc_123_continue_chunk_0)
        doc_id_str = custom_id.replace('doc_', '').split('_')[0]
        doc_id = int(doc_id_str)

        if result.result.type == 'error':
            error_msg = str(result.result.error) if hasattr(result.result, 'error') else 'Unknown error'
            log_error(batch_dir, doc_id, 'ERROR', error_msg)
            errored += 1
            continue

        if result.result.type == 'expired':
            log_error(batch_dir, doc_id, 'EXPIRED', 'Request expired')
            errored += 1
            continue

        if result.result.type == 'canceled':
            log_error(batch_dir, doc_id, 'CANCELED', 'Request canceled')
            errored += 1
            continue

        # Extract definitions from tool_use
        try:
            message = result.result.message

            # Check for truncation due to max_tokens
            if message.stop_reason == "max_tokens":
                log_error(batch_dir, doc_id, 'TRUNCATED',
                    f'Response truncated (stop_reason=max_tokens). Output may be incomplete.')

            tool_use = None
            for block in message.content:
                if block.type == 'tool_use':
                    tool_use = block
                    break

            if not tool_use:
                log_error(batch_dir, doc_id, 'ERROR', 'No tool_use in response')
                errored += 1
                continue

            # Handle case where model returns definitions as JSON string
            input_data = tool_use.input
            if isinstance(input_data, str):
                input_data = json.loads(input_data)
            if isinstance(input_data.get('definitions'), str):
                input_data['definitions'] = json.loads(input_data['definitions'])

            parsed = DefinitionsResponse.model_validate(input_data)
            definitions = parsed.definitions

            section_info = sections_map.get(doc_id, {})
            section_content = section_info.get('content', '')
            section_url = section_info.get('url', '')

            # Get existing terms for deduplication (cached per document)
            if doc_id not in existing_terms_cache:
                existing_terms_cache[doc_id] = get_existing_terms_for_document(conn, doc_id)

            existing_terms = existing_terms_cache[doc_id]

            # Store definitions (with deduplication)
            for defn in definitions:
                normalized_term = defn.term.lower().strip()

                # Skip if term already exists for this document
                if normalized_term in existing_terms:
                    skipped_dups += 1
                    continue

                verbatim_text = defn.verbatim_text
                overlap = calculate_definition_overlap(verbatim_text, section_content)

                conn.execute("""
                    INSERT INTO definitions
                    (document_id, url, term, verbatim_text, is_verbatim_text_complete, rephrased_definition,
                     scope, source_location, definition_overlap, model_version,
                     scope_level, definition_type, is_cross_reference,
                     reference_completeness, reference_target)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    doc_id,
                    section_url,
                    defn.term,
                    verbatim_text,
                    defn.is_verbatim_text_complete,
                    defn.rephrased_definition,
                    defn.scope,
                    defn.source_location,
                    overlap,
                    DEFAULT_MODEL,
                    normalize_scope_level(defn.scope_level) if defn.scope_level else None,
                    defn.definition_type,
                    defn.is_cross_reference,
                    defn.reference_completeness,
                    defn.reference_target,
                ))
                total_defs += 1

                # Add to cache to avoid duplicates within same batch
                existing_terms.add(normalized_term)

            succeeded += 1

        except Exception as e:
            log_error(batch_dir, doc_id, 'ERROR', str(e))
            errored += 1

        # Progress update every 100 results
        processed += 1
        if processed % 100 == 0 or processed == total_expected:
            elapsed = time.time() - start_time
            pct = (processed / total_expected * 100) if total_expected > 0 else 0
            eta = (elapsed / processed * (total_expected - processed)) if processed > 0 else 0
            print(f"      [{processed}/{total_expected}] ({pct:.1f}%) | {total_defs} defs | ETA: {format_time(eta)}")
            sys.stdout.flush()

    conn.commit()
    conn.close()

    print(f"      ✓ Processed {succeeded} sections, {errored} errors")
    print(f"      ✓ Stored {total_defs} definitions")
    if skipped_dups > 0:
        print(f"      ✓ Skipped {skipped_dups} duplicate definitions")
    print()

    # Update batch info
    batch_info['status'] = 'processed'
    batch_info['processed_at'] = datetime.now().isoformat()
    batch_info['definitions_stored'] = total_defs
    batch_info['sections_succeeded'] = succeeded
    batch_info['sections_errored'] = errored

    with open(info_file, 'w') as f:
        json.dump(batch_info, f, indent=2)

    # Clean up literal 'null' scope_level values from LLM extraction
    try:
        conn_cleanup = get_db_connection()
        if conn_cleanup:
            fixed = conn_cleanup.execute(
                "UPDATE definitions SET scope_level = NULL WHERE scope_level = 'null'"
            ).rowcount
            if fixed > 0:
                conn_cleanup.commit()
                print(f"      Fixed {fixed} definitions with literal 'null' scope_level")
            conn_cleanup.close()
    except Exception as e:
        print(f"      Could not clean up null scope_levels: {e}")

    # Infer scope_level from scope phrase text
    print("[4/8] Inferring scope_level from scope phrases...")

    try:
        phrase_inferred = infer_scope_level_from_phrase(jurisdiction=batch_info.get('state'), dry_run=False)
        if phrase_inferred > 0:
            print(f"      Inferred scope_level for {phrase_inferred} definitions from scope phrase")
        else:
            print(f"      (no definitions needed phrase-based scope inference)")
    except Exception as e:
        print(f"      Could not run phrase scope inference: {e}")

    # Infer scope from parent hierarchy for definition-titled sections
    print("[5/8] Inferring scope from parent hierarchy (definition sections)...")

    try:
        inferred = infer_scope_from_parent_section(doc_ids=doc_ids, dry_run=False)
        if inferred > 0:
            print(f"      Inferred scope for {inferred} definitions from parent hierarchy (def sections)")
        else:
            print(f"      (no definitions needed parent-based scope inference)")
    except Exception as e:
        print(f"      Could not run parent scope inference: {e}")

    # Infer scope from parent hierarchy for ALL sections (inline definitions)
    print("[6/8] Inferring scope from parent hierarchy (all sections)...")

    try:
        any_inferred = infer_scope_from_any_section(jurisdiction=batch_info.get('state'), dry_run=False)
        if any_inferred > 0:
            print(f"      Inferred scope for {any_inferred} definitions from parent hierarchy (all sections)")
        else:
            print(f"      (no definitions needed broad parent-based scope inference)")
    except Exception as e:
        print(f"      Could not run broad parent scope inference: {e}")

    # Run scope document linking for definitions with explicit scope_level
    print("[7/8] Linking scope documents...")

    try:
        populate_scope_document_ids(dry_run=False)
    except Exception as e:
        print(f"      Could not run scope linking: {e}")

    # Link definitions to documents where terms appear
    print("[8/8] Linking definitions to documents where terms appear...")

    try:
        from link_definitions import link_new_definitions
        link_count = link_new_definitions(jurisdiction=batch_info.get('state'))
        print(f"      ✓ Created {link_count} term-document links")
    except Exception as e:
        print(f"      ⚠️  Could not run definition linking: {e}")

    print()
    print("=" * 70)
    print("PROCESSING COMPLETE")
    print("=" * 70)
    print(f"Sections processed: {succeeded}")
    print(f"Definitions stored: {total_defs}")
    if errored > 0:
        print(f"Errors: {errored} (see {batch_dir / 'errors.log'})")
    print()


# ============================================================================
# Resume Command
# ============================================================================

def cmd_resume(args):
    """Resume/retry failed requests from a batch."""
    print("=" * 70)
    print("BATCH RESUME")
    print("=" * 70)
    print()

    batch_id = args.batch_id

    # Find batch directory
    batch_dir = find_batch_dir(batch_id)
    if not batch_dir:
        print(f"ERROR: No local batch directory found for {batch_id}")
        return

    # Check for errors log
    errors_file = batch_dir / 'errors.log'
    if not errors_file.exists():
        print("No errors found for this batch. Nothing to resume.")
        return

    # Parse errors to get failed doc IDs
    failed_doc_ids = []
    with open(errors_file) as f:
        for line in f:
            parts = line.strip().split(' | ')
            if len(parts) >= 2:
                doc_id_str = parts[1]  # e.g., "doc_12345"
                doc_id = int(doc_id_str.replace('doc_', ''))
                if doc_id not in failed_doc_ids:
                    failed_doc_ids.append(doc_id)

    if not failed_doc_ids:
        print("No failed document IDs found in errors log.")
        return

    print(f"Found {len(failed_doc_ids)} failed documents to retry")
    print()

    # Query those sections
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return

    sections = conn.execute("""
        SELECT id, title, content, url
        FROM regulatory_documents
        WHERE id = ANY(%s)
    """, (failed_doc_ids,)).fetchall()
    conn.close()

    if not sections:
        print("Could not find sections in database.")
        return

    sections_list = [
        {'id': row[0], 'title': row[1], 'content': row[2], 'url': row[3]}
        for row in sections
    ]

    print(f"[1/2] Formatting {len(sections_list)} retry requests...")

    # Format requests - use load_prompt_parts for system prompt caching
    requests = []
    doc_ids = []

    # Get system prompt once (cached across all requests)
    first_parts = load_prompt_parts(
        "definition_extraction",
        title="",
        content=""
    )
    system_prompt = first_parts.get('system')

    for section in sections_list:
        # Chunk long content to handle sections > 100K chars
        content_chunks = chunk_content(section['content'])

        for chunk_idx, (start_offset, chunk_text) in enumerate(content_chunks):
            parts = load_prompt_parts(
                "definition_extraction",
                title=section['title'],
                content=chunk_text
            )
            # Use chunk suffix for multi-chunk sections
            if len(content_chunks) > 1:
                custom_id = f"doc_{section['id']}_chunk_{chunk_idx}"
            else:
                custom_id = f"doc_{section['id']}"

            request = format_batch_request(
                custom_id=custom_id,
                prompt=parts['user'],
                response_format=DefinitionsResponse,
                system=system_prompt,
            )
            requests.append(request)

        doc_ids.append(section['id'])

    print(f"      ✓ Formatted {len(requests)} requests")
    print()

    # Submit new batch
    print(f"[2/2] Submitting retry batch...")

    client = get_anthropic_client()
    try:
        batch = client.beta.messages.batches.create(requests=requests)
        new_batch_id = batch.id
        print(f"      ✓ Submitted: {new_batch_id}")
    except Exception as e:
        print(f"      ❌ Failed: {e}")
        return

    # Create new batch directory
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    retry_dir = batch_dir.parent / f"{batch_dir.name}_retry_{timestamp}"
    retry_dir.mkdir(parents=True, exist_ok=True)

    # Load original info
    with open(batch_dir / 'batch_info.json') as f:
        original_info = json.load(f)

    retry_info = {
        'batch_api_id': new_batch_id,
        'state': original_info.get('state'),
        'title': original_info.get('title'),
        'created_at': datetime.now().isoformat(),
        'total_requests': len(requests),
        'document_ids': doc_ids,
        'status': 'submitted',
        'retry_of': batch_id,
    }

    with open(retry_dir / 'batch_info.json', 'w') as f:
        json.dump(retry_info, f, indent=2)

    print()
    print("=" * 70)
    print("RETRY SUBMITTED")
    print("=" * 70)
    print(f"Original:    {batch_id}")
    print(f"Retry:       {new_batch_id}")
    print(f"Requests:    {len(requests)}")
    print()
    print("Process when complete:")
    print(f"  python batch_definitions.py process --batch-id {new_batch_id}")
    print()


# ============================================================================
# Continue Command - Extract from remainder of truncated sections
# ============================================================================

def get_truncated_sections(jurisdiction: str) -> List[Dict]:
    """Get sections with existing definitions that were truncated at 3000 chars.

    Returns sections where:
    - Already has definitions extracted
    - Content is longer than 3000 chars (was truncated in original extraction)
    """
    conn = get_db_connection()
    if not conn:
        print("ERROR: Could not connect to database")
        return []

    try:
        cursor = conn.execute("""
            SELECT DISTINCT
                rd.id,
                rd.title,
                rd.content,
                rd.scraped_from_url as url,
                LENGTH(rd.content) as content_length
            FROM regulatory_documents rd
            JOIN definitions d ON d.document_id = rd.id
            WHERE rd.jurisdiction = %s
              AND LENGTH(rd.content) > 3000
            ORDER BY LENGTH(rd.content) DESC
        """, (jurisdiction.upper(),))

        sections = []
        for row in cursor.fetchall():
            sections.append({
                'id': row[0],
                'title': row[1],
                'content': row[2],
                'url': row[3],
                'content_length': row[4],
            })

        conn.close()
        return sections
    except Exception as e:
        print(f"ERROR querying database: {e}")
        if conn:
            conn.close()
        return []


def get_existing_terms_for_document(conn, document_id: int) -> set:
    """Get set of normalized terms already extracted for a document."""
    try:
        cursor = conn.execute("""
            SELECT LOWER(TRIM(term))
            FROM definitions
            WHERE document_id = %s
        """, (document_id,))
        return {row[0] for row in cursor.fetchall()}
    except Exception as e:
        print(f"Warning: Could not get existing terms for doc {document_id}: {e}")
        return set()


def cmd_continue(args):
    """Continue extraction from truncated sections - process content after first 3000 chars."""
    print("=" * 70)
    print("CONTINUE EXTRACTION FROM TRUNCATED SECTIONS")
    print("=" * 70)
    print()

    print(f"[1/3] Finding truncated sections for {args.state}...")

    sections = get_truncated_sections(args.state)

    if not sections:
        print("No truncated sections found!")
        return

    print(f"      ✓ Found {len(sections)} sections with content >3000 chars that have definitions")

    # Calculate stats
    total_remainder_chars = sum(s['content_length'] - 3000 for s in sections)
    sections_needing_chunks = sum(1 for s in sections if s['content_length'] - 3000 > MAX_CHARS_PER_REQUEST)

    print(f"      Total remainder to process: {total_remainder_chars:,} chars")
    print(f"      Sections needing chunking (remainder >100K): {sections_needing_chunks}")
    print()

    if args.limit:
        sections = sections[:args.limit]
        print(f"      Limited to {len(sections)} sections")
        print()

    if args.dry_run:
        print("DRY RUN - Would process these sections:")
        print()
        for i, section in enumerate(sections[:10], 1):
            remainder_start = 3000
            remainder = section['content'][remainder_start:]
            print(f"  {i}. [{section['id']}] {section['title'][:50]}...")
            print(f"      Content: {section['content_length']:,} chars, Remainder: {len(remainder):,} chars")
            print(f"      Remainder starts with: \"{remainder[:100]}...\"")
            print()

        if len(sections) > 10:
            print(f"  ... and {len(sections) - 10} more sections")
            print()

        # Estimate total requests
        total_requests = 0
        for section in sections:
            remainder = section['content'][3000:]
            chunks = chunk_content(remainder)
            total_requests += len(chunks)

        print(f"Estimated batch size: {total_requests} requests")
        print(f"Total chars to process: {total_remainder_chars:,}")
        print()
        print("Rerun without --dry-run to submit.")
        return

    # Create batch directory
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    batch_dir_name = f"{args.state}_continue_{timestamp}"
    batch_dir = BATCHES_DIR / batch_dir_name
    batch_dir.mkdir(parents=True, exist_ok=True)

    print(f"[2/3] Formatting batch requests for remainder content...")

    # Format requests - use load_prompt_parts for system prompt caching
    requests = []
    doc_ids = []

    # Get system prompt once (cached across all requests)
    first_parts = load_prompt_parts(
        "definition_extraction",
        title="",
        content=""
    )
    system_prompt = first_parts.get('system')

    for section in sections:
        # Get remainder content (everything after first 3000 chars)
        remainder = section['content'][3000:]

        if not remainder.strip():
            continue  # Skip if remainder is empty

        # Chunk the remainder for long sections
        content_chunks = chunk_content(remainder)

        for chunk_idx, (start_offset, chunk_text) in enumerate(content_chunks):
            parts = load_prompt_parts(
                "definition_extraction",
                title=section['title'],
                content=chunk_text
            )
            # Use continue suffix to distinguish from original extraction
            if len(content_chunks) > 1:
                custom_id = f"doc_{section['id']}_continue_chunk_{chunk_idx}"
            else:
                custom_id = f"doc_{section['id']}_continue"

            request = format_batch_request(
                custom_id=custom_id,
                prompt=parts['user'],
                response_format=DefinitionsResponse,
                system=system_prompt,
            )
            requests.append(request)

        doc_ids.append(section['id'])

    print(f"      ✓ Formatted {len(requests)} requests for {len(doc_ids)} sections")
    print()

    # Submit batch
    print(f"[3/3] Submitting to Anthropic Batch API...")

    client = get_anthropic_client()
    try:
        batch = client.beta.messages.batches.create(requests=requests)
        batch_api_id = batch.id

        print(f"      ✓ Submitted batch: {batch_api_id}")
        print()
    except Exception as e:
        print(f"      ❌ Failed to submit batch: {e}")
        return

    # Save batch info
    batch_info = {
        'batch_api_id': batch_api_id,
        'state': args.state,
        'type': 'continue',
        'created_at': datetime.now().isoformat(),
        'total_requests': len(requests),
        'document_ids': doc_ids,
        'status': 'submitted',
    }

    info_file = batch_dir / 'batch_info.json'
    with open(info_file, 'w') as f:
        json.dump(batch_info, f, indent=2)

    print("=" * 70)
    print("CONTINUATION BATCH SUBMITTED")
    print("=" * 70)
    print(f"Batch ID:    {batch_api_id}")
    print(f"Directory:   {batch_dir}")
    print(f"Requests:    {len(requests)}")
    print(f"Sections:    {len(doc_ids)}")
    print()
    print("Check status:")
    print(f"  python batch_definitions.py status")
    print()
    print("Process results when complete (new definitions will be merged, duplicates skipped):")
    print(f"  python batch_definitions.py process --batch-id {batch_api_id}")
    print()


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Batch definition extraction using Anthropic Message Batches API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python batch_definitions.py submit --state NJ --title 3A
  python batch_definitions.py status
  python batch_definitions.py process --batch-id msgbatch_xxx
  python batch_definitions.py resume --batch-id msgbatch_xxx
  python batch_definitions.py continue --state NY --dry-run

Batch processing provides 50% cost reduction but takes up to 24 hours.
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # Submit command
    submit_parser = subparsers.add_parser('submit', help='Submit sections for batch processing')
    submit_parser.add_argument('--state', required=True, choices=VALID_JURISDICTIONS,
                               help='State to process')
    submit_parser.add_argument('--title', type=str,
                               help='Filter by title (e.g., "3A", "18")')
    submit_parser.add_argument('--chapter', type=str,
                               help='Filter by chapter (e.g., "II", "23")')
    submit_parser.add_argument('--subchapter', type=str,
                               help='Filter by subchapter (e.g., "C")')
    submit_parser.add_argument('--part', type=str,
                               help='Filter by part (e.g., "1202")')
    submit_parser.add_argument('--limit', type=int,
                               help='Max documents to process')
    submit_parser.add_argument('--skip-done', action='store_true',
                               help='Skip documents that already have definitions')
    submit_parser.add_argument('--dry-run', action='store_true',
                               help='Show what would be submitted without actually submitting')

    # Status command
    status_parser = subparsers.add_parser('status', help='Check batch status')
    status_parser.add_argument('--batch-id', type=str,
                               help='Specific batch ID to check')
    status_parser.add_argument('-v', '--verbose', action='store_true',
                               help='Show detailed status for latest batch')

    # Process command
    process_parser = subparsers.add_parser('process', help='Process completed batch results')
    process_parser.add_argument('--batch-id', required=True,
                                help='Batch ID to process')
    process_parser.add_argument('--delete-existing', action='store_true',
                                help='Delete existing definitions for processed documents before inserting')

    # Resume command
    resume_parser = subparsers.add_parser('resume', help='Retry failed requests')
    resume_parser.add_argument('--batch-id', required=True,
                               help='Batch ID to resume')

    # Continue command - process remainder of truncated sections
    continue_parser = subparsers.add_parser('continue', help='Extract from remainder of truncated sections')
    continue_parser.add_argument('--state', required=True, choices=VALID_JURISDICTIONS,
                                 help='State to process')
    continue_parser.add_argument('--limit', type=int,
                                 help='Max sections to process')
    continue_parser.add_argument('--dry-run', action='store_true',
                                 help='Show what would be submitted without actually submitting')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == 'submit':
        cmd_submit(args)
    elif args.command == 'status':
        cmd_status(args)
    elif args.command == 'process':
        cmd_process(args)
    elif args.command == 'resume':
        cmd_resume(args)
    elif args.command == 'continue':
        cmd_continue(args)


if __name__ == '__main__':
    main()
