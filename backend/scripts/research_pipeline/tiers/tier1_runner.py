"""
Tier 1 runner for the research pipeline.

Handles batch preparation for Tier 1: Match Filtering.

V5 4-layer caching approach:
- Layer 1 (static_core): Global cache for all requests
- Layer 2 (issue_block): Per issue type cache
- Layer 3 (batch_context): Per subchapter cache
- Layer 4 (document_template): Per document
"""

from ..state_machine import TrackedUnit
from ..prompt_loader import (
    TierConfig,
    IssueConfig,
    load_tier_configs,
    format_tier_prompt,
)
from ..models.llm_outputs import Tier1Output
from ..models.context import ContextCatalog
from ..formatting import (
    format_definition_terms,
    format_sibling_titles,
    format_crossref_citations,
    format_ancestor_chain,
    format_catalog,
    format_sibling_summaries,
    format_crossref_summaries,
    format_ancestor_summaries,
    format_matches_for_tier1,
    format_immediate_siblings,
)
from ..context_builder import (
    build_context_catalog,
    get_immediate_siblings_batch,
    # V5 proactive context
    build_proactive_context,
    fetch_document_summaries_batch,
    # V5 4-layer caching
    get_subchapter_ids_batch,
    build_batch_context_for_subchapter,
)
from ..context_registry import ContextRegistry
from ..config import BATCH_MODEL

# Import from shared_utils
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from shared_utils import format_batch_request


