"""Tier 2: Full Context Confirmation."""
import json
from ..state_machine import TrackedUnit
from ..models.llm_outputs import Tier2Output
from ..prompt_loader import load_jenai_prompts
from ..config import BATCH_MODEL
from scripts.research_pipeline.context import (
    fetch_summaries_for_requests,
    build_proactive_context,
)
from lib.batch import format_batch_request


def prepare_tier2_batch(
    units: list[TrackedUnit],
) -> tuple[list[dict], dict[str, int]]:
    """Prepare batch requests for Tier 2.

    Returns:
        (batch_requests, custom_id_map) where custom_id_map maps
        custom_id -> document_id for result correlation.
    """
    prompts = load_jenai_prompts()
    tier2_config = prompts['tier2_analysis']

    # Batch call for all units at once
    doc_ids = [t.unit.document_id for t in units if t.tier1_output is not None]
    proactive_map = build_proactive_context(doc_ids)

    batch_requests = []
    custom_id_map = {}

    for tracked in units:
        if tracked.tier1_output is None:
            continue

        doc_id = tracked.unit.document_id

        # Fetch requested context summaries (dict[str, str])
        fetched_context = ""
        if tracked.tier1_output.context_requests:
            summaries = fetch_summaries_for_requests(
                tracked.tier1_output.context_requests
            )
            fetched_context = "\n".join(
                f"- {key}: {text}" for key, text in summaries.items()
            )

        # Proactive context from batch map
        proactive_ctx = proactive_map.get(doc_id)
        if proactive_ctx:
            proactive_parts = []
            if proactive_ctx.sibling_summaries:
                proactive_parts.append("SIBLING CONTEXT:")
                for sib in proactive_ctx.sibling_summaries:
                    proactive_parts.append(
                        f"  - {sib.citation}: {sib.summary}"
                    )
            if proactive_ctx.cross_ref_summaries:
                proactive_parts.append("CROSS-REFERENCE CONTEXT:")
                for xref in proactive_ctx.cross_ref_summaries:
                    proactive_parts.append(
                        f"  - {xref.citation}: {xref.summary}"
                    )
            if proactive_ctx.ancestor_summaries:
                proactive_parts.append("ANCESTOR CONTEXT:")
                for anc in proactive_ctx.ancestor_summaries:
                    proactive_parts.append(
                        f"  - {anc.citation} ({anc.hierarchy_level}): {anc.summary}"
                    )
            if proactive_parts:
                fetched_context += "\n\nPROACTIVE CONTEXT:\n" + "\n".join(
                    proactive_parts
                )

        # Format Tier 1 findings
        tier1_findings = json.dumps(
            [c.model_dump() for c in tracked.tier1_output.categories_found],
            indent=2,
        )

        user_message = tier2_config['template'].format(
            tier1_findings=tier1_findings,
            fetched_context=fetched_context or "No additional context fetched.",
            section_text=tracked.unit.content,
            citation=tracked.unit.citation,
            title=tracked.unit.title,
        )

        custom_id = f"jenai-t2-{doc_id}"
        custom_id_map[custom_id] = doc_id

        request = format_batch_request(
            custom_id=custom_id,
            prompt=user_message,
            response_format=Tier2Output,
            model=BATCH_MODEL,
            system=tier2_config['system'],
        )
        batch_requests.append(request)

    return batch_requests, custom_id_map
