"""
resolver.py - Resolve extracted citations to database document IDs

This module takes extracted references and attempts to find the
corresponding documents in our database.

RESOLUTION STRATEGY:
1. Build in-memory cache of all documents with citations
2. For each extracted reference, try exact match first
3. Apply fallback strategies if exact match fails
4. Mark unresolved references (for review)

FALLBACK STRATEGIES:
- NYCRR: Try stripping (a)(1) subsection, try Part-level match
- NJAC: Try stripping trailing letter, try without subsection
"""

import re
import os
from typing import Dict, Optional, List
from dataclasses import dataclass

import psycopg
from dotenv import load_dotenv

from .extractor import ExtractedReference, DocumentExtractionResult, SourceDocContext
from .patterns import RefType

load_dotenv()


@dataclass
class ResolvedTarget:
    """Information about a resolved target document."""
    document_id: int
    title: str
    citation: Optional[str]
    hierarchy_level: Optional[str]


class ReferenceResolver:
    """
    Resolves extracted citations to document IDs in the database.

    Usage:
        resolver = ReferenceResolver()
        resolver.resolve_all(extraction_result)
        # Now extraction_result.references have is_resolved, target_document_id, etc.
    """

    def __init__(self, database_url: Optional[str] = None):
        """Initialize and build lookup caches."""
        self.database_url = database_url or os.getenv("DATABASE_URL")
        self.conn = psycopg.connect(self.database_url)

        # Caches: citation_string -> ResolvedTarget
        self.nycrr_cache: Dict[str, ResolvedTarget] = {}
        self.njac_cache: Dict[str, ResolvedTarget] = {}

        self._build_caches()

    def _build_caches(self):
        """
        Build in-memory caches for fast citation lookup.

        We build two separate caches:
        1. NYCRR: keyed by "{title} NYCRR {section}" format
        2. NJAC: keyed by "N.J.A.C. {title}:{chapter}-{section}" format
        """
        print("Building citation lookup caches...")

        # NYCRR cache (New York)
        # Query documents that have both nycrr_title and nycrr_section
        cursor = self.conn.execute("""
            SELECT
                id,
                title,
                citation,
                hierarchy_level,
                nycrr_title,
                nycrr_section,
                nycrr_part
            FROM regulatory_documents
            WHERE jurisdiction = 'NY'
              AND nycrr_title IS NOT NULL
              AND (nycrr_section IS NOT NULL OR nycrr_part IS NOT NULL)
        """)

        for row in cursor:
            doc_id, title, citation, level, nycrr_title, nycrr_section, nycrr_part = row

            target = ResolvedTarget(
                document_id=doc_id,
                title=title or "",
                citation=citation,
                hierarchy_level=level
            )

            # Primary key: "{title} NYCRR {section}"
            if nycrr_section:
                key = f"{nycrr_title} NYCRR {nycrr_section}"
                self.nycrr_cache[key] = target

            # Also index by Part: "{title} NYCRR {part}"
            if nycrr_part:
                part_key = f"{nycrr_title} NYCRR {nycrr_part}"
                # Don't overwrite section-level entry
                if part_key not in self.nycrr_cache:
                    self.nycrr_cache[part_key] = target

        print(f"  NYCRR cache: {len(self.nycrr_cache)} entries")

        # NJAC cache (New Jersey)
        cursor = self.conn.execute("""
            SELECT
                id,
                title,
                citation,
                hierarchy_level,
                njac_title,
                njac_chapter,
                njac_subchapter,
                njac_section
            FROM regulatory_documents
            WHERE jurisdiction = 'NJ'
              AND njac_title IS NOT NULL
              AND njac_chapter IS NOT NULL
        """)

        for row in cursor:
            (doc_id, title, citation, level,
             njac_title, njac_chapter, njac_subchapter, njac_section) = row

            target = ResolvedTarget(
                document_id=doc_id,
                title=title or "",
                citation=citation,
                hierarchy_level=level
            )

            # Primary key: use citation column directly (e.g., "N.J.A.C. 19:42A-1.1")
            # This avoids issues where njac_section contains the full citation
            if citation and citation.startswith("N.J.A.C."):
                self.njac_cache[citation] = target

            # Also index at chapter level for "N.J.A.C. 7:50" style refs
            chapter_key = f"N.J.A.C. {njac_title}:{njac_chapter}"
            if chapter_key not in self.njac_cache:
                self.njac_cache[chapter_key] = target

        print(f"  NJAC cache: {len(self.njac_cache)} entries")
        print()

    def resolve(
        self,
        ref: ExtractedReference,
        source_context: Optional[SourceDocContext] = None
    ) -> bool:
        """
        Attempt to resolve a single reference.

        Updates the reference in-place with resolution results.
        Returns True if resolved, False otherwise.

        Args:
            ref: The reference to resolve
            source_context: Optional context from source doc (needed for short-form refs)
        """
        target = None

        if ref.ref_type == RefType.NYCRR:
            target = self._resolve_nycrr(ref.normalized_citation)
        elif ref.ref_type == RefType.NJAC:
            target = self._resolve_njac(ref.normalized_citation)
        elif ref.ref_type == RefType.NY_SHORT_FORM:
            target = self._resolve_ny_short_form(ref, source_context)
        elif ref.ref_type == RefType.SAME_SECTION:
            # Same-section refs are relative, can't resolve to different doc
            # Mark as "resolved" but with no target_document_id
            ref.is_resolved = True
            return True

        if target:
            ref.is_resolved = True
            ref.target_document_id = target.document_id
            ref.target_title = target.title
            ref.target_citation = target.citation
            return True

        return False

    def _resolve_nycrr(self, citation: str) -> Optional[ResolvedTarget]:
        """
        Resolve NYCRR citation with fallbacks.

        Fallback order:
        1. Exact match: "18 NYCRR 505.14"
        2. Strip subsection: "18 NYCRR 505.14(a)" -> "18 NYCRR 505.14"
        3. Part level: "18 NYCRR 505.14" -> "18 NYCRR 505"
        """
        # 1. Exact match
        if citation in self.nycrr_cache:
            return self.nycrr_cache[citation]

        # 2. Strip (a)(1) style subsection (should already be stripped, but double-check)
        stripped = re.sub(r'\([a-z]\)(?:\(\d+\))?$', '', citation, flags=re.IGNORECASE)
        if stripped != citation and stripped in self.nycrr_cache:
            return self.nycrr_cache[stripped]

        # 3. Part level (strip everything after decimal)
        # "18 NYCRR 505.14" -> "18 NYCRR 505"
        match = re.match(r'(\d+\s+NYCRR\s+\d+)', citation)
        if match:
            part_key = match.group(1)
            if part_key in self.nycrr_cache:
                return self.nycrr_cache[part_key]

        return None

    def _resolve_njac(self, citation: str) -> Optional[ResolvedTarget]:
        """
        Resolve NJAC citation with fallbacks.

        Fallback order:
        1. Exact match: "N.J.A.C. 8:43-1.2"
        2. Strip trailing letter: "N.J.A.C. 8:43-1.2a" -> "N.J.A.C. 8:43-1.2"
        3. Strip (a) style subsection
        4. Chapter level: "N.J.A.C. 8:43-1.2" -> "N.J.A.C. 8:43"
        """
        # 1. Exact match
        if citation in self.njac_cache:
            return self.njac_cache[citation]

        # 2. Strip trailing lowercase letter
        stripped = re.sub(r'[a-z]$', '', citation, flags=re.IGNORECASE)
        if stripped != citation and stripped in self.njac_cache:
            return self.njac_cache[stripped]

        # 3. Strip (a) style subsection
        stripped2 = re.sub(r'\([a-z]\)(?:\(\d+\))?$', '', citation, flags=re.IGNORECASE)
        if stripped2 != citation and stripped2 in self.njac_cache:
            return self.njac_cache[stripped2]

        # 4. Chapter level (strip section)
        # "N.J.A.C. 8:43-1.2" -> "N.J.A.C. 8:43"
        match = re.match(r'(N\.J\.A\.C\.\s+\d+[A-Za-z]?:\d+[A-Za-z]?)', citation)
        if match:
            chapter_key = match.group(1)
            if chapter_key in self.njac_cache:
                return self.njac_cache[chapter_key]

        return None

    def _resolve_ny_short_form(
        self,
        ref: ExtractedReference,
        source_context: Optional[SourceDocContext]
    ) -> Optional[ResolvedTarget]:
        """
        Resolve NY short-form citation using source document context.

        For "section 624.8 of this Part" in source doc 14 NYCRR 624.6:
        1. Extract: section=624.8, scope=Part
        2. Get source context: nycrr_title=14
        3. Construct: "14 NYCRR 624.8"
        4. Lookup in existing NYCRR cache

        Args:
            ref: The short-form reference with components
            source_context: Context from the source document

        Returns:
            ResolvedTarget if found, None otherwise
        """
        if not source_context or not source_context.nycrr_title:
            # Can't resolve without source context
            return None

        section = ref.components.get('section_base')
        scope = ref.components.get('scope')  # 'part', 'subpart', or 'title'

        if not section:
            return None

        # Both "Part" and "Title" scopes use the source's nycrr_title
        # The section number is what differs
        # For "section 624.8 of this Part" -> same title, referenced section
        # For "section 52.13 of this Title" -> same title, different part

        nycrr_title = source_context.nycrr_title
        full_citation = f"{nycrr_title} NYCRR {section}"

        # Try to resolve using existing NYCRR cache
        return self._resolve_nycrr(full_citation)

    def resolve_all(self, result: DocumentExtractionResult) -> DocumentExtractionResult:
        """
        Resolve all references in a DocumentExtractionResult.

        Updates the result in-place and returns it.
        Passes source_context for short-form resolution.
        """
        for ref in result.references:
            self.resolve(ref, source_context=result.source_context)

        result.compute_stats()
        return result

    def resolve_batch(
        self,
        results: List[DocumentExtractionResult]
    ) -> List[DocumentExtractionResult]:
        """Resolve references in multiple extraction results."""
        for result in results:
            self.resolve_all(result)
        return results

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    from .extractor import ReferenceExtractor

    # Test resolution with sample data
    print("=" * 60)
    print("RESOLUTION TEST")
    print("=" * 60)

    try:
        resolver = ReferenceResolver()

        # Test some lookups
        test_citations = [
            ("18 NYCRR 505.14", RefType.NYCRR),
            ("N.J.A.C. 8:43-1.2", RefType.NJAC),
            ("10 NYCRR 405.3", RefType.NYCRR),
            ("N.J.A.C. 7:50-6", RefType.NJAC),
        ]

        print("\nTesting direct cache lookups...")
        for citation, ref_type in test_citations:
            if ref_type == RefType.NYCRR:
                target = resolver._resolve_nycrr(citation)
            else:
                target = resolver._resolve_njac(citation)

            print(f"\n  Citation: {citation}")
            if target:
                print(f"  ✓ Resolved to: {target.document_id}")
                print(f"    Title: {target.title[:60]}...")
            else:
                print(f"  ✗ Not resolved")

        resolver.close()

    except Exception as e:
        print(f"Error: {e}")
        print("(This test requires database access with actual data)")
