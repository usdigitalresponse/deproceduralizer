"""
patterns.py - Regex patterns for internal cross-references

Phase 1: FULL-FORM citations with explicit prefixes:
- NYCRR: "18 NYCRR 505.14", "18 N.Y.C.R.R. 505.14"
- NJAC: "N.J.A.C. 8:43-1.2", "NJAC 8:43-1.2"
- Same-section: "(a)(1) above", "subdivision (b) of this section"

Phase 2: SHORT-FORM patterns (context-dependent):
- NY: "section 505.14 of this Part", "section 52.13 of this Title"
- These require source document context to resolve
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Tuple, Optional


class RefType(Enum):
    """Types of internal references we extract."""
    NYCRR = "nycrr"                   # New York Codes, Rules and Regulations (full-form)
    NJAC = "njac"                     # New Jersey Administrative Code (full-form)
    NY_SHORT_FORM = "ny_short_form"   # NY short-form like "section 505.14 of this Part"
    SAME_SECTION = "same_section"     # Relative refs like "(a)(1) of this section"
    # Note: SAME_SECTION captured for validation but filtered from final output


@dataclass
class PatternMatch:
    """Result of a pattern match."""
    ref_type: RefType
    raw_text: str              # Full matched text
    normalized: str            # Cleaned citation for lookup
    start: int                 # Start offset in source
    end: int                   # End offset in source
    components: dict           # Parsed parts (title, section, etc.)


# =============================================================================
# NYCRR PATTERNS (New York) - Phase 1: Full-form only
# =============================================================================
#
# Examples we match:
#   "18 NYCRR 505.14"
#   "18 N.Y.C.R.R. § 505.14"
#   "18 NYCRR Part 505"
#   "18 NYCRR 505.14(a)(1)"
#   "6 NYCRR Part 371"
#
# We normalize all to: "{title} NYCRR {section}"

NYCRR_PATTERN = re.compile(
    r'''
    (\d{1,2})                              # (1) Title number (1-2 digits)
    \s*
    (?:NYCRR|N\.Y\.C\.R\.R\.)              # NYCRR identifier (various forms)
    \s*
    (?:(?:Part|§|section|Sec\.)\s*)?       # Optional prefix (Part, §, section)
    (\d+                                   # (2) Part/section number
     (?:-\d+)?                             # Optional hyphenated subpart (e.g., 505-1)
     (?:\.\d+)?                            # Optional decimal section (e.g., 505.14)
     (?:\([a-z]\))?                        # Optional subsection letter (a)
     (?:\(\d+\))?                          # Optional paragraph number (1)
     (?:\([ivx]+\))?                       # Optional roman numeral (i)
    )
    ''',
    re.IGNORECASE | re.VERBOSE
)


def parse_nycrr_match(match: re.Match) -> Optional[PatternMatch]:
    """Parse a NYCRR regex match into structured data."""
    title = match.group(1)
    section = match.group(2)

    # Normalize: strip trailing subsection markers for lookup
    # Keep the full text as raw_text
    section_base = re.sub(r'\([a-z]\)(?:\(\d+\))?(?:\([ivx]+\))?$', '', section, flags=re.IGNORECASE)
    normalized = f"{title} NYCRR {section_base}"

    return PatternMatch(
        ref_type=RefType.NYCRR,
        raw_text=match.group(0),
        normalized=normalized,
        start=match.start(),
        end=match.end(),
        components={
            'title': title,
            'section': section,
            'section_base': section_base,
            'state': 'NY'
        }
    )


# =============================================================================
# NJAC PATTERNS (New Jersey) - Phase 1: Full-form only
# =============================================================================
#
# Examples we match:
#   "N.J.A.C. 8:43-1.2"
#   "N.J.A.C. 8:43D-4.6"
#   "NJAC 10:44A-1.1"
#   "N.J.A.C. 8:43-1.2(a)"
#   "N.J.A.C. 7:50-6 et seq."
#
# NJ citation format: [Title]:[Chapter][Suffix]-[Section]
#   Title: 1-19 (can have letter suffix like "10A")
#   Chapter: number, can have letter suffix (like "43D")
#   Section: number with decimals (like "1.2")
#
# We normalize to: "N.J.A.C. {title}:{chapter}-{section}"

NJAC_PATTERN = re.compile(
    r'''
    (?:N\.?J\.?A\.?C\.?|NJAC)              # N.J.A.C. or NJAC (various punctuation)
    \s*
    (\d{1,2}[A-Za-z]?)                     # (1) Title (e.g., "8", "10A")
    :
    (\d+[A-Za-z]?)                         # (2) Chapter (e.g., "43", "43D")
    -
    (\d+(?:\.\d+)?                         # (3) Section (e.g., "1.2", "6")
     (?:[a-z])?                            # Optional subsection letter suffix
     (?:\([a-z]\))?                        # Optional (a) style subsection
     (?:\(\d+\))?                          # Optional (1) style paragraph
    )
    (?:\s+et\s+seq\.?)?                    # Optional "et seq." suffix
    ''',
    re.IGNORECASE | re.VERBOSE
)


def parse_njac_match(match: re.Match) -> Optional[PatternMatch]:
    """Parse an NJAC regex match into structured data."""
    title = match.group(1)
    chapter = match.group(2)
    section = match.group(3)

    # Normalize: strip trailing subsection markers for lookup
    section_base = re.sub(r'[a-z]?(?:\([a-z]\))?(?:\(\d+\))?$', '', section, flags=re.IGNORECASE)
    if not section_base:
        section_base = section  # Don't strip everything

    normalized = f"N.J.A.C. {title}:{chapter}-{section_base}"

    return PatternMatch(
        ref_type=RefType.NJAC,
        raw_text=match.group(0),
        normalized=normalized,
        start=match.start(),
        end=match.end(),
        components={
            'title': title,
            'chapter': chapter,
            'section': section,
            'section_base': section_base,
            'state': 'NJ'
        }
    )


# =============================================================================
# NJAC LIST EXPANSION
# =============================================================================
#
# Handles comma/and/or-separated abbreviated sections after a full NJAC citation.
# Example: "N.J.A.C. 7:1A-3.1, 4.1, 5.1 and 7.4"
#   - Initial match: "N.J.A.C. 7:1A-3.1"
#   - Abbreviated: "4.1", "5.1", "7.4" (inherit title:chapter prefix)
#
# Also detects chapter switches like "N.J.A.C. 7:22-3 and 7:22A-6"
# where "7:22A-6" should NOT inherit the 7:22 prefix.

# Pattern for abbreviated section (just a number like "4.1" or "2.3(i)")
NJAC_ABBREVIATED_SECTION = re.compile(
    r'''
    ^                                      # Start of remaining text
    (?:,\s*|,?\s+and\s+|,?\s+or\s+)        # Separator: comma, "and", or "or"
    (?!N\.?J\.?A\.?C\.?)                   # NOT followed by NJAC prefix
    (?!et\s+seq)                           # NOT followed by "et seq"
    (
        (?:                                # Option A: Chapter switch (e.g., "7:22A-6")
            \d{1,2}[A-Za-z]?               # Title
            :
            \d+[A-Za-z]?                   # Chapter
            -
            \d+(?:\.\d+)?                  # Section
            (?:[a-z])?                     # Optional suffix
            (?:\([a-z]\))?                 # Optional (a)
            (?:\(\d+\))?                   # Optional (1)
        )
        |
        (?:                                # Option B: Abbreviated section (e.g., "4.1")
            \d+(?:\.\d+)?                  # Section number
            (?:[a-z])?                     # Optional letter suffix
            (?:\([a-z]\))?                 # Optional (a) subsection
            (?:\(\d+\))?                   # Optional (1) paragraph
            (?:[ivx]+)?                    # Optional roman numeral suffix
        )
    )
    ''',
    re.IGNORECASE | re.VERBOSE
)


def is_chapter_switch(section_text: str) -> bool:
    """Check if an abbreviated section is actually a full citation with chapter switch."""
    return ':' in section_text and '-' in section_text


def expand_njac_list(content: str, initial_match: PatternMatch) -> List[PatternMatch]:
    """
    Given an initial NJAC match, look for comma/and/or-separated abbreviated sections.

    Example: "N.J.A.C. 7:1A-3.1, 4.1, 5.1 or 7.4"
    Returns matches for: 3.1 (original), 4.1, 5.1, 7.4 (each with full normalized citation)

    For chapter switches like "N.J.A.C. 7:22-3 and 7:22A-6", the second part
    is treated as a new full citation, not abbreviated.
    """
    results = [initial_match]  # Always include the original

    # Extract the title:chapter prefix (e.g., "7:1A-")
    title = initial_match.components.get('title', '')
    chapter = initial_match.components.get('chapter', '')
    prefix = f"{title}:{chapter}-"

    # Start looking right after the initial match
    search_start = initial_match.end
    remaining = content[search_start:]

    # Keep matching abbreviated sections
    pos = 0
    max_lookahead = 200  # Don't look too far ahead

    while pos < len(remaining) and pos < max_lookahead:
        m = NJAC_ABBREVIATED_SECTION.match(remaining[pos:])
        if not m:
            break

        section = m.group(1)
        separator_len = m.start(1)  # Length of separator before section

        # Calculate absolute positions for just the section number (not the separator)
        abs_start = search_start + pos + separator_len
        abs_end = search_start + pos + m.end(1)

        # Check if this is a chapter switch (full citation embedded)
        if is_chapter_switch(section):
            # Parse as full NJAC citation
            # Format: "7:22A-6" -> title=7, chapter=22A, section=6
            parts = section.split(':')
            if len(parts) == 2:
                new_title = parts[0]
                chapter_section = parts[1].split('-')
                if len(chapter_section) == 2:
                    new_chapter = chapter_section[0]
                    new_section = chapter_section[1]

                    # Strip subsection markers for normalization
                    section_base = re.sub(r'[a-z]?(?:\([a-z]\))?(?:\(\d+\))?$', '', new_section, flags=re.IGNORECASE)
                    if not section_base:
                        section_base = new_section

                    normalized = f"N.J.A.C. {new_title}:{new_chapter}-{section_base}"

                    results.append(PatternMatch(
                        ref_type=RefType.NJAC,
                        raw_text=section,
                        normalized=normalized,
                        start=abs_start,
                        end=abs_end,
                        components={
                            'title': new_title,
                            'chapter': new_chapter,
                            'section': new_section,
                            'section_base': section_base,
                            'is_list_item': True,
                            'inferred_from': initial_match.normalized,
                            'state': 'NJ'
                        }
                    ))

                    # Update prefix for subsequent items
                    title = new_title
                    chapter = new_chapter
                    prefix = f"{new_title}:{new_chapter}-"
        else:
            # Abbreviated section - inherit title:chapter from parent
            section_base = re.sub(r'[a-z]?(?:\([a-z]\))?(?:\(\d+\))?(?:[ivx]+)?$', '', section, flags=re.IGNORECASE)
            if not section_base:
                section_base = section

            normalized = f"N.J.A.C. {prefix}{section_base}"

            results.append(PatternMatch(
                ref_type=RefType.NJAC,
                raw_text=section,
                normalized=normalized,
                start=abs_start,
                end=abs_end,
                components={
                    'title': title,
                    'chapter': chapter,
                    'section': section,
                    'section_base': section_base,
                    'is_list_item': True,
                    'is_abbreviated': True,
                    'inferred_from': initial_match.normalized,
                    'state': 'NJ'
                }
            ))

        pos += m.end()

    return results


# =============================================================================
# NY SHORT-FORM PATTERNS (Phase 2)
# =============================================================================
#
# These are context-dependent citations that omit the title/NYCRR prefix.
# They require the source document's nycrr_title to resolve.
#
# Examples:
#   "section 505.14 of this Part"
#   "section 52.13 of this Title"
#   "section 368-1.4 of this Subpart"
#   "§ 624.8 of this Part"
#
# Pattern frequency from database analysis:
#   5,432 docs: "section X.X of this Part"
#   2,544 docs: "Part X of this Title"
#   2,372 docs: "section X.X of this Title"
#
# We normalize to: "{section}" with scope indicator in components

NY_SHORT_FORM_PATTERN = re.compile(
    r'''
    (?:section|§)\s*
    (\d+                           # (1) Part/section number
     (?:-\d+)?                     # Optional hyphenated subpart (e.g., 368-1)
     (?:\.\d+)?                    # Optional decimal section (e.g., .14)
     (?:\([a-z]\))?                # Optional subsection letter (a)
     (?:\(\d+\))?                  # Optional paragraph number (1)
    )
    \s+of\s+this\s+
    (Part|Subpart|Title)           # (2) Scope indicator
    ''',
    re.IGNORECASE | re.VERBOSE
)


def parse_ny_short_form_match(match: re.Match) -> Optional[PatternMatch]:
    """Parse a NY short-form regex match into structured data."""
    section = match.group(1)
    scope = match.group(2)

    # Strip subsection markers for lookup
    section_base = re.sub(r'\([a-z]\)(?:\(\d+\))?$', '', section, flags=re.IGNORECASE)

    return PatternMatch(
        ref_type=RefType.NY_SHORT_FORM,
        raw_text=match.group(0),
        normalized=section_base,  # Just the section, will be combined with source context
        start=match.start(),
        end=match.end(),
        components={
            'section': section,
            'section_base': section_base,
            'scope': scope.lower(),  # 'part', 'subpart', or 'title'
            'state': 'NY',
            'requires_context': True
        }
    )


# =============================================================================
# SAME-SECTION PATTERNS (Relative References)
# =============================================================================
#
# These are references within the same document/section.
# We capture them to ensure they don't get misclassified as external refs,
# but filter them from final output (not useful for clickability).
#
# Examples:
#   "paragraph (a) of this section"
#   "subdivision (b)(1) of this section"  (NY terminology)
#   "(a)(1) above"

SAME_SECTION_PATTERN = re.compile(
    r'''
    (?:
        # Format 1: "paragraph/subdivision/subsection (a) of this section/part"
        (?:paragraph|subdivision|subsection|subparagraph|clause)
        \s*
        (\([a-z]\)(?:\(\d+\))?(?:\([ivx]+\))?)   # (1) Reference like (a)(1)(i)
        \s*
        (?:of\s+this\s+(?:section|part|subpart|chapter|rule))?
        (?!\s*of\s+N\.?J\.?A\.?C)                # Not followed by "of N.J.A.C."
        (?!\s*of\s+\d+\s*NYCRR)                  # Not followed by "of 18 NYCRR"
    )
    |
    (?:
        # Format 2: "pursuant to (b)(1) of this section" (NOT "of N.J.A.C.")
        (?:pursuant\s+to|under|in|per|set\s+forth\s+in)
        \s+
        (\([a-z]\)(?:\(\d+\))?)                  # (2) Reference
        \s*
        (?:of\s+this\s+(?:section|part))?
        (?!\s*of\s*N\.?J\.?A\.?C)                # Not "of N.J.A.C."
        (?!\s*of\s*\d+\s*NYCRR)                  # Not "of 18 NYCRR"
    )
    |
    (?:
        # Format 3: "(a)(1) above" or "(b) below"
        (\([a-z]\)(?:\(\d+\))?)                  # (3) Reference
        \s+
        (?:above|below|herein)
    )
    ''',
    re.IGNORECASE | re.VERBOSE
)


def parse_same_section_match(match: re.Match) -> Optional[PatternMatch]:
    """Parse a same-section reference match."""
    groups = match.groups()

    # Find which group matched
    ref_text = None
    for g in groups:
        if g:
            ref_text = g
            break

    if not ref_text:
        return None

    return PatternMatch(
        ref_type=RefType.SAME_SECTION,
        raw_text=match.group(0),
        normalized=ref_text,  # Just the (a)(1) part
        start=match.start(),
        end=match.end(),
        components={
            'subsection_ref': ref_text,
            'is_relative': True
        }
    )


# =============================================================================
# PATTERN REGISTRY
# =============================================================================

PATTERNS: List[Tuple[re.Pattern, callable]] = [
    (NYCRR_PATTERN, parse_nycrr_match),
    (NJAC_PATTERN, parse_njac_match),
    (NY_SHORT_FORM_PATTERN, parse_ny_short_form_match),
    (SAME_SECTION_PATTERN, parse_same_section_match),
]


def extract_all_matches(content: str) -> List[PatternMatch]:
    """
    Extract all internal references from content.

    Returns matches in order of appearance, avoiding overlaps.
    For NJAC matches, also expands comma/and-separated lists.
    """
    all_matches: List[PatternMatch] = []
    matched_spans: List[Tuple[int, int]] = []

    for pattern, parser in PATTERNS:
        for match in pattern.finditer(content):
            # Skip if this span overlaps with an existing match
            start, end = match.span()
            overlaps = any(
                not (end <= existing_start or start >= existing_end)
                for existing_start, existing_end in matched_spans
            )

            if overlaps:
                continue

            # Parse the match
            parsed = parser(match)
            if parsed:
                # For NJAC matches, expand comma/and-separated lists
                if parsed.ref_type == RefType.NJAC:
                    expanded = expand_njac_list(content, parsed)
                    for exp_match in expanded:
                        # Check each expanded match for overlaps
                        exp_overlaps = any(
                            not (exp_match.end <= existing_start or exp_match.start >= existing_end)
                            for existing_start, existing_end in matched_spans
                        )
                        if not exp_overlaps:
                            all_matches.append(exp_match)
                            matched_spans.append((exp_match.start, exp_match.end))
                else:
                    all_matches.append(parsed)
                    matched_spans.append((start, end))

    # Sort by position in document
    all_matches.sort(key=lambda m: m.start)

    return all_matches


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    # Test 1: Comma-separated list expansion
    print("=" * 60)
    print("TEST 1: Comma-separated list expansion")
    print("=" * 60)

    list_test = "See N.J.A.C. 7:1A-3.1, 4.1, 5.1 and 7.4 for details."
    matches = extract_all_matches(list_test)

    print(f"Input: {list_test}")
    print(f"Found {len(matches)} references:\n")
    for m in matches:
        print(f"  Raw: '{m.raw_text}' -> Normalized: '{m.normalized}'")
        print(f"  Position: {m.start}-{m.end}, Text at position: '{list_test[m.start:m.end]}'")
        if m.components.get('is_abbreviated'):
            print(f"  (Abbreviated, inferred from: {m.components.get('inferred_from')})")
        print()

    # Test 2: Chapter switch detection
    print("=" * 60)
    print("TEST 2: Chapter switch detection")
    print("=" * 60)

    switch_test = "N.J.A.C. 7:22-3 and 7:22A-6 and 7"
    matches = extract_all_matches(switch_test)

    print(f"Input: {switch_test}")
    print(f"Found {len(matches)} references:\n")
    for m in matches:
        print(f"  Raw: '{m.raw_text}' -> Normalized: '{m.normalized}'")
        print()

    # Test 3: Original patterns still work
    print("=" * 60)
    print("TEST 3: Original patterns")
    print("=" * 60)

    test_text = """
    This regulation is pursuant to 18 NYCRR 505.14 and requires compliance
    with N.J.A.C. 8:43-1.2(a). See also paragraph (b)(1) of this section
    for exceptions. Additional requirements are found in 10 NYCRR 405.3
    and N.J.A.C. 7:50-6 et seq. Reference subdivision (a) above for details.

    The rules at 6 NYCRR Part 371 also apply. Per (c) of this section,
    providers must follow NJAC 10:44A-1.1 standards.

    Phase 2 short-form examples:
    See section 624.8 of this Part for emission limits.
    Refer to section 52.13 of this Title for definitions.
    Requirements in section 368-1.4 of this Subpart apply.
    As defined in § 405.3 of this Part.
    """

    matches = extract_all_matches(test_text)

    print(f"Found {len(matches)} references:\n")
    for m in matches:
        print(f"  Type: {m.ref_type.value}")
        print(f"  Raw:  '{m.raw_text}'")
        print(f"  Norm: '{m.normalized}'")
        print(f"  Pos:  {m.start}-{m.end}")
        print()
