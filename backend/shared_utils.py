"""
Shared utilities for NY regulations backend scripts.

Consolidates duplicate code (DB connections, LLM calls, parsing, etc.)
to reduce duplication and enable easier maintenance.
"""

import os
import time
import json
import asyncio
from pathlib import Path
from typing import Optional, Type, Any, Dict
import yaml
import psycopg
from psycopg import Connection
import anthropic
from pydantic import BaseModel


# ============================================================================
# Prompt Loading Utilities
# ============================================================================

# Cache for loaded prompts
_prompts_cache: Optional[Dict] = None


def _get_prompts_path() -> Path:
    """Get the path to prompts.yaml in the project root."""
    # shared_utils.py is in backend/, prompts.yaml is in root
    return Path(__file__).parent.parent / "prompts.yaml"


def _load_prompts() -> Dict:
    """Load prompts from YAML file (cached)."""
    global _prompts_cache
    if _prompts_cache is None:
        prompts_path = _get_prompts_path()
        with open(prompts_path, 'r') as f:
            _prompts_cache = yaml.safe_load(f)
    return _prompts_cache


def load_prompt(prompt_name: str, **kwargs) -> str:
    """
    Load a prompt template and fill in variables.

    Args:
        prompt_name: Name of the prompt in prompts.yaml (e.g., "red_flags_analysis")
        **kwargs: Variables to substitute in the template (e.g., section_text="...", citation="...")

    Returns:
        Formatted prompt string with variables filled in

    Example:
        prompt = load_prompt("red_flags_analysis",
                            section_text="The regulation text...",
                            citation="N.J.A.C. 1:1-1.1",
                            heading="General Provisions")
    """
    prompts = _load_prompts()

    if prompt_name not in prompts:
        available = list(prompts.keys())
        raise ValueError(f"Unknown prompt '{prompt_name}'. Available: {available}")

    prompt_data = prompts[prompt_name]
    template = prompt_data.get("template", "")

    # Fill in variables
    return template.format(**kwargs)


def load_prompt_parts(prompt_name: str, **kwargs) -> dict:
    """
    Load a prompt with separate system and user parts for optimal caching.

    For Anthropic's prompt caching to work, static content should go in
    the system message (cached across requests) and dynamic content in
    the user message (unique per request).

    Args:
        prompt_name: Name of the prompt in prompts.yaml
        **kwargs: Variables for the user template

    Returns:
        Dict with 'system' (static, cached) and 'user' (dynamic) keys.
        If prompt has no 'system' key, returns {'system': None, 'user': formatted_template}

    Example:
        parts = load_prompt_parts("definition_extraction", title="...", content="...")
        # parts = {'system': "You are an expert...", 'user': "Extract from: ..."}
    """
    prompts = _load_prompts()

    if prompt_name not in prompts:
        available = list(prompts.keys())
        raise ValueError(f"Unknown prompt '{prompt_name}'. Available: {available}")

    prompt_data = prompts[prompt_name]

    system = prompt_data.get("system")  # Static, cacheable
    template = prompt_data.get("template", "")  # Dynamic per-request

    return {
        "system": system.strip() if system else None,
        "user": template.format(**kwargs) if template else None,
    }


def get_prompt_description(prompt_name: str) -> str:
    """Get the description of a prompt."""
    prompts = _load_prompts()
    if prompt_name not in prompts:
        raise ValueError(f"Unknown prompt '{prompt_name}'")
    return prompts[prompt_name].get("description", "")


def list_prompts() -> list:
    """List all available prompt names."""
    prompts = _load_prompts()
    return list(prompts.keys())


def get_db_connection(timeout: int = 30) -> Optional[Connection]:
    """
    Create connection to Neon PostgreSQL database.

    Consolidates duplicate implementation from multiple scripts.
    Used by: migrate_regulations, populate_parent_ids, analyze_definition_usage,
             analyze_red_flags, run_pipeline, extract_definitions

    Args:
        timeout: Connection timeout in seconds

    Returns:
        Connection object, or None if connection fails or DATABASE_URL not set
    """
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("Warning: DATABASE_URL not set in .env")
            return None

        conn = psycopg.connect(database_url, connect_timeout=timeout)

        # Set statement timeout (Neon pooler compatibility)
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '300000ms'")  # 5 minute timeout

        return conn
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        return None


