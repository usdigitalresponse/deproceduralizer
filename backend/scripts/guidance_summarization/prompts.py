"""Prompts for guidance document summarization."""


GUIDANCE_SUMMARIZATION_SYSTEM = """You are a government guidance document analyzer. For each document, provide:

1. **summary** (3-5 sentences, 80-120 words):
   - START WITH THE ACTION OR EFFECT, not "This document" or "This guidance"
     Examples: "Directs...", "Implements...", "Announces...", "Establishes...", "Clarifies..."
   - Capture the PURPOSE, key requirements or policy changes, affected programs, and who must act
   - Include specific dates, deadlines, dollar amounts, or thresholds when present
   - Note if the document supersedes or revises previous guidance

2. **section_type** (one of):
   - requirements: Mandatory obligations for local districts or providers
   - procedures: Step-by-step processes (filing, applications, implementation steps)
   - standards: Technical specifications, acceptable methods, quality benchmarks
   - eligibility: Who qualifies, income limits, program criteria
   - reporting: Reporting obligations, data submission, compliance tracking
   - fees: Fee schedules, rate changes, payment amounts
   - forms: New or revised forms, form instructions
   - definitions: Defines terms or program parameters
   - purpose: Legislative intent, background, rationale for policy changes
   - scope: Applicability, what's covered, geographic or population scope
   - exemptions: Exceptions, waivers, exclusions
   - penalties: Sanctions, corrective actions, enforcement
   - other: Use when none of the above categories fit

3. **keywords** (3-5 searchable terms): Key programs, policies, or subjects

4. **applies_to** (list): Who must comply or act — e.g., "local districts", "child care providers", "residential facilities", "county departments of social services"

5. **has_form**: true if the document references or contains a specific form

6. **has_incorporation_by_reference**: true ONLY if the document incorporates external non-governmental standards (ASTM, ANSI, etc.)
"""


def build_guidance_user_prompt(
    doc: dict,
    cross_ref_summaries: list[dict],
    content: str,
) -> str:
    """
    Build user prompt for guidance document summarization.

    Args:
        doc: Guidance document dict
        cross_ref_summaries: List of {citation, summary} for cited regulations
        content: Document content (possibly truncated)

    Returns:
        Formatted user prompt
    """
    parts = []

    # Document metadata header
    agency = doc.get("agency", "Unknown")
    doc_type = doc.get("doc_type", "")
    canonical_ref = doc.get("canonical_ref", "")
    date_published = doc.get("date_published", "")

    header = f"DOCUMENT: {agency}"
    if doc_type:
        header += f" {doc_type}"
    if canonical_ref:
        header += f" — {canonical_ref}"
    parts.append(header)

    if date_published:
        parts.append(f"Published: {date_published}")

    title = doc.get("title", "Untitled")
    parts.append(f"Title: {title}")

    # Programs if available
    programs = doc.get("programs")
    if programs:
        parts.append(f"Programs: {', '.join(programs[:5])}")

    parts.append("")

    # Cross-reference context: cited regulation summaries
    if cross_ref_summaries:
        parts.append("CITED REGULATIONS:")
        for ref in cross_ref_summaries[:10]:  # Cap at 10 to manage prompt size
            citation = ref["citation"]
            summary = ref["summary"]
            if len(summary) > 150:
                summary = summary[:147] + "..."
            parts.append(f"- {citation}: {summary}")
        if len(cross_ref_summaries) > 10:
            parts.append(f"  (and {len(cross_ref_summaries) - 10} more)")
        parts.append("")

    # Document content
    parts.append("DOCUMENT CONTENT:")
    parts.append(content)
    parts.append("")
    parts.append("Summarize this guidance document.")

    return "\n".join(parts)
