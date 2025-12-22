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

Usage:
    python batch_definitions.py submit --state NJ --title 3A
    python batch_definitions.py status
    python batch_definitions.py process --batch-id msgbatch_xxx
    python batch_definitions.py resume --batch-id msgbatch_xxx
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from difflib import SequenceMatcher

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PROJECT_ROOT, OUTPUTS_DIR
from shared_utils import (
    get_db_connection,
    get_openai_client,
    get_async_openai_client,
    call_llm_parse,
    call_llm_parse_async,
    format_batch_request,
    load_prompt,
    normalize_scope_level,
    format_time,
    DEFAULT_MODEL,
)

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
    is_verbatim: bool = Field(default=True, description="True if verbatim_text is a complete, usable definition")
    rephrased_definition: Optional[str] = Field(default=None, description="Plain-language definition when verbatim is insufficient")
    scope: Optional[str] = Field(default=None, description="Scope like 'in this section', 'in this part'")
    source_location: Optional[str] = Field(default=None, description="Where it appears, e.g. 'section 1.1'")
    scope_level: Optional[str] = Field(default=None, description="section/subpart/part/chapter/title")
    definition_type: str = Field(default="formal", description="'formal' or 'abbreviation'")
    is_cross_reference: bool = Field(default=False, description="True if points to another definition")


class DefinitionsResponse(BaseModel):
    """Response containing all extracted definitions."""
    definitions: List[Definition] = Field(default_factory=list)


# ============================================================================
# Helper Functions
# ============================================================================