# ============================================================================
# Definition Utilities
# ============================================================================

def normalize_scope_level(scope_level: str) -> str:
    """
    Normalize scope_level to match hierarchy_level values.
    Only handles obvious variations like capitalization and pluralization.

    This should be called when storing definitions to ensure consistent
    scope_level values that can be linked to the document hierarchy.

    Args:
        scope_level: Raw scope level from LLM extraction (e.g., "Part", "Sections")

    Returns:
        Normalized scope level (e.g., "part", "section")
    """
    if not scope_level:
        return ""

    # Lowercase and strip whitespace
    level = scope_level.lower().strip()

    # Handle common pluralizations (remove trailing 's')
    # Valid hierarchy levels: title, subtitle, chapter, subchapter, article, part, subpart, section
    singular_forms = {
        'titles': 'title',
        'subtitles': 'subtitle',
        'chapters': 'chapter',
        'subchapters': 'subchapter',
        'articles': 'article',
        'parts': 'part',
        'subparts': 'subpart',
        'sections': 'section',
    }

    return singular_forms.get(level, level)


# =============================================================================
# FILTERING AND SKIP-IF-DONE HELPERS
# =============================================================================

def get_filtered_documents(
    state: str,
    title: str = None,
    chapter: str = None,
    subchapter: str = None,
    part: str = None,
    hierarchy_level: str = None,
    limit: int = None,
) -> list:
    """
    Query regulatory_documents with hierarchy filters.

    Args:
        state: 'NY' or 'NJ'
        title: Filter by nycrr_title/njac_title
        chapter: Filter by nycrr_chapter/njac_chapter
        subchapter: Filter by nycrr_subchapter/njac_subchapter
        part: Filter by nycrr_part/njac_part
        hierarchy_level: Filter by hierarchy_level (e.g., 'section')
        limit: Max rows to return

    Returns:
        List of dicts with id, title, content, url, and hierarchy fields
    """
    conn = get_db_connection()
    if not conn:
        return []

    prefix = 'njac' if state.upper() == 'NJ' else 'nycrr'

    conditions = ["state = %s"]
    params = [state.upper()]

    if title:
        conditions.append(f"{prefix}_title = %s")
        params.append(title)

    if chapter:
        conditions.append(f"{prefix}_chapter = %s")
        params.append(chapter)

    if subchapter:
        conditions.append(f"{prefix}_subchapter = %s")
        params.append(subchapter)

    if part:
        conditions.append(f"{prefix}_part = %s")
        params.append(part)

    if hierarchy_level:
        conditions.append("hierarchy_level = %s")
        params.append(hierarchy_level)

    query = f"""
        SELECT id, title, content, url, hierarchy_level, hierarchy_path,
               {prefix}_title, {prefix}_chapter, {prefix}_subchapter, {prefix}_part, {prefix}_section
        FROM regulatory_documents
        WHERE {' AND '.join(conditions)}
        ORDER BY id
    """

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    try:
        rows = conn.execute(query, params).fetchall()
        conn.close()

        results = []
        for row in rows:
            results.append({
                'id': row[0],
                'title': row[1],
                'content': row[2],
                'url': row[3],
                'hierarchy_level': row[4],
                'hierarchy_path': row[5],
                f'{prefix}_title': row[6],
                f'{prefix}_chapter': row[7],
                f'{prefix}_subchapter': row[8],
                f'{prefix}_part': row[9],
                f'{prefix}_section': row[10],
            })
        return results
    except Exception as e:
        print(f"ERROR querying documents: {e}")
        if conn:
            conn.close()
        return []


def get_already_analyzed_ids(state: str) -> set:
    """Get document IDs that already have red flag analyses."""
    conn = get_db_connection()
    if not conn:
        return set()

    try:
        result = conn.execute("""
            SELECT DISTINCT document_id
            FROM analyses
            WHERE is_current = TRUE
              AND document_id IN (
                  SELECT id FROM regulatory_documents WHERE state = %s
              )
        """, (state.upper(),))
        ids = {row[0] for row in result.fetchall()}
        conn.close()
        return ids
    except Exception as e:
        print(f"Warning: Could not fetch analyzed IDs: {e}")
        if conn:
            conn.close()
        return set()


