"""
Post-processing hook: structured fines extraction for the research pipeline.

After the research pipeline classifies fines_fees_penalties issues through
Tier 1/2, this module runs a separate Haiku call to extract structured data
(amount, who_pays, penalty_type, etc.) and writes to the dedicated
fines_fees_penalties table.

Caching strategy: Documents are grouped by subchapter so that all docs in the
same subchapter share an identical system prompt (instructions + definitions +
ancestor summaries). Anthropic's automatic prompt caching means the system
prompt is only billed once per subchapter group. The user message contains only
the per-document unique content (metadata + regulation text).

This bridges the research pipeline (burden classification) with the fines
scanner (structured extraction) — see issue #275.
"""

import asyncio
import logging
import traceback
from collections import defaultdict
from typing import Optional

import psycopg

from .state_machine import TrackedUnit

from lib.db import get_db_connection, get_ancestors_batch
from lib.llm import get_async_anthropic_client
from lib.jurisdictions import get_title_agency_map, jurisdiction_prefix

from scripts.compliance_issues.config import _load_issue_config
from scripts.compliance_issues.models import FinesFeePenaltyAnalysis
from scripts.research_pipeline.context.queries import (
    get_definitions_with_text_batch,
    get_subchapter_ids_batch,
)

logger = logging.getLogger(__name__)

# Issue type that triggers this hook
FINES_ISSUE_TYPE = "fines_fees_penalties"

# Model for structured extraction (cheap, fast)
EXTRACTION_MODEL = "claude-haiku-4-5-20251001"


def get_confirmed_fines_units(units: dict[str, TrackedUnit]) -> list[TrackedUnit]:
    """Get fines_fees_penalties units that passed Tier 1 (not false positives)."""
    return [
        u for u in units.values()
        if u.issue_type == FINES_ISSUE_TYPE
        and u.tier1_output is not None
        and u.tier1_output.classification != "all_false_positives"
    ]