def prepare_tier1_batch(
    units: list[TrackedUnit],
    issue_config: IssueConfig,
    context_cache: dict[int, dict[str, str]] | None = None,
) -> list[dict]:
    """
    Prepare batch requests for Tier 1.

    V5 4-layer caching approach:
    - Layer 1 (static_core): Global cache for all requests
    - Layer 2 (issue_block): Per issue type cache
    - Layer 3 (batch_context): Per subchapter cache - ancestors, sibling catalog,
                               keyword-matched sibling summaries, definitions
    - Layer 4 (document_template): Per document - citation, summary, matches,
                                   immediate siblings, cross-refs

    Units are grouped by subchapter to maximize cache hits for Layer 3.

    Args:
        units: List of TrackedUnits to process
        issue_config: Configuration for the issue type
        context_cache: Optional shared cache for subchapter contexts across issue types.
                       If provided, will check cache before building new context.
                       Mutated in-place to add new contexts.
    """
    # Use provided cache or create a local one
    subchapter_cache = context_cache if context_cache is not None else {}
    tier_configs = load_tier_configs()
    tier1_config = tier_configs['tier1']

    # Batch fetch context for all documents
    doc_ids = [u.document_id for u in units]

    # V5 4-layer caching: Get subchapter IDs for grouping
    subchapter_ids = get_subchapter_ids_batch(doc_ids)

    # V5: Build proactive context (for cross-ref summaries which are per-document)
    proactive_contexts = build_proactive_context(doc_ids)

    # V5: Fetch document summaries for target documents
    document_summaries = fetch_document_summaries_batch(doc_ids)

    # Get immediate siblings (for prev/next context - unique per document)
    immediate_siblings = get_immediate_siblings_batch(doc_ids)

    # Also build catalogs for backward compatibility and registry population
    catalogs = build_context_catalog(doc_ids)

    # Group units by subchapter for batch context caching
    subchapter_groups: dict[int, list[TrackedUnit]] = {}
    no_subchapter_units: list[TrackedUnit] = []
    for unit in units:
        subchapter_id = subchapter_ids.get(unit.document_id)
        if subchapter_id:
            if subchapter_id not in subchapter_groups:
                subchapter_groups[subchapter_id] = []
            subchapter_groups[subchapter_id].append(unit)
        else:
            no_subchapter_units.append(unit)

    # Build batch context once per subchapter (with cross-issue-type caching)
    batch_contexts: dict[int, dict[str, str]] = {}
    subchapter_list = list(subchapter_groups.keys())
    cache_hits = 0

    # Separate cached vs uncached subchapters
    uncached_subchapters: list[int] = []
    for subchapter_id in subchapter_list:
        if subchapter_id in subchapter_cache:
            batch_contexts[subchapter_id] = subchapter_cache[subchapter_id]
            cache_hits += 1
        else:
            uncached_subchapters.append(subchapter_id)

    # Build uncached contexts in parallel (each context build has multiple DB queries)
    if uncached_subchapters:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def build_one(subchapter_id: int) -> tuple[int, dict[str, str]]:
            """Build context for one subchapter (runs in thread pool)."""
            return subchapter_id, build_batch_context_for_subchapter(
                subchapter_id=subchapter_id,
                issue_type=issue_config.name,
            )

        # Use 4 threads - balances parallelism with DB connection limits
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(build_one, sid): sid for sid in uncached_subchapters}
            completed = 0
            for future in as_completed(futures):
                completed += 1
                print(f"    Building subchapter context ({completed}/{len(uncached_subchapters)})...", end="\r", flush=True)
                subchapter_id, context = future.result()
                batch_contexts[subchapter_id] = context
                subchapter_cache[subchapter_id] = context  # Add to shared cache

    if subchapter_list:
        if cache_hits > 0:
            print(f"    Subchapter context: {cache_hits} cached, {len(uncached_subchapters)} built (parallel)" + " " * 20)
        elif uncached_subchapters:
            print(f"    Built context for {len(uncached_subchapters)} subchapters (parallel)" + " " * 20)

    requests = []

    # Process units grouped by subchapter (enables cache hits)
    for subchapter_id, group_units in subchapter_groups.items():
        batch_context_vars = batch_contexts[subchapter_id]

        for unit in group_units:
            request = _prepare_tier1_request(
                unit=unit,
                tier1_config=tier1_config,
                issue_config=issue_config,
                batch_context_vars=batch_context_vars,
                proactive_contexts=proactive_contexts,
                document_summaries=document_summaries,
                immediate_siblings=immediate_siblings,
                catalogs=catalogs,
            )
            requests.append(request)

    # Process units without a subchapter (no batch context caching)
    for unit in no_subchapter_units:
        # Build batch context individually for these units
        doc_id = unit.document_id
        proactive = proactive_contexts.get(doc_id)
        catalog = catalogs.get(doc_id)

        # Create fallback batch_context_vars from proactive context or catalog
        if proactive:
            batch_context_vars = {
                "subchapter_citation": "(no subchapter)",
                "ancestor_summaries": format_ancestor_summaries(proactive.ancestor_summaries),
                "sibling_catalog": format_catalog(proactive.sibling_catalog),
                "sibling_count": str(len(proactive.sibling_catalog)),
                "sibling_catalog_truncated": " (truncated)" if proactive.sibling_catalog_truncated else "",
                "keyword_sibling_summaries": format_sibling_summaries(proactive.sibling_summaries, filter_reason="keyword"),
                "definition_terms": ", ".join(proactive.definition_terms[:20]) if proactive.definition_terms else "(none)",
            }
            if len(proactive.definition_terms) > 20:
                batch_context_vars["definition_terms"] += f" ... and {len(proactive.definition_terms) - 20} more"
        else:
            batch_context_vars = {
                "subchapter_citation": "(no subchapter)",
                "ancestor_summaries": "(no ancestors)",
                "sibling_catalog": format_catalog(catalog.sibling_sections if catalog else []),
                "sibling_count": str(len(catalog.sibling_sections) if catalog else 0),
                "sibling_catalog_truncated": "",
                "keyword_sibling_summaries": "(none pre-fetched)",
                "definition_terms": format_definition_terms(catalog.definition_terms if catalog else []),
            }

        request = _prepare_tier1_request(
            unit=unit,
            tier1_config=tier1_config,
            issue_config=issue_config,
            batch_context_vars=batch_context_vars,
            proactive_contexts=proactive_contexts,
            document_summaries=document_summaries,
            immediate_siblings=immediate_siblings,
            catalogs=catalogs,
        )
        requests.append(request)

    return requests