def get_already_extracted_ids(state: str) -> set:
    """Get document IDs that already have definitions extracted."""
    conn = get_db_connection()
    if not conn:
        return set()

    try:
        result = conn.execute("""
            SELECT DISTINCT document_id
            FROM definitions
            WHERE document_id IN (
                SELECT id FROM regulatory_documents WHERE state = %s
            )
        """, (state.upper(),))
        ids = {row[0] for row in result.fetchall()}
        conn.close()
        return ids
    except Exception as e:
        print(f"Warning: Could not fetch extracted IDs: {e}")
        if conn:
            conn.close()
        return set()


def format_time(seconds: float) -> str:
    """
    Format seconds into human-readable time string.

    Args:
        seconds: Number of seconds to format

    Returns:
        Formatted string like "45s", "5m 30s", or "2h 15m"
    """
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m {secs}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h {mins}m"


# ============================================================================
# LLM Utilities (Anthropic)
# ============================================================================

# Default model
DEFAULT_MODEL = "claude-haiku-4-5-20251001"


def get_openai_client(api_key: Optional[str] = None) -> anthropic.Anthropic:
    """
    Create Anthropic client (sync).
    Named get_openai_client for backwards compatibility.

    Args:
        api_key: API key (default: ANTHROPIC_API_KEY env var)

    Returns:
        Anthropic client instance
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=api_key)


def get_async_openai_client(api_key: Optional[str] = None) -> anthropic.AsyncAnthropic:
    """
    Create AsyncAnthropic client (async).
    Named get_async_openai_client for backwards compatibility.

    Args:
        api_key: API key (default: ANTHROPIC_API_KEY env var)

    Returns:
        AsyncAnthropic client instance
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    return anthropic.AsyncAnthropic(api_key=api_key)


def _pydantic_to_tool_schema(model: Type[BaseModel]) -> dict:
    """Convert a Pydantic model to Anthropic tool schema."""
    schema = model.model_json_schema()
    return {
        "name": model.__name__,
        "description": f"Extract {model.__name__} from the text",
        "input_schema": schema
    }


def call_llm_parse(
    client: anthropic.Anthropic,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    max_retries: int = 3,
) -> Optional[BaseModel]:
    """
    Call Anthropic API with structured output (Pydantic model via tool_use).

    Handles retries automatically.

    Args:
        client: Anthropic client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=64000,
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=[{"role": "user", "content": prompt}],
            )

            # Check for truncation due to max_tokens
            if response.stop_reason == "max_tokens":
                print(
                    f"      ⚠️  Response truncated (stop_reason=max_tokens). "
                    f"Output may be incomplete."
                )

            # Extract tool use from response
            tool_use = None
            for block in response.content:
                if block.type == "tool_use":
                    tool_use = block
                    break

            if tool_use is None:
                print(
                    f"      ⚠️  No tool_use in response (attempt {attempt + 1}/{max_retries})"
                )
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to get tool_use")
                    return None

            # Parse the tool input with Pydantic
            parsed = response_format.model_validate(tool_use.input)

            if attempt > 0:
                print(f"      ✓ Success on attempt {attempt + 1}")

            return parsed

        except Exception as e:
            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            print(f"      ❌ All {max_retries} attempts failed")
            return None

    return None


def format_batch_request(
    custom_id: str,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    system: str = None,
) -> dict:
    """
    Format a single request for Anthropic Message Batches API submission.

    Used by batch_definitions.py for async batch processing.

    Args:
        custom_id: Unique identifier for matching results (e.g., "doc_12345")
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        system: Optional system message (static, cached across requests)

    Returns:
        Dict formatted for client.beta.messages.batches.create()

    Example with caching:
        parts = load_prompt_parts("definition_extraction", title=title, content=content)
        request = format_batch_request(
            custom_id=f"doc_{doc_id}",
            prompt=parts['user'],
            response_format=DefinitionsResponse,
            system=parts['system'],  # Cached across all requests in batch
        )

    Example without system (backwards compatible):
        request = format_batch_request(
            custom_id=f"doc_{doc_id}",
            prompt=load_prompt("red_flags_analysis", ...),
            response_format=RegulationAnalysis
        )
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    params = {
        "model": model,
        "max_tokens": 64000,
        "messages": [{"role": "user", "content": prompt}],
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": tool["name"]},
    }

    # Add system message for caching if provided
    if system:
        params["system"] = system

    return {
        "custom_id": custom_id,
        "params": params,
    }