async def run_fines_extraction(
    units: dict[str, TrackedUnit],
    jurisdiction: str,
) -> int:
    """
    Run structured fines extraction on confirmed fines_fees_penalties units.

    Called as a post-processing hook after Tier 2 in the research pipeline.
    Groups documents by subchapter for prompt caching efficiency.

    Args:
        units: All tracked units (will filter to fines_fees_penalties)
        jurisdiction: Jurisdiction code (NY, NJ, NYC)

    Returns:
        Number of fines records saved to dedicated table
    """
    confirmed = get_confirmed_fines_units(units)
    if not confirmed:
        return 0

    print(f"\n[FINES EXTRACTION] Extracting structured data for {len(confirmed)} confirmed documents...")

    # Load fines config for prompt
    fines_config = _load_issue_config(FINES_ISSUE_TYPE)
    prompt_config = fines_config.prompt
    base_system_prompt = prompt_config.get('system', '')
    template = prompt_config.get('template', '')

    # Build title-agency map for metadata
    title_agency_map = get_title_agency_map(jurisdiction)
    prefix = jurisdiction_prefix(jurisdiction)

    # Get document metadata from DB
    doc_ids = [u.document_id for u in confirmed]
    doc_metadata = _fetch_document_metadata(doc_ids, jurisdiction, prefix)

    # Fetch definitions and ancestors for context (shared per subchapter)
    definitions_map = get_definitions_with_text_batch(doc_ids)
    ancestors_map = get_ancestors_batch(doc_ids)

    # Fetch summaries for all ancestors
    all_ancestor_ids = list({
        a["id"] for ancs in ancestors_map.values() for a in ancs
    })
    ancestor_summaries_map = _fetch_ancestor_summaries(all_ancestor_ids)

    # Group documents by subchapter for cache efficiency
    subchapter_map = get_subchapter_ids_batch(doc_ids)
    groups: dict[Optional[int], list[TrackedUnit]] = defaultdict(list)
    for unit in confirmed:
        sub_id = subchapter_map.get(unit.document_id)
        groups[sub_id].append(unit)

    num_groups = len(groups)
    print(f"  Grouped into {num_groups} subchapter groups for prompt caching")

    # Build per-subchapter system prompts (base instructions + shared context)
    subchapter_system_prompts: dict[Optional[int], str] = {}
    for sub_id, group_units in groups.items():
        # Use first doc's context as representative (all share same subchapter)
        rep_doc_id = group_units[0].document_id
        definitions_context = _format_definitions(definitions_map.get(rep_doc_id, []))
        ancestor_context = _format_ancestors(
            ancestors_map.get(rep_doc_id, []),
            ancestor_summaries_map,
        )
        subchapter_system_prompts[sub_id] = (
            f"{base_system_prompt}\n\n"
            f"DEFINITIONS:\n{definitions_context}\n\n"
            f"ANCESTOR SUMMARIES (regulatory hierarchy context):\n{ancestor_context}"
        )

    # Run async extraction, grouped by subchapter
    client = get_async_anthropic_client()
    results = []
    batch_size = 10

    for sub_id, group_units in groups.items():
        system_prompt = subchapter_system_prompts[sub_id]

        for i in range(0, len(group_units), batch_size):
            batch = group_units[i:i + batch_size]
            tasks = [
                _extract_single(
                    unit, client, system_prompt, template,
                    doc_metadata, title_agency_map,
                )
                for unit in batch
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            for unit, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.warning(
                        "Fines extraction failed for doc %s: %s",
                        unit.document_id, result,
                    )
                    continue
                if result is not None:
                    results.append((unit, result))

    print(f"  Extracted {len(results)}/{len(confirmed)} documents successfully")

    # Save to dedicated table
    saved = _save_fines_to_db(results, jurisdiction)
    print(f"[FINES EXTRACTION] Saved {saved} structured fines records")
    return saved


# =============================================================================
# Formatting helpers
# =============================================================================


def _format_definitions(defs: list[dict]) -> str:
    """Format definitions with full text for system prompt."""
    if not defs:
        return "No definitions available."
    lines = []
    for d in defs:
        term = d.get('term', '')
        text = d.get('verbatim_text') or d.get('rephrased_definition') or ''
        if text:
            lines.append(f"  - {term}: {text[:500]}")
        else:
            lines.append(f"  - {term}")
    return "\n".join(lines)


def _format_ancestors(
    ancestors: list[dict],
    summaries_map: dict[int, str],
) -> str:
    """Format ancestor chain with summaries for system prompt."""
    if not ancestors:
        return "No ancestor context available."
    lines = []
    for a in ancestors:
        level = a.get('hierarchy_level', 'ancestor')
        citation = a.get('citation', '')
        title = a.get('title', '')
        summary = summaries_map.get(a["id"], '')
        if summary:
            lines.append(f"  - {level}: {citation} — {title}\n    {summary}")
        else:
            lines.append(f"  - {level}: {citation} — {title}")
    return "\n".join(lines)


# =============================================================================
# Per-document extraction
# =============================================================================


async def _extract_single(
    unit: TrackedUnit,
    client,
    system_prompt: str,
    template: str,
    doc_metadata: dict,
    title_agency_map: dict,
) -> Optional[FinesFeePenaltyAnalysis]:
    """Extract structured fines data for a single document.

    The system_prompt already contains the shared context (definitions, ancestors).
    The user message contains only per-document unique content.
    """
    content = unit.unit.content
    if not content:
        logger.debug("Skipping document %s: empty content", unit.document_id)
        return None

    # Build document metadata (unique per document)
    meta = doc_metadata.get(unit.document_id, {})
    metadata_parts = ["Source: Regulation"]
    title_num = meta.get('title_num')
    if title_num and str(title_num) in title_agency_map:
        metadata_parts.append(f"Administering agency: {title_agency_map[str(title_num)]}")
    if meta.get('title'):
        metadata_parts.append(f"Document title: {meta['title']}")
    if meta.get('url'):
        metadata_parts.append(f"URL: {meta['url']}")
    document_metadata = "\n".join(metadata_parts)

    # Use full content for small docs, truncate for large
    MAX_CONTENT_CHARS = 15000
    regulation_text = content[:MAX_CONTENT_CHARS] if len(content) > MAX_CONTENT_CHARS else content

    user_prompt = template.format(
        regulation_context=regulation_text,
        statute_context="No statute references found.",
        document_metadata=document_metadata,
    )

    try:
        response = await client.messages.create(
            model=EXTRACTION_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            tools=[{
                "name": "record_analysis",
                "description": "Record the structured fines analysis",
                "input_schema": FinesFeePenaltyAnalysis.model_json_schema(),
            }],
            tool_choice={"type": "tool", "name": "record_analysis"},
        )

        # Parse tool_use response
        for block in response.content:
            if block.type == "tool_use":
                return FinesFeePenaltyAnalysis.model_validate(block.input)

        logger.warning("No tool_use block in response for document %s", unit.document_id)
        return None
    except Exception as e:
        logger.warning("Fines extraction LLM call failed for doc %s: %s", unit.document_id, e)
        raise


# =============================================================================
# Database helpers
# =============================================================================


def _fetch_ancestor_summaries(ancestor_ids: list[int]) -> dict[int, str]:
    """Fetch summaries for ancestor documents."""
    if not ancestor_ids:
        return {}

    conn = get_db_connection()
    if not conn:
        logger.warning("Failed to fetch ancestor summaries: could not connect to database")
        return {}

    try:
        rows = conn.execute(
            """
            SELECT id, summary
            FROM regulatory_documents
            WHERE id = ANY(%s) AND summary IS NOT NULL
            """,
            [ancestor_ids],
        ).fetchall()
        conn.commit()
        return {row[0]: row[1] for row in rows if row[1]}
    except psycopg.Error as e:
        logger.warning("Failed to fetch ancestor summaries: %s", e)
        try:
            conn.rollback()
        except Exception:
            pass
        return {}
    finally:
        conn.close()


def _fetch_document_metadata(
    doc_ids: list[int],
    jurisdiction: str,
    prefix: str,
) -> dict:
    """Fetch document metadata for fines prompt construction."""
    if not doc_ids:
        return {}

    conn = get_db_connection()
    if not conn:
        logger.warning("Failed to fetch document metadata: could not connect to database")
        return {}

    try:
        placeholders = ",".join(["%s"] * len(doc_ids))
        rows = conn.execute(
            f"""
            SELECT id, title, url, {prefix}_title
            FROM regulatory_documents
            WHERE id IN ({placeholders})
            """,
            doc_ids,
        ).fetchall()
        conn.commit()
        return {
            row[0]: {
                'title': row[1],
                'url': row[2],
                'title_num': row[3],
            }
            for row in rows
        }
    except psycopg.Error as e:
        logger.warning("Failed to fetch document metadata: %s", e)
        try:
            conn.rollback()
        except Exception:
            pass
        return {}
    finally:
        conn.close()


def _save_fines_to_db(
    results: list[tuple[TrackedUnit, FinesFeePenaltyAnalysis]],
    jurisdiction: str,
) -> int:
    """Save structured fines data to the dedicated fines_fees_penalties table."""
    if not results:
        return 0

    conn = get_db_connection()
    if not conn:
        raise RuntimeError("Failed to save fines to database: could not connect to database")

    saved = 0
    errors = 0

    try:
        for unit, analysis in results:
            try:
                for item in analysis.items:
                    if not item.llm_confirmed:
                        continue

                    conn.execute(
                        """
                        INSERT INTO fines_fees_penalties
                        (document_id, guidance_document_id, penalty_type, amount,
                         amount_min, amount_max, per_unit, who_pays, responsible_agency,
                         violation_description, requirement_quote, context,
                         term_matched, llm_confirmed, jurisdiction, url,
                         jurisdiction_level, jurisdiction_level_other, issuing_entity_confidence)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (
                            unit.document_id,
                            None,  # guidance_document_id
                            item.penalty_type,
                            item.amount,
                            item.amount_min,
                            item.amount_max,
                            item.per_unit,
                            item.who_pays,
                            item.responsible_agency,
                            item.violation_description,
                            item.requirement_quote,
                            unit.unit.content[:500] if unit.unit.content else '',
                            None,  # term_matched
                            True,
                            jurisdiction.upper(),
                            '',
                            item.jurisdiction_level,
                            item.jurisdiction_level_other,
                            item.issuing_entity_confidence,
                        ),
                    )
                    saved += 1

                conn.commit()

            except Exception as e:
                errors += 1
                logger.warning(
                    "Error saving fines for doc %s: %s",
                    unit.document_id, e,
                )
                traceback.print_exc()
                try:
                    conn.rollback()
                except Exception:
                    pass

    finally:
        conn.close()

    if errors:
        print(f"  {errors} errors during fines save")
    return saved
