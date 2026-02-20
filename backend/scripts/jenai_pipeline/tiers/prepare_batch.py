"""Single-pass batch preparation with rich context."""
from ..state_machine import TrackedUnit
from ..models.llm_outputs import AnalysisOutput
from ..prompt_loader import load_jenai_prompts
from ..formatting import format_rich_context_cached, format_analysis_context
from ..config import BATCH_MODEL
from scripts.research_pipeline.context import (
    build_context_catalog,
    build_proactive_context,
    get_definitions_with_text_batch,
)
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
    prompts = load_jenai_prompts()
    analysis_config = prompts['analysis']

    # Build all context data in batch
    doc_ids = [u.unit.document_id for u in units]
    catalogs = build_context_catalog(doc_ids)
    proactive_map = build_proactive_context(doc_ids)
    definitions_map = get_definitions_with_text_batch(doc_ids)

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

        custom_id = f"jenai-{doc_id}"
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