async def call_llm_parse_async(
    client: anthropic.AsyncAnthropic,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    max_retries: int = 3,
) -> Optional[BaseModel]:
    """
    Call Anthropic API async with structured output (Pydantic model via tool_use).

    Handles retries automatically.

    Args:
        client: AsyncAnthropic client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    for attempt in range(max_retries):
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=64000,
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=[{"role": "user", "content": prompt}],
            )

            # Check for truncation due to max_tokens
            if response.stop_reason == "max_tokens":
                print(
                    f"      ⚠️  Response truncated (stop_reason=max_tokens). "
                    f"Output may be incomplete."
                )

            # Extract tool use from response
            tool_use = None
            for block in response.content:
                if block.type == "tool_use":
                    tool_use = block
                    break

            if tool_use is None:
                print(
                    f"      ⚠️  No tool_use in response (attempt {attempt + 1}/{max_retries})"
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to get tool_use")
                    return None

            # Parse the tool input with Pydantic
            parsed = response_format.model_validate(tool_use.input)

            if attempt > 0:
                print(f"      ✓ Success on attempt {attempt + 1}")

            return parsed

        except Exception as e:
            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            print(f"      ❌ All {max_retries} attempts failed")
            return None

    return None


# ============================================================================
# Database Migration Utilities
# ============================================================================

def get_state_config(state: str) -> dict:
    """Get configuration for a state's regulation fields."""
    if state == "NJ":
        return {
            "prefix": "njac",
            "fields": [
                "njac_title", "njac_title_name",
                "njac_subtitle", "njac_subtitle_name",
                "njac_chapter", "njac_chapter_name",
                "njac_subchapter", "njac_subchapter_name",
                "njac_article", "njac_article_name",
                "njac_part", "njac_part_name",
                "njac_subpart", "njac_subpart_name",
                "njac_section", "njac_section_name",
            ]
        }
    elif state == "NY":
        return {
            "prefix": "nycrr",
            "fields": [
                "nycrr_title", "nycrr_title_name",
                "nycrr_subtitle", "nycrr_subtitle_name",
                "nycrr_chapter", "nycrr_chapter_name",
                "nycrr_subchapter", "nycrr_subchapter_name",
                "nycrr_article", "nycrr_article_name",
                "nycrr_part", "nycrr_part_name",
                "nycrr_subpart", "nycrr_subpart_name",
                "nycrr_section", "nycrr_section_name",
            ]
        }
    else:
        raise ValueError(f"Unknown state: {state}")


def migrate_regulations_to_db(state: str, regulations: list = None, reg_dir: Path = None) -> int:
    """
    Migrate regulations to database using upsert (ON CONFLICT).

    This preserves existing IDs by matching on (state, source_index, type).

    Args:
        state: State code ('NY' or 'NJ')
        regulations: List of regulation dicts (from scraper or JSON files)
        reg_dir: Optional directory to load from JSON files instead

    Returns:
        Number of regulations migrated
    """
    config = get_state_config(state)
    fields = config["fields"]

    # If reg_dir provided, load from JSON files
    if reg_dir is not None:
        json_files = list(Path(reg_dir).glob("*.json"))
        if not json_files:
            print(f"✗ No JSON files found in {reg_dir}/")
            return 0
        regulations = []
        for json_file in sorted(json_files):
            with open(json_file) as f:
                regulations.append(json.load(f))

    if not regulations:
        print(f"✗ No regulations to migrate")
        return 0

    print(f"Migrating {len(regulations):,} {state} regulations to database...")

    # Build SQL dynamically based on state fields
    field_names = ", ".join(fields)
    field_placeholders = ", ".join(["%s"] * len(fields))
    field_updates = ", ".join([f"{f} = EXCLUDED.{f}" for f in fields])

    insert_sql = f"""
        INSERT INTO regulatory_documents
        (source_index, type, state, title, url, url_type, content,
         hierarchy_level, hierarchy_path, {field_names}, scraped_from_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, {field_placeholders}, %s)
        ON CONFLICT (state, source_index, type) DO UPDATE SET
            title = EXCLUDED.title,
            url = EXCLUDED.url,
            content = EXCLUDED.content,
            hierarchy_level = EXCLUDED.hierarchy_level,
            hierarchy_path = EXCLUDED.hierarchy_path,
            {field_updates},
            scraped_from_url = EXCLUDED.scraped_from_url
    """

    total = 0
    conn = None
    cur = None
    commit_every = 50

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        for reg in regulations:
            retries = 3
            while retries > 0:
                try:
                    # Base fields
                    row = [
                        reg.get("source_index"),
                        "regulation",
                        state,
                        reg.get("title", ""),
                        reg.get("url", ""),
                        reg.get("url_type", "regulation"),
                        reg.get("content", ""),
                        reg.get("hierarchy_level"),
                        reg.get("hierarchy_path"),
                    ]

                    # State-specific hierarchy fields
                    for field in fields:
                        row.append(reg.get(field))

                    # Trailing field
                    row.append(reg.get("scraped_from_url"))

                    cur.execute(insert_sql, row)
                    total += 1

                    if total % commit_every == 0:
                        conn.commit()

                    if total % 1000 == 0:
                        print(f"  ✓ {total:,} / {len(regulations):,}")

                    break

                except (psycopg.OperationalError, psycopg.InterfaceError):
                    retries -= 1
                    print(f"  ⚠ Connection error, retries: {retries}")
                    if retries > 0:
                        time.sleep(2)
                        try:
                            cur.close()
                            conn.close()
                        except:
                            pass
                        conn = get_db_connection()
                        cur = conn.cursor()
                    else:
                        raise

        conn.commit()

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    print(f"✓ Migrated {total:,} {state} regulations")
    return total


