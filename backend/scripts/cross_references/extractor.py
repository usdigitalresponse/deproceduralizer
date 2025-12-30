"""
extractor.py - Extract internal cross-references from document content

This module takes document content and produces a list of extracted references
with surrounding context. It does NOT resolve references to document IDs -
that's handled by resolver.py.

WORKFLOW:
1. Apply regex patterns from patterns.py
2. Expand comma/and-separated citation lists into individual references
3. Add surrounding context (for display and debugging)
4. Return structured list of ExtractedReference objects (all occurrences kept)
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from .patterns import extract_all_matches, PatternMatch, RefType


@dataclass
class ExtractedReference:
    """
    A single cross-reference extracted from document content.

    This is the "raw" extraction - resolution to document IDs
    happens in a separate step.
    """
    # Reference identification
    ref_type: RefType
    raw_text: str                      # Exact text matched
    normalized_citation: str           # Cleaned up citation for lookup

    # Position in source document
    start_offset: int
    end_offset: int

    # Context (for display and debugging)
    context_before: str = ""           # ~50 chars before match
    context_after: str = ""            # ~50 chars after match

    # Parsed components (for advanced lookups)
    components: Dict[str, Any] = field(default_factory=dict)

    # Resolution (filled in by resolver.py)
    is_resolved: bool = False
    target_document_id: Optional[int] = None
    target_title: Optional[str] = None
    target_citation: Optional[str] = None

    @property
    def full_context(self) -> str:
        """Return the reference with surrounding context."""
        return f"...{self.context_before}[{self.raw_text}]{self.context_after}..."

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'ref_type': self.ref_type.value,
            'raw_text': self.raw_text,
            'normalized_citation': self.normalized_citation,
            'start_offset': self.start_offset,
            'end_offset': self.end_offset,
            'context_before': self.context_before,
            'context_after': self.context_after,
            'components': self.components,
            'is_resolved': self.is_resolved,
            'target_document_id': self.target_document_id,
            'target_title': self.target_title,
            'target_citation': self.target_citation,
        }


@dataclass
class SourceDocContext:
    """
    Context from the source document needed to resolve short-form refs.

    For NY short-form patterns like "section 624.8 of this Part",
    we need the source document's nycrr_title to construct the full citation.
    """
    nycrr_title: Optional[int] = None
    nycrr_part: Optional[str] = None
    nycrr_section: Optional[str] = None
    njac_title: Optional[str] = None
    njac_chapter: Optional[str] = None


@dataclass
class DocumentExtractionResult:
    """
    All references extracted from a single document.
    """
    source_document_id: int
    source_title: str
    source_citation: Optional[str]
    state: str

    # Source document context for resolving short-form refs
    source_context: Optional[SourceDocContext] = None

    references: List[ExtractedReference] = field(default_factory=list)

    # Summary stats (computed after extraction)
    total_count: int = 0
    nycrr_count: int = 0
    njac_count: int = 0
    ny_short_form_count: int = 0
    same_section_count: int = 0

    # After resolution
    resolved_count: int = 0
    unresolved_count: int = 0

    def compute_stats(self):
        """Compute summary statistics."""
        self.total_count = len(self.references)
        self.nycrr_count = sum(1 for r in self.references if r.ref_type == RefType.NYCRR)
        self.njac_count = sum(1 for r in self.references if r.ref_type == RefType.NJAC)
        self.ny_short_form_count = sum(1 for r in self.references if r.ref_type == RefType.NY_SHORT_FORM)
        self.same_section_count = sum(1 for r in self.references if r.ref_type == RefType.SAME_SECTION)
        self.resolved_count = sum(1 for r in self.references if r.is_resolved)
        self.unresolved_count = self.total_count - self.resolved_count

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        self.compute_stats()
        result = {
            'source_document_id': self.source_document_id,
            'source_title': self.source_title,
            'source_citation': self.source_citation,
            'state': self.state,
            'total_count': self.total_count,
            'nycrr_count': self.nycrr_count,
            'njac_count': self.njac_count,
            'ny_short_form_count': self.ny_short_form_count,
            'same_section_count': self.same_section_count,
            'resolved_count': self.resolved_count,
            'unresolved_count': self.unresolved_count,
            'references': [r.to_dict() for r in self.references],
        }
        # Include source context if present (for debugging short-form resolution)
        if self.source_context:
            result['source_context'] = {
                'nycrr_title': self.source_context.nycrr_title,
                'nycrr_part': self.source_context.nycrr_part,
                'nycrr_section': self.source_context.nycrr_section,
            }
        return result


class ReferenceExtractor:
    """
    Extracts internal cross-references from regulatory documents.

    Usage:
        extractor = ReferenceExtractor(context_chars=50)
        result = extractor.extract(
            document_id=1234,
            title="Section 505.14",
            citation="18 NYCRR 505.14",
            content="...",
            state="NY"
        )
    """

    def __init__(self, context_chars: int = 50):
        """
        Args:
            context_chars: Number of characters to capture before/after each match
        """
        self.context_chars = context_chars

    def extract(
        self,
        document_id: int,
        title: str,
        content: str,
        state: str,
        citation: Optional[str] = None,
        source_context: Optional[SourceDocContext] = None
    ) -> DocumentExtractionResult:
        """
        Extract all internal references from document content.

        Args:
            document_id: Database ID of source document
            title: Document title
            content: Full text content
            state: State code ('NY' or 'NJ')
            citation: Optional citation string for the document
            source_context: Optional hierarchy context for resolving short-form refs

        Returns:
            DocumentExtractionResult with all extracted references
        """
        result = DocumentExtractionResult(
            source_document_id=document_id,
            source_title=title,
            source_citation=citation,
            state=state.upper(),
            source_context=source_context
        )

        if not content:
            return result

        # Extract raw matches using patterns
        matches = extract_all_matches(content)

        # Convert to ExtractedReference objects with context
        # Note: We intentionally keep all occurrences (no deduplication)
        # so that every instance of a citation gets highlighted
        for match in matches:

            # Extract surrounding context
            ctx_start = max(0, match.start - self.context_chars)
            ctx_end = min(len(content), match.end + self.context_chars)

            context_before = content[ctx_start:match.start]
            context_after = content[match.end:ctx_end]

            # Clean up context (remove newlines, collapse whitespace)
            context_before = ' '.join(context_before.split())
            context_after = ' '.join(context_after.split())

            ref = ExtractedReference(
                ref_type=match.ref_type,
                raw_text=match.raw_text,
                normalized_citation=match.normalized,
                start_offset=match.start,
                end_offset=match.end,
                context_before=context_before,
                context_after=context_after,
                components=match.components
            )

            result.references.append(ref)

        result.compute_stats()
        return result

    def extract_batch(
        self,
        documents: List[Dict[str, Any]]
    ) -> List[DocumentExtractionResult]:
        """
        Extract references from multiple documents.

        Args:
            documents: List of dicts with keys:
                - id, title, content, state, citation (required)
                - nycrr_title, nycrr_part, nycrr_section (optional, for NY)
                - njac_title, njac_chapter (optional, for NJ)

        Returns:
            List of DocumentExtractionResult objects
        """
        results = []

        for doc in documents:
            # Build source context from hierarchy columns if present
            source_context = None
            if doc.get('nycrr_title') or doc.get('njac_title'):
                source_context = SourceDocContext(
                    nycrr_title=doc.get('nycrr_title'),
                    nycrr_part=doc.get('nycrr_part'),
                    nycrr_section=doc.get('nycrr_section'),
                    njac_title=doc.get('njac_title'),
                    njac_chapter=doc.get('njac_chapter'),
                )

            result = self.extract(
                document_id=doc['id'],
                title=doc.get('title', ''),
                content=doc.get('content', ''),
                state=doc.get('state', ''),
                citation=doc.get('citation'),
                source_context=source_context
            )
            results.append(result)

        return results


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    # Test with sample content
    test_content = """
    Section 505.14 - Covered Services

    (a) General requirements. All providers must comply with the standards
    set forth in 18 NYCRR 505.1 and the applicable provisions of N.J.A.C. 8:43-1.2.

    (b) Exceptions. The requirements of paragraph (a) of this section do not
    apply to services covered under 10 NYCRR 405.3 or as otherwise specified
    in subdivision (c)(1) below.

    (c) Special provisions.
        (1) For services rendered pursuant to N.J.A.C. 8:43D-4.6, providers
        must also meet the standards in 18 NYCRR 505.14(a)(1).
    """

    extractor = ReferenceExtractor(context_chars=40)
    result = extractor.extract(
        document_id=1234,
        title="Section 505.14 - Covered Services",
        content=test_content,
        state="NY",
        citation="18 NYCRR 505.14"
    )

    print("=" * 60)
    print("EXTRACTION RESULT")
    print("=" * 60)
    print(f"Source: {result.source_citation} ({result.source_title})")
    print(f"Total references: {result.total_count}")
    print(f"  NYCRR: {result.nycrr_count}")
    print(f"  NJAC: {result.njac_count}")
    print(f"  Same-section: {result.same_section_count}")
    print()

    for i, ref in enumerate(result.references, 1):
        print(f"[{i}] {ref.ref_type.value.upper()}: {ref.normalized_citation}")
        print(f"    Raw: '{ref.raw_text}'")
        print(f"    Context: {ref.full_context}")
        print()