def get_sections_from_db(
    state: str,
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

    prefix = 'njac' if state.upper() == 'NJ' else 'nycrr'

    conditions = [
        "state = %s",
        "hierarchy_level = 'section'",
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
    params = [state.upper()]

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


def has_definition_content(content: str, title: str) -> bool:
    """Check if regulation likely contains definitions."""
    import re
    text = (content + ' ' + title).lower()
    patterns = [
        r'\bdefinition\b',
        r'\bmeans\b',
        r'shall mean',
        r'for purposes of',
    ]
    return any(re.search(p, text) for p in patterns)


def log_extraction(source_index: int, definitions_found: int):
    """Log that a regulation has been processed for definitions."""
    conn = get_db_connection()
    if not conn:
        return

    try:
        conn.execute("""
            INSERT INTO definition_extraction_log (source_index, model_version, definitions_found)
            VALUES (%s, %s, %s)
            ON CONFLICT (source_index) DO UPDATE SET
                processed_at = CURRENT_TIMESTAMP,
                model_version = EXCLUDED.model_version,
                definitions_found = EXCLUDED.definitions_found
        """, (source_index, MODEL_VERSION, definitions_found))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: Could not log extraction: {e}")
        if conn:
            conn.close()


def extract_with_llm(content: str, title: str, client=None, max_retries: int = 3) -> List[Dict]:
    """Extract definitions using LLM with Pydantic structured output (sync)."""
    if client is None:
        client = get_openai_client()

    prompt = load_prompt("definition_extraction", title=title, content=content[:3000])

    parsed = call_llm_parse(
        client=client,
        prompt=prompt,
        response_format=DefinitionsResponse,
        model=MODEL_VERSION,
        max_retries=max_retries
    )

    if parsed is None:
        return []

    return [d.model_dump() for d in parsed.definitions]


async def extract_with_llm_async(content: str, title: str, client=None, max_retries: int = 3) -> List[Dict]:
    """Extract definitions using LLM with Pydantic structured output (async)."""
    if client is None:
        client = get_async_openai_client()

    prompt = load_prompt("definition_extraction", title=title, content=content[:3000])

    parsed = await call_llm_parse_async(
        client=client,
        prompt=prompt,
        response_format=DefinitionsResponse,
        model=MODEL_VERSION,
        max_retries=max_retries
    )

    if parsed is None:
        return []

    return [d.model_dump() for d in parsed.definitions]


def store_to_database(regulations: List[Dict], state: str = "NY"):
    """Store definitions in database from file-based regulations."""
    print(f"Storing results in database...")
    print(f"  Input: {len(regulations)} regulations")

    total_input_defs = sum(len(r.get('llm_definitions', [])) for r in regulations)
    print(f"  Input: {total_input_defs} total definitions")

    conn = get_db_connection()
    if not conn:
        print("  ERROR: Could not connect to database")
        return

    try:
        before_count = conn.execute("SELECT COUNT(*) FROM definitions").fetchone()[0]
        print(f"  Definitions in DB before: {before_count}")

        total_defs = 0
        docs_processed = 0

        for reg in regulations:
            definitions_list = reg.get('llm_definitions', [])
            if not definitions_list:
                continue

            try:
                source_idx = reg.get('source_index', 0)

                # Get document_id from source_index (don't create new docs)
                result = conn.execute("""
                    SELECT id FROM regulatory_documents
                    WHERE source_index = %s AND state = %s
                    LIMIT 1
                """, (source_idx, state.upper())).fetchone()

                if not result:
                    print(f"    Warning: No document found for source_index {source_idx}")
                    continue

                doc_id = result[0]
                docs_processed += 1

                # Delete previous definitions for this document
                conn.execute("DELETE FROM definitions WHERE document_id = %s", (doc_id,))

                # Insert definitions
                reg_url = reg.get('url', '')
                for defn in definitions_list:
                    verbatim_text = defn.get('verbatim_text', '')
                    overlap = calculate_definition_overlap(verbatim_text, reg.get('content', ''))

                    conn.execute("""
                        INSERT INTO definitions
                        (document_id, url, term, verbatim_text, is_verbatim, rephrased_definition,
                         scope, source_location, definition_overlap, model_version,
                         scope_level, definition_type, is_cross_reference)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        doc_id,
                        reg_url,
                        defn.get('term'),
                        verbatim_text,
                        defn.get('is_verbatim', True),
                        defn.get('rephrased_definition'),
                        defn.get('scope'),
                        defn.get('source_location'),
                        overlap,
                        MODEL_VERSION,
                        normalize_scope_level(defn.get('scope_level')) if defn.get('scope_level') else None,
                        defn.get('definition_type', 'formal'),
                        defn.get('is_cross_reference', False),
                    ))
                    total_defs += 1

            except Exception as doc_err:
                print(f"    ERROR processing reg {reg.get('title', 'unknown')[:40]}: {doc_err}")

        conn.commit()

        after_count = conn.execute("SELECT COUNT(*) FROM definitions").fetchone()[0]
        print(f"  Definitions in DB after: {after_count} (added {after_count - before_count})")
        print(f"  Stored {docs_processed} regulations with {total_defs} definitions")

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


def generate_viewer(regulations: List[Dict]):
    """Generate HTML viewer for local browsing."""
    html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LLM Extracted Definitions</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f5f5f5; }
        .header { background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .reg-item { background: white; padding: 20px; margin-bottom: 15px; border-radius: 5px; }
        .reg-title { font-size: 1.1em; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
        .reg-meta { font-size: 0.9em; color: #666; margin-bottom: 15px; }
        .definitions { margin-top: 15px; }
        .def-item { background: #f9f9f9; padding: 10px; margin: 8px 0; border-left: 3px solid #3498db; }
        .def-term { font-weight: bold; color: #2c3e50; }
        .def-text { color: #555; margin-top: 5px; font-size: 0.9em; }
        .def-scope { font-size: 0.85em; color: #888; margin-top: 5px; font-style: italic; }
    </style>
</head>
<body>
    <div class="header">
        <h1>LLM Extracted Definitions</h1>
    </div>
"""

    for reg in regulations:
        defs = reg.get('llm_definitions', [])
        if not defs:
            continue

        html += f"""
    <div class="reg-item">
        <div class="reg-title">{reg.get('title', 'Unknown')}</div>
        <div class="reg-meta">
            <strong>URL:</strong> <a href="{reg.get('url', '#')}" target="_blank">{reg.get('url', 'N/A')}</a>
        </div>
        <div class="definitions">
            <strong>{len(defs)} definitions extracted:</strong>
"""

        for defn in defs:
            term = defn.get('term', 'Unknown')
            display_def = defn.get('verbatim_text', '') if defn.get('is_verbatim', True) else (defn.get('rephrased_definition') or defn.get('verbatim_text', ''))
            scope = defn.get('scope')
            scope_text = f"<div class='def-scope'>Scope: {scope}</div>" if scope else ""

            html += f"""
            <div class="def-item">
                <div class="def-term">{term}</div>
                <div class="def-text">{display_def[:200]}{'...' if len(display_def) > 200 else ''}</div>
                {scope_text}
            </div>
"""

        html += """
        </div>
    </div>
"""

    html += """
</body>
</html>
"""

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUTS_DIR / "viewer_extracted_definitions.html"
    with open(output_file, 'w') as f:
        f.write(html)

    print(f"  Viewer generated: {output_file}")


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
    if args.limit:
        print(f"      Limit: {args.limit}")

    sections = get_sections_from_db(
        state=args.state,
        title=args.title,
        chapter=args.chapter,
        limit=args.limit,
    )

    if not sections:
        print("No sections found matching criteria!")
        return

    print(f"      ✓ Found {len(sections)} sections")
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

    # Format requests
    requests = []
    doc_ids = []
    for section in sections:
        prompt = load_prompt(
            "definition_extraction",
            title=section['title'],
            content=section['content'][:3000]
        )
        request = format_batch_request(
            custom_id=f"doc_{section['id']}",
            prompt=prompt,
            response_format=DefinitionsResponse
        )
        requests.append(request)
        doc_ids.append(section['id'])

    print(f"      ✓ Formatted {len(requests)} requests")
    print()

    # Submit batch
    print(f"[3/3] Submitting to Anthropic Batch API...")

    client = get_openai_client()
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

    client = get_openai_client()

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
    print("[1/4] Checking batch status...")
    client = get_openai_client()

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
    print("[2/4] Retrieving and processing results...")
    print(f"      Streaming {batch_info.get('total_requests', 0)} results...")
    sys.stdout.flush()

    try:
        results_iter = client.beta.messages.batches.results(batch_id)
    except Exception as e:
        print(f"      ❌ Could not retrieve results: {e}")
        return

    # Process results and store definitions
    print("[3/4] Processing results and storing definitions...")
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
    succeeded = 0
    errored = 0
    processed = 0
    total_expected = batch_info.get('total_requests', 0)
    start_time = time.time()

    for result in results_iter:
        custom_id = result.custom_id
        doc_id = int(custom_id.replace('doc_', ''))

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

            # Store definitions
            for defn in definitions:
                verbatim_text = defn.verbatim_text
                overlap = calculate_definition_overlap(verbatim_text, section_content)

                conn.execute("""
                    INSERT INTO definitions
                    (document_id, url, term, verbatim_text, is_verbatim, rephrased_definition,
                     scope, source_location, definition_overlap, model_version,
                     scope_level, definition_type, is_cross_reference)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    doc_id,
                    section_url,
                    defn.term,
                    verbatim_text,
                    defn.is_verbatim,
                    defn.rephrased_definition,
                    defn.scope,
                    defn.source_location,
                    overlap,
                    DEFAULT_MODEL,
                    normalize_scope_level(defn.scope_level) if defn.scope_level else None,
                    defn.definition_type,
                    defn.is_cross_reference,
                ))
                total_defs += 1

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
    print()

    # Update batch info
    batch_info['status'] = 'processed'
    batch_info['processed_at'] = datetime.now().isoformat()
    batch_info['definitions_stored'] = total_defs
    batch_info['sections_succeeded'] = succeeded
    batch_info['sections_errored'] = errored

    with open(info_file, 'w') as f:
        json.dump(batch_info, f, indent=2)

    # Run scope document linking
    print("[4/4] Linking scope documents...")

    try:
        from populate_scope_documents import populate_scope_document_ids
        populate_scope_document_ids(dry_run=False)
    except Exception as e:
        print(f"      ⚠️  Could not run scope linking: {e}")
        print("      Run manually: python populate_scope_documents.py")

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

    # Format requests
    requests = []
    doc_ids = []
    for section in sections_list:
        prompt = load_prompt(
            "definition_extraction",
            title=section['title'],
            content=section['content'][:3000]
        )
        request = format_batch_request(
            custom_id=f"doc_{section['id']}",
            prompt=prompt,
            response_format=DefinitionsResponse
        )
        requests.append(request)
        doc_ids.append(section['id'])

    print(f"      ✓ Formatted {len(requests)} requests")
    print()

    # Submit new batch
    print(f"[2/2] Submitting retry batch...")

    client = get_openai_client()
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

Batch processing provides 50% cost reduction but takes up to 24 hours.
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # Submit command
    submit_parser = subparsers.add_parser('submit', help='Submit sections for batch processing')
    submit_parser.add_argument('--state', required=True, choices=['NY', 'NJ'],
                               help='State to process')
    submit_parser.add_argument('--title', type=str,
                               help='Title to filter (e.g., "3A")')
    submit_parser.add_argument('--chapter', type=str,
                               help='Chapter to filter')
    submit_parser.add_argument('--limit', type=int,
                               help='Max documents to process')
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


if __name__ == '__main__':
    main()