def populate_parent_ids(state: str, regulations: list = None, reg_dir: Path = None):
    """
    Populate parent_id for regulations by converting parent_source_index to parent_id.

    Args:
        state: State code ('NY' or 'NJ')
        regulations: List of regulation dicts with parent_source_index
        reg_dir: Optional directory to load parent mappings from JSON files
    """
    # Build parent mappings
    parent_mappings = {}

    if reg_dir is not None:
        print(f"Loading {state} parent mappings from {reg_dir}...")
        for filepath in Path(reg_dir).glob("*.json"):
            try:
                with open(filepath) as f:
                    data = json.load(f)
                si = data.get('source_index')
                psi = data.get('parent_source_index')
                if si is not None:
                    parent_mappings[si] = psi
            except:
                continue
    elif regulations is not None:
        print(f"Loading {state} parent mappings from {len(regulations)} regulations...")
        for reg in regulations:
            si = reg.get('source_index')
            psi = reg.get('parent_source_index')
            if si is not None:
                parent_mappings[si] = psi
    else:
        print("✗ No regulations or reg_dir provided")
        return

    with_parents = sum(1 for v in parent_mappings.values() if v is not None)
    roots = sum(1 for v in parent_mappings.values() if v is None)
    print(f"  {len(parent_mappings):,} docs, {with_parents:,} have parents, {roots:,} are roots")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            source_to_id = {r[1]: r[0] for r in cur.fetchall() if r[1] is not None}

            # First, clear ALL parent_ids for this state (to remove stale data)
            print(f"  Clearing existing parent_ids...")
            cur.execute("""
                UPDATE regulatory_documents SET parent_id = NULL
                WHERE state = %s AND type = 'regulation'
            """, (state,))

            # Now set parent_ids for docs that have parents
            updates = []
            for si, psi in parent_mappings.items():
                if psi is None:
                    continue
                child_id = source_to_id.get(si)
                parent_id = source_to_id.get(psi)
                if child_id and parent_id:
                    updates.append((parent_id, child_id))

            print(f"  Applying {len(updates):,} parent updates...")
            cur.executemany("UPDATE regulatory_documents SET parent_id = %s WHERE id = %s", updates)
            conn.commit()

    print(f"✓ Updated {len(updates):,} {state} parent relationships ({roots:,} roots with no parent)")


