"""Format context data for JenAI prompts."""
import logging
from scripts.research_pipeline.models.context import ContextCatalog, ProactiveTier1Context

logger = logging.getLogger(__name__)


def format_sibling_catalog(catalog: ContextCatalog) -> str:
    """Format sibling entries for the prompt."""
    if not catalog.sibling_sections:
        return "No sibling sections available."
    lines = []
    for sib in catalog.sibling_sections:
        summary_part = f" — {sib.summary}" if sib.summary else ""
        lines.append(f"  - {sib.citation}: {sib.title}{summary_part}")
    return "\n".join(lines)


def format_ancestor_chain(catalog: ContextCatalog) -> str:
    """Format the hierarchy path."""
    if not catalog.ancestor_chain:
        return "No ancestor hierarchy available."
    lines = []
    for anc in catalog.ancestor_chain:
        lines.append(f"  {anc.hierarchy_level}: {anc.citation} {anc.title}")
    return "\n".join(lines)


def format_definitions(catalog: ContextCatalog) -> str:
    """Format available definition terms."""
    if not catalog.definition_terms:
        return "No definitions available."
    return ", ".join(catalog.definition_terms)


def format_crossrefs(catalog: ContextCatalog, proactive_ctx: ProactiveTier1Context | None = None) -> str:
    """Format cross-references, merging catalog entries with proactive summaries.

    Output goes in Layer 3 (per-section, never cached) because cross-references
    vary per document.
    """
    if not catalog.cross_references:
        return "No cross-references found."

    # Build lookup of proactive summaries by citation for enrichment
    summary_map: dict[str, str] = {}
    if proactive_ctx and proactive_ctx.cross_ref_summaries:
        for xref in proactive_ctx.cross_ref_summaries:
            if xref.citation and xref.summary:
                summary_map[xref.citation] = xref.summary

    lines = []
    for xref in catalog.cross_references:
        title_part = f": {xref.target_title}" if xref.target_title else ""
        summary = summary_map.get(xref.citation, "")
        summary_part = f" — {summary}" if summary else ""
        lines.append(f"  - {xref.citation}{title_part}{summary_part}")

    if summary_map and not any(summary_map.get(xref.citation) for xref in catalog.cross_references):
        logger.warning(
            "format_crossrefs: proactive_ctx has %d cross-ref summaries but none matched catalog citations. "
            "Proactive keys: %s, Catalog keys: %s",
            len(summary_map),
            list(summary_map.keys())[:5],
            [x.citation for x in catalog.cross_references[:5]],
        )

    return "\n".join(lines)


def format_definitions_with_text(definitions: list[dict]) -> str:
    """Format definitions with their full text."""
    if not definitions:
        return "No definitions available."
    lines = []
    for defn in definitions:
        term = defn.get('term', 'Unknown')
        text = defn.get('definition_text', defn.get('content', ''))
        if text:
            lines.append(f"  - {term}: {text[:500]}")
        else:
            lines.append(f"  - {term}")
    return "\n".join(lines)



def _format_merged_siblings(catalog: ContextCatalog, proactive_ctx: ProactiveTier1Context | None) -> str:
    """Format siblings once, merging catalog entries with proactive summaries."""
    if not catalog.sibling_sections:
        return "No sibling sections available."

    # Build lookup of proactive summaries by citation for enrichment
    proactive_map: dict[str, str] = {}
    if proactive_ctx and proactive_ctx.sibling_summaries:
        for sib in proactive_ctx.sibling_summaries:
            if sib.citation and sib.summary:
                proactive_map[sib.citation] = sib.summary

    lines = []
    for sib in catalog.sibling_sections:
        # Prefer proactive summary (richer), fall back to catalog summary
        summary = proactive_map.get(sib.citation, "") or (sib.summary or "")
        summary_part = f" — {summary}" if summary else ""
        lines.append(f"  - {sib.citation}: {sib.title}{summary_part}")
    return "\n".join(lines)


def format_rich_context_cached(catalog: ContextCatalog, proactive_ctx: ProactiveTier1Context | None, definitions: list[dict]) -> str:
    """Combine all context layers into the cached batch_context block (Layer 2)."""
    sections = []

    sections.append("REGULATORY HIERARCHY:")
    sections.append(format_ancestor_chain(catalog))

    sections.append("\nSIBLING SECTIONS IN THIS SUBCHAPTER:")
    sections.append(_format_merged_siblings(catalog, proactive_ctx))

    sections.append("\nDEFINITIONS (WITH FULL TEXT):")
    sections.append(format_definitions_with_text(definitions))

    # Include ancestor summaries from proactive context (but NOT sibling or
    # cross-ref summaries — siblings are merged above, cross-refs are in Layer 3)
    if proactive_ctx and proactive_ctx.ancestor_summaries:
        ancestor_parts = ["ANCESTOR CONTEXT:"]
        for anc in proactive_ctx.ancestor_summaries:
            ancestor_parts.append(f"  - {anc.citation} ({anc.hierarchy_level}): {anc.summary}")
        sections.append(f"\nRICH CONTEXT:\n" + "\n".join(ancestor_parts))

    return "\n".join(sections)


def format_analysis_context(catalog: ContextCatalog, section_text: str, proactive_ctx: ProactiveTier1Context | None = None, **kwargs) -> dict[str, str]:
    """Build the full context dict for prompt formatting."""
    return {
        'section_text': section_text,
        'citation': kwargs.get('citation', ''),
        'title': kwargs.get('title', ''),
        'summary': kwargs.get('summary', ''),
        'sibling_catalog': format_sibling_catalog(catalog),
        'ancestor_chain': format_ancestor_chain(catalog),
        'definition_terms': format_definitions(catalog),
        'cross_references': format_crossrefs(catalog, proactive_ctx),
    }
