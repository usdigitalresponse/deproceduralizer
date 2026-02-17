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


def format_tier1_context(catalog: ContextCatalog, section_text: str, **kwargs) -> dict[str, str]:
    """Build the full context dict for Tier 1 prompt formatting."""
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