def cleanup_stale_documents(state: str, valid_source_indices: set = None, reg_dir: Path = None):
    """
    Remove documents from DB that aren't in current data.

    Args:
        state: State code ('NY' or 'NJ')
        valid_source_indices: Set of valid source_index values
        reg_dir: Optional directory to load valid indices from JSON files
    """
    if valid_source_indices is None and reg_dir is not None:
        print(f"Loading valid {state} source_indices from {reg_dir}...")
        valid_source_indices = set()
        for filepath in Path(reg_dir).glob("*.json"):
            try:
                with open(filepath) as f:
                    data = json.load(f)
                si = data.get('source_index')
                if si is not None:
                    valid_source_indices.add(si)
            except:
                continue
    elif valid_source_indices is None:
        print("✗ No valid_source_indices or reg_dir provided")
        return

    print(f"  {len(valid_source_indices):,} valid documents")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_index FROM regulatory_documents
                WHERE state = %s AND type = 'regulation'
            """, (state,))
            db_docs = cur.fetchall()

            stale_ids = [doc_id for doc_id, si in db_docs if si not in valid_source_indices]

            if not stale_ids:
                print(f"  No stale documents to remove")
                return

            print(f"  Found {len(stale_ids):,} stale documents to remove...")

            # Delete in batches
            batch_size = 100
            for i in range(0, len(stale_ids), batch_size):
                batch = stale_ids[i:i + batch_size]
                cur.execute("""
                    DELETE FROM regulatory_documents
                    WHERE id = ANY(%s)
                """, (batch,))

            conn.commit()

    print(f"✓ Removed {len(stale_ids):,} stale {state} documents")


# ============================================================================
# Hierarchy Stats Utilities
# ============================================================================

def refresh_structure_stats(conn, state: str) -> int:
    """
    Refresh structural hierarchy stats (children counts) for all documents.

    Updates: direct_child_count, descendant_count

    Should be called after data import.
    """
    print(f"  Computing structure stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Direct children count
        cur.execute("""
            WITH direct_children AS (
                SELECT parent_id, COUNT(*) as direct_child_count
                FROM regulatory_documents
                WHERE state = %s AND parent_id IS NOT NULL
                GROUP BY parent_id
            ),
            structure_stats AS (
                SELECT
                    rd.id,
                    COALESCE(dc.direct_child_count, 0) as direct_child_count
                FROM regulatory_documents rd
                LEFT JOIN direct_children dc ON rd.id = dc.parent_id
                WHERE rd.state = %s
            )
            UPDATE regulatory_documents rd
            SET direct_child_count = ss.direct_child_count
            FROM structure_stats ss
            WHERE rd.id = ss.id
        """, (state, state))

        conn.commit()

        # Descendants using recursive CTE
        cur.execute("""
            WITH RECURSIVE all_descendants AS (
                SELECT id, parent_id, 1 as depth
                FROM regulatory_documents
                WHERE state = %s

                UNION ALL

                SELECT ad.id, p.parent_id, ad.depth + 1
                FROM all_descendants ad
                JOIN regulatory_documents p ON p.id = ad.parent_id
                WHERE ad.depth < 100
            ),
            descendant_counts AS (
                SELECT parent_id, COUNT(DISTINCT id) as descendant_count
                FROM all_descendants
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET descendant_count = COALESCE(dc.descendant_count, 0)
            FROM descendant_counts dc
            WHERE rd.id = dc.parent_id
        """, (state,))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_analysis_stats(conn, state: str) -> int:
    """
    Refresh analysis-related hierarchy stats.

    Updates: descendant_flag_count, descendant_max_severity, has_descendant_analysis

    Should be called after red flag analysis.
    """
    print(f"  Computing analysis stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        cur.execute("""
            WITH RECURSIVE descendant_analysis AS (
                SELECT
                    rd.id as descendant_id,
                    rd.parent_id,
                    COALESCE(a.num_flags, 0) as num_flags,
                    a.max_severity,
                    a.id IS NOT NULL as has_analysis
                FROM regulatory_documents rd
                LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
                WHERE rd.state = %s

                UNION ALL

                SELECT
                    da.descendant_id,
                    p.parent_id,
                    da.num_flags,
                    da.max_severity,
                    da.has_analysis
                FROM descendant_analysis da
                JOIN regulatory_documents p ON p.id = da.parent_id
            ),
            analysis_stats AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(num_flags), 0)::int as descendant_flag_count,
                    MAX(max_severity) as descendant_max_severity,
                    BOOL_OR(has_analysis) as has_descendant_analysis
                FROM descendant_analysis
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET
                descendant_flag_count = ast.descendant_flag_count,
                descendant_max_severity = ast.descendant_max_severity,
                has_descendant_analysis = COALESCE(ast.has_descendant_analysis, false)
            FROM analysis_stats ast
            WHERE rd.id = ast.id AND rd.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_compliance_stats(conn, state: str) -> int:
    """
    Refresh compliance issue stats.

    Updates: compliance_issue_count, descendant_compliance_issue_count

    Should be called after compliance issue detection.
    """
    print(f"  Computing compliance stats for {state}...")
    start = time.time()

    with conn.cursor() as cur:
        # Direct compliance issue counts
        cur.execute("""
            WITH direct_issues AS (
                SELECT document_id, COUNT(*) as issue_count
                FROM compliance_issues
                WHERE state = %s
                GROUP BY document_id
            )
            UPDATE regulatory_documents rd
            SET compliance_issue_count = COALESCE(di.issue_count, 0)
            FROM (
                SELECT rd2.id, COALESCE(di.issue_count, 0) as issue_count
                FROM regulatory_documents rd2
                LEFT JOIN direct_issues di ON rd2.id = di.document_id
                WHERE rd2.state = %s
            ) di
            WHERE rd.id = di.id
        """, (state, state))

        conn.commit()

        # Descendant compliance issue counts
        cur.execute("""
            WITH RECURSIVE descendant_issues AS (
                SELECT
                    rd.id as descendant_id,
                    rd.parent_id,
                    COALESCE(rd.compliance_issue_count, 0) as issue_count
                FROM regulatory_documents rd
                WHERE rd.state = %s

                UNION ALL

                SELECT
                    di.descendant_id,
                    p.parent_id,
                    di.issue_count
                FROM descendant_issues di
                JOIN regulatory_documents p ON p.id = di.parent_id
            ),
            descendant_counts AS (
                SELECT
                    parent_id as id,
                    COALESCE(SUM(issue_count), 0)::int as descendant_compliance_issue_count
                FROM descendant_issues
                WHERE parent_id IS NOT NULL
                GROUP BY parent_id
            )
            UPDATE regulatory_documents rd
            SET descendant_compliance_issue_count = dc.descendant_compliance_issue_count
            FROM descendant_counts dc
            WHERE rd.id = dc.id AND rd.state = %s
        """, (state, state))

        updated_count = cur.rowcount
        conn.commit()

    elapsed = time.time() - start
    print(f"    Updated {updated_count:,} documents in {elapsed:.1f}s")
    return updated_count