def _prepare_tier1_request(
    unit: TrackedUnit,
    tier1_config: TierConfig,
    issue_config: IssueConfig,
    batch_context_vars: dict[str, str],
    proactive_contexts: dict,
    document_summaries: dict,
    immediate_siblings: dict,
    catalogs: dict,
) -> dict:
    """
    Prepare a single Tier 1 batch request.

    Separated from prepare_tier1_batch to support 4-layer caching with
    shared batch_context_vars for subchapter groups.

    Args:
        unit: The TrackedUnit to process
        tier1_config: Tier 1 prompt config
        issue_config: Issue type config
        batch_context_vars: Subchapter-level context vars (Layer 3)
        proactive_contexts: Pre-fetched proactive context by doc_id
        document_summaries: Document summaries by doc_id
        immediate_siblings: Immediate siblings by doc_id
        catalogs: Context catalogs by doc_id

    Returns:
        Formatted batch request dict
    """
    doc_id = unit.document_id
    proactive = proactive_contexts.get(doc_id)
    immediate = immediate_siblings.get(doc_id, {})
    catalog = catalogs.get(doc_id, ContextCatalog(
        sibling_sections=[],
        cross_references=[],
        definition_terms=[],
        ancestor_chain=[],
    ))

    # Store catalog on unit for later reference
    unit.unit.context_catalog = catalog

    # Initialize and populate context registry for audit trail
    registry = ContextRegistry()

    # Add sibling sections to registry
    for sibling in catalog.sibling_sections:
        registry.add_context(
            context_type="sibling",
            identifier=sibling.citation,
            document_id=sibling.document_id,
            content_level="catalog",
        )

    # Add cross-references to registry
    for xref in catalog.cross_references:
        registry.add_context(
            context_type="cross_reference",
            identifier=xref.citation,
            document_id=xref.target_id,
            content_level="catalog",
        )

    # Add definitions to registry
    for term in catalog.definition_terms:
        registry.add_context(
            context_type="definition",
            identifier=term,
            content_level="catalog",
        )

    # Add ancestors to registry
    for ancestor in catalog.ancestor_chain:
        registry.add_context(
            context_type="hierarchy",
            identifier=ancestor.citation,
            document_id=ancestor.document_id,
            content_level="catalog",
        )

    # Add self (the document being analyzed) to registry
    registry.add_context(
        context_type="self",
        identifier=unit.unit.citation,
        document_id=unit.document_id,
        content=unit.unit.content,
        content_level="full_text",
    )

    # Store registry on TrackedUnit
    unit.context_registry = registry

    # V5 4-layer: Document-specific variables (Layer 4)
    # Cross-refs are unique per document (different outbound references)
    if proactive:
        keyword_crossref_summaries = format_crossref_summaries(proactive.cross_ref_summaries)
        crossref_catalog = format_catalog(proactive.cross_ref_catalog)
        crossref_catalog_truncated = " (truncated)" if proactive.cross_ref_catalog_truncated else ""
        crossref_count = str(len(proactive.cross_ref_catalog))
    else:
        keyword_crossref_summaries = "(none pre-fetched)"
        crossref_catalog = format_catalog(catalog.cross_references)
        crossref_catalog_truncated = ""
        crossref_count = str(len(catalog.cross_references))

    # Format prompt with 4-layer structure
    # batch_context_vars contains: subchapter_citation, ancestor_summaries,
    # sibling_catalog, sibling_count, sibling_catalog_truncated,
    # keyword_sibling_summaries, definition_terms
    prompt_parts = format_tier_prompt(
        tier=tier1_config,
        issue=issue_config,
        batch_context_vars=batch_context_vars,
        # Document-specific variables (Layer 4)
        citation=unit.unit.citation,
        title=unit.unit.title or "",
        document_summary=document_summaries.get(doc_id, "(no summary)"),
        match_count=str(len(unit.unit.matches)),
        match_list=format_matches_for_tier1(unit.unit.matches),
        immediate_siblings=format_immediate_siblings(immediate),
        # Cross-refs are document-specific (each doc has different outbound refs)
        keyword_crossref_summaries=keyword_crossref_summaries,
        crossref_count=crossref_count,
        crossref_catalog=crossref_catalog,
        crossref_catalog_truncated=crossref_catalog_truncated,
        # Keep old format for backward compatibility
        sibling_titles=format_sibling_titles(catalog.sibling_sections),
        crossref_citations=format_crossref_citations(catalog.cross_references),
        ancestor_chain=format_ancestor_chain(catalog.ancestor_chain),
    )

    # V5 4-layer caching: Use multi-block user message
    # issue_block + batch_context are cacheable (shared across subchapter)
    # document_template is unique per document
    user_cached_prefix = prompt_parts["issue_block"] + prompt_parts["batch_context"]

    request = format_batch_request(
        custom_id=unit.custom_id,
        prompt=prompt_parts["document_template"],
        response_format=Tier1Output,
        model=BATCH_MODEL,
        system=prompt_parts["system"],
        user_cached_prefix=user_cached_prefix if user_cached_prefix.strip() else None,
    )

    return request
