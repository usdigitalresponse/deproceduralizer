"""Single-pass batch preparation with rich context."""
from ..state_machine import TrackedUnit
from ..models.llm_outputs import AnalysisOutput
from ..prompt_loader import load_barrier_prompts
from ..formatting import format_rich_context_cached, format_analysis_context
from ..config import BATCH_MODEL
from scripts.research_pipeline.context import (
    PreFetchedContextData,
    build_context_catalog,
    build_proactive_context,
    get_definitions_with_text_batch,
    get_sibling_summaries_batch,
    get_crossrefs_batch,
    get_definitions_batch,
    get_ancestor_entries_batch,
)
from lib.db import get_ancestors_batch
from lib.batch import format_batch_request


def prepare_analysis_batch(
    units: list[TrackedUnit],
) -> tuple[list[dict], dict[str, int]]:
    """Prepare batch requests for single-pass analysis with rich context.

    Builds 3-layer cached prompts:
    - Layer 1 (system): Static core, cached globally
    - Layer 2 (batch_context): Per-subchapter cached context with rich data
    - Layer 3 (template): Unique per section

    Returns:
        (batch_requests, custom_id_map) where custom_id_map maps
        custom_id -> document_id for result correlation.
    """
    prompts = load_barrier_prompts()
    analysis_config = prompts['analysis']

    # Build all context data in batch — fetch shared data once
    doc_ids = [u.unit.document_id for u in units]

    # Fetch each data type once, then pass to both catalog + proactive builders
    raw_ancestors = get_ancestors_batch(doc_ids)
    siblings = get_sibling_summaries_batch(doc_ids)
    crossrefs = get_crossrefs_batch(doc_ids)
    definitions = get_definitions_batch(doc_ids, ancestors_map=raw_ancestors)
    ancestor_entries = get_ancestor_entries_batch(doc_ids, raw_ancestors_map=raw_ancestors)

    pre_fetched = PreFetchedContextData(
        raw_ancestors=raw_ancestors,
        siblings=siblings,
        crossrefs=crossrefs,
        definitions=definitions,
        ancestor_entries=ancestor_entries,
    )

    catalogs = build_context_catalog(doc_ids, pre_fetched=pre_fetched)
    proactive_map = build_proactive_context(doc_ids, pre_fetched=pre_fetched)
    definitions_map = get_definitions_with_text_batch(doc_ids, ancestors_map=raw_ancestors)

    batch_requests = []
    custom_id_map = {}

    for tracked in units:
        doc_id = tracked.unit.document_id
        catalog = catalogs.get(doc_id)
        if catalog is None:
            continue

        tracked.unit.context_catalog = catalog

        # Get rich context data for this document
        proactive_ctx = proactive_map.get(doc_id)
        definitions = definitions_map.get(doc_id, [])

        # Format context for prompt template variables
        context_vars = format_analysis_context(
            catalog,
            tracked.unit.content,
            proactive_ctx=proactive_ctx,
            citation=tracked.unit.citation,
            title=tracked.unit.title,
            summary=tracked.unit.summary or '',
        )

        # Add rich context to template variables
        context_vars['rich_context_block'] = format_rich_context_cached(
            catalog, proactive_ctx, definitions
        )

        # Build batch context (per-subchapter, cached) — Layer 2
        batch_context = analysis_config.get('batch_context', '').format(**context_vars)

        # Build user message (per-section) — Layer 3
        user_message = analysis_config['template'].format(**context_vars)

        custom_id = f"barrier-{doc_id}"
        custom_id_map[custom_id] = doc_id

        request = format_batch_request(
            custom_id=custom_id,
            prompt=user_message,                # Layer 3: unique per section
            response_format=AnalysisOutput,
            model=BATCH_MODEL,
            system=analysis_config['system'],    # Layer 1: static core
            user_cached_prefix=batch_context,    # Layer 2: per-subchapter context
        )
        batch_requests.append(request)

    return batch_requests, custom_id_map


def prepare_guidance_batch(
    units: list[TrackedUnit],
) -> tuple[list[dict], dict[str, int]]:
    """Prepare batch requests for guidance document analysis.

    Guidance docs are flat (no hierarchy), so context comes from:
    - Cited regulation summaries (via cross_references)
    - Guidance document metadata preamble

    Returns:
        (batch_requests, custom_id_map) where custom_id_map maps
        custom_id -> guidance_document_id for result correlation.
    """
    from scripts.research_pipeline.context import (
        fetch_cited_document_summaries,
        build_guidance_batch_context,
        format_guidance_preamble,
    )

    prompts = load_barrier_prompts()
    analysis_config = prompts['analysis']

    doc_ids = [u.unit.document_id for u in units]

    # Fetch cited document summaries (regulations + guidance) in batch
    cited_summaries = fetch_cited_document_summaries(doc_ids)

    batch_requests = []
    custom_id_map = {}

    for tracked in units:
        doc_id = tracked.unit.document_id
        unit = tracked.unit

        # Build guidance-specific context
        summaries = cited_summaries.get(doc_id, [])
        cited_context = build_guidance_batch_context(doc_id, summaries)
        preamble = format_guidance_preamble({
            "agency": unit.agency or '',
            "doc_type": unit.doc_type or '',
            "date_published": unit.date_published or '',
            "status": unit.status or '',
            "cites_regulations": unit.cites_regulations,
        })

        # Build context vars — guidance docs use flat structure
        context_vars = {
            'section_text': unit.content,
            'citation': unit.citation,
            'title': unit.title,
            'summary': unit.summary or '',
            'sibling_catalog': '(guidance document — no regulatory siblings)',
            'ancestor_chain': '(guidance document — no regulatory hierarchy)',
            'definition_terms': '(not available for guidance documents)',
            'cross_references': cited_context,
            'rich_context_block': f"{preamble}\n\nCITED REGULATION SUMMARIES:\n{cited_context}",
        }

        # Build batch context (Layer 2)
        batch_context = analysis_config.get('batch_context', '').format(**context_vars)

        # Build user message (Layer 3)
        user_message = analysis_config['template'].format(**context_vars)

        custom_id = f"barrier-g-{doc_id}"
        custom_id_map[custom_id] = doc_id

        request = format_batch_request(
            custom_id=custom_id,
            prompt=user_message,
            response_format=AnalysisOutput,
            model=BATCH_MODEL,
            system=analysis_config['system'],
            user_cached_prefix=batch_context,
        )
        batch_requests.append(request)

    return batch_requests, custom_id_map