def refresh_all_stats(conn, state: str) -> int:
    """
    Refresh ALL hierarchy stats (structural, analysis, and compliance).

    Returns the number of documents updated.
    """
    print(f"Refreshing all hierarchy stats for {state}...")
    start = time.time()

    updated1 = refresh_structure_stats(conn, state)
    updated2 = refresh_analysis_stats(conn, state)
    updated3 = refresh_compliance_stats(conn, state)

    elapsed = time.time() - start
    updated_count = max(updated1, updated2, updated3)
    print(f"✓ All stats complete in {elapsed:.1f}s")
    return updated_count


# ============================================================================
# Batch API Helpers
# ============================================================================

from datetime import datetime


class BatchManager:
    """
    Manages Anthropic Message Batches API operations.

    Provides a reusable interface for:
    - Submitting batches
    - Checking batch status
    - Processing batch results
    - Managing batch directories for caching

    Usage:
        manager = BatchManager(batches_dir=Path("data/outputs/batches"))

        # Submit a batch
        batch_id = manager.submit_batch(
            requests=formatted_requests,
            batch_name="red_flags_NJ_3A",
            metadata={"state": "NJ", "title": "3A"}
        )

        # Check status
        status = manager.get_batch_status(batch_id)

        # Process results when complete
        for result in manager.get_batch_results(batch_id):
            # result has custom_id, result.type, result.message, etc.
            pass
    """

    def __init__(self, batches_dir: Path = None, client=None):
        """
        Initialize batch manager.

        Args:
            batches_dir: Directory to store batch metadata (default: None, no caching)
            client: Anthropic client (default: creates one using env var)
        """
        self.batches_dir = batches_dir
        self.client = client or get_openai_client()

        if batches_dir:
            batches_dir.mkdir(parents=True, exist_ok=True)

    def submit_batch(
        self,
        requests: list,
        batch_name: str = None,
        metadata: dict = None,
    ) -> str:
        """
        Submit a batch of requests to Anthropic.

        Args:
            requests: List of formatted batch requests (from format_batch_request)
            batch_name: Optional name for the batch directory
            metadata: Optional metadata to store with batch info

        Returns:
            Batch API ID (e.g., "msgbatch_xxx")

        Raises:
            Exception if batch submission fails
        """
        batch = self.client.beta.messages.batches.create(requests=requests)
        batch_id = batch.id

        # Save batch info locally if batches_dir is set
        if self.batches_dir:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            dir_name = f"{batch_name}_{timestamp}" if batch_name else f"batch_{timestamp}"
            batch_dir = self.batches_dir / dir_name
            batch_dir.mkdir(parents=True, exist_ok=True)

            batch_info = {
                'batch_api_id': batch_id,
                'created_at': datetime.now().isoformat(),
                'total_requests': len(requests),
                'status': 'submitted',
                **(metadata or {}),
            }

            with open(batch_dir / 'batch_info.json', 'w') as f:
                json.dump(batch_info, f, indent=2)

        return batch_id

    def get_batch_status(self, batch_id: str) -> dict:
        """
        Get status of a batch.

        Args:
            batch_id: Batch API ID

        Returns:
            Dict with:
                - status: 'in_progress', 'ended', 'canceling', 'canceled'
                - succeeded: count of succeeded requests
                - errored: count of errored requests
                - expired: count of expired requests
                - processing: count of still-processing requests
                - total: total request count
        """
        batch = self.client.beta.messages.batches.retrieve(batch_id)
        counts = batch.request_counts

        return {
            'status': batch.processing_status,
            'succeeded': counts.succeeded if counts else 0,
            'errored': counts.errored if counts else 0,
            'expired': counts.expired if counts else 0,
            'canceled': counts.canceled if counts else 0,
            'processing': counts.processing if counts else 0,
            'total': (counts.succeeded + counts.errored + counts.expired +
                     counts.canceled + counts.processing) if counts else 0,
        }

    def get_batch_results(self, batch_id: str):
        """
        Get results from a completed batch.

        Args:
            batch_id: Batch API ID

        Yields:
            Result objects with:
                - custom_id: The ID you provided when submitting
                - result.type: 'succeeded', 'errored', 'expired', 'canceled'
                - result.message: The response message (if succeeded)
                - result.error: Error info (if errored)

        Raises:
            Exception if batch is not complete
        """
        status = self.get_batch_status(batch_id)
        if status['status'] != 'ended':
            raise Exception(f"Batch not complete: {status['status']}")

        return self.client.beta.messages.batches.results(batch_id)

    def find_batch_dir(self, batch_id: str) -> Optional[Path]:
        """
        Find local batch directory by batch API ID.

        Args:
            batch_id: Batch API ID

        Returns:
            Path to batch directory, or None if not found
        """
        if not self.batches_dir or not self.batches_dir.exists():
            return None

        for batch_dir in self.batches_dir.iterdir():
            if not batch_dir.is_dir():
                continue
            info_file = batch_dir / 'batch_info.json'
            if info_file.exists():
                with open(info_file) as f:
                    info = json.load(f)
                if info.get('batch_api_id') == batch_id:
                    return batch_dir

        return None

    def log_error(self, batch_dir: Path, custom_id: str, error_type: str, message: str):
        """
        Log an error to the batch's error log file.

        Args:
            batch_dir: Path to batch directory
            custom_id: Custom ID of the failed request
            error_type: Type of error (e.g., 'ERROR', 'EXPIRED', 'TRUNCATED')
            message: Error message
        """
        errors_file = batch_dir / 'errors.log'
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(errors_file, 'a') as f:
            f.write(f"{timestamp} | {custom_id} | {error_type} | {message}\n")


def parse_batch_result_tool_use(result, response_format: Type[BaseModel]) -> Optional[BaseModel]:
    """
    Parse a batch result's tool_use content into a Pydantic model.

    Args:
        result: A batch result object (from BatchManager.get_batch_results)
        response_format: Pydantic model class to parse into

    Returns:
        Parsed Pydantic model, or None if parsing fails
    """
    if result.result.type != 'succeeded':
        return None

    message = result.result.message

    # Find tool_use block
    tool_use = None
    for block in message.content:
        if block.type == 'tool_use':
            tool_use = block
            break

    if not tool_use:
        return None

    # Parse input
    input_data = tool_use.input
    if isinstance(input_data, str):
        input_data = json.loads(input_data)

    return response_format.model_validate(input_data)
