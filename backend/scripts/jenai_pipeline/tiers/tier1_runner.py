"""Tier 1: Catalog Context analysis."""
from ..state_machine import TrackedUnit
from ..models.llm_outputs import Tier1Output
from ..prompt_loader import load_jenai_prompts
from ..formatting import format_tier1_context
from ..config import BATCH_MODEL
from scripts.research_pipeline.context import (
    build_context_catalog,
    group_for_cache_efficiency,
)
from lib.batch import format_batch_request


def prepare_tier1_batch(
    units: list[TrackedUnit],
) -> tuple[list[dict], dict[str, int]]:
    """Prepare batch requests for Tier 1.

    Returns:
        (batch_requests, custom_id_map) where custom_id_map maps
        custom_id -> document_id for result correlation.
    """
    prompts = load_jenai_prompts()
    tier1_config = prompts['tier1_analysis']

    # Build context catalogs for all documents
    doc_ids = [u.unit.document_id for u in units]
    catalogs = build_context_catalog(doc_ids)

    batch_requests = []
    custom_id_map = {}

    for tracked in units:
        doc_id = tracked.unit.document_id
        catalog = catalogs.get(doc_id)
        if catalog is None:
            continue

        tracked.unit.context_catalog = catalog

        # Format context for prompt
        context_vars = format_tier1_context(
            catalog,
            tracked.unit.content,
            citation=tracked.unit.citation,
            title=tracked.unit.title,
            summary=tracked.unit.summary or '',
        )

        # Build batch context (per-subchapter, cached) — Layer 2
        batch_context = tier1_config.get('batch_context', '').format(**context_vars)

        # Build user message (per-section) — Layer 3
        user_message = tier1_config['template'].format(**context_vars)

        custom_id = f"jenai-t1-{doc_id}"
        custom_id_map[custom_id] = doc_id

        request = format_batch_request(
            custom_id=custom_id,
            prompt=user_message,                # Layer 3: unique per section
            response_format=Tier1Output,
            model=BATCH_MODEL,
            system=tier1_config['system'],       # Layer 1: static core
            user_cached_prefix=batch_context,    # Layer 2: per-subchapter context
        )
        batch_requests.append(request)

    return batch_requests, custom_id_map
