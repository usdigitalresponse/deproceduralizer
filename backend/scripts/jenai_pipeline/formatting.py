"""Format context data for JenAI prompts."""
from scripts.research_pipeline.models.context import ContextCatalog


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


def format_crossrefs(catalog: ContextCatalog) -> str:
    """Format cross-reference summaries."""
    if not catalog.cross_references:
        return "No cross-references found."
    lines = []
    for xref in catalog.cross_references:
        title_part = f": {xref.target_title}" if xref.target_title else ""
        lines.append(f"  - {xref.citation}{title_part}")
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


def format_proactive_context_block(proactive_ctx) -> str:
    """Format proactive context (ancestor/sibling/cross-ref summaries) into a text block."""
    if not proactive_ctx:
        return ""
    parts = []

    if proactive_ctx.ancestor_summaries:
        parts.append("ANCESTOR CONTEXT:")
        for anc in proactive_ctx.ancestor_summaries:
            parts.append(f"  - {anc.citation} ({anc.hierarchy_level}): {anc.summary}")

    if proactive_ctx.sibling_summaries:
        parts.append("SIBLING SUMMARIES:")
        for sib in proactive_ctx.sibling_summaries:
            parts.append(f"  - {sib.citation}: {sib.summary}")

    if proactive_ctx.cross_ref_summaries:
        parts.append("CROSS-REFERENCE SUMMARIES:")
        for xref in proactive_ctx.cross_ref_summaries:
            parts.append(f"  - {xref.citation}: {xref.summary}")

    return "\n".join(parts) if parts else "No additional context available."


def format_rich_context_cached(catalog: ContextCatalog, proactive_ctx, definitions: list[dict]) -> str:
    """Combine all context layers into the cached batch_context block (Layer 2)."""
    sections = []

    sections.append("REGULATORY HIERARCHY:")
    sections.append(format_ancestor_chain(catalog))

    sections.append("\nSIBLING SECTIONS IN THIS SUBCHAPTER:")
    sections.append(format_sibling_catalog(catalog))

    sections.append("\nDEFINITIONS (WITH FULL TEXT):")
    sections.append(format_definitions_with_text(definitions))

    proactive_block = format_proactive_context_block(proactive_ctx)
    if proactive_block and proactive_block != "No additional context available.":
        sections.append(f"\nRICH CONTEXT (summaries, cross-references):\n{proactive_block}")

    return "\n".join(sections)


def format_analysis_context(catalog: ContextCatalog, section_text: str, **kwargs) -> dict[str, str]:
    """Build the full context dict for prompt formatting."""
    return {
        'section_text': section_text,
        'citation': kwargs.get('citation', ''),
        'title': kwargs.get('title', ''),
        'summary': kwargs.get('summary', ''),
        'sibling_catalog': format_sibling_catalog(catalog),
        'ancestor_chain': format_ancestor_chain(catalog),
        'definition_terms': format_definitions(catalog),
        'cross_references': format_crossrefs(catalog),
    }
