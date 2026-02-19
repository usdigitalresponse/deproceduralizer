"""Tests for NY statute citation regex patterns in link_ny_statutes.py.

Covers:
- Pattern 1: "section X of the Y Law" variants
- Pattern 2: "Y Law section X" variants (including comma fix)
- Pattern 3: "subdivision (a) of section X of the Y Law" variants
- Pattern 4: plural "sections X and Y of the Z Law"
- Regressions: all currently-matched examples still work
- False positive guards: cases that should NOT match
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.link_ny_statutes import (
    PATTERN_SECTION_OF_LAW,
    PATTERN_LAW_SECTION,
    PATTERN_SUBDIV_SECTION_OF_LAW,
    CITATION_PATTERNS,
    extract_citations,
)


def _find_match(text, pattern):
    """Helper: return first match object or None."""
    return pattern.search(text)


def _extract_first(text):
    """Helper: run all patterns and return first (section_num, law_name) or None."""
    for pattern, section_group, law_name_group in CITATION_PATTERNS:
        m = pattern.search(text)
        if m:
            return m.group(section_group).strip(), m.group(law_name_group).strip()
    return None


# =============================================================================
# Pattern 1: "section X of the Y Law"
# =============================================================================

class TestPattern1SectionOfLaw:
    """Tests for PATTERN_SECTION_OF_LAW."""

    def test_basic_lowercase_section(self):
        text = "see section 488 of the Social Services Law for details"
        result = _extract_first(text)
        assert result == ("488", "Social Services")

    def test_section_symbol(self):
        text = "per § 296-a of the Executive Law requirements"
        result = _extract_first(text)
        assert result == ("296-a", "Executive")

    def test_capital_section(self):
        text = "Section 488 of the Social Services Law applies"
        result = _extract_first(text)
        assert result == ("488", "Social Services")

    def test_double_section_symbol(self):
        text = "§§ 488 of the Social Services Law"
        result = _extract_first(text)
        assert result == ("488", "Social Services")

    def test_parenthetical_subsections_ignored(self):
        """Trailing (18)(a)(1) should not prevent the match."""
        text = "section 813(18)(a)(1) of the General Municipal Law"
        result = _extract_first(text)
        assert result is not None
        assert result[0] == "813"
        assert result[1] == "General Municipal"

    def test_plural_sections(self):
        text = "sections 488 of the Social Services Law"
        result = _extract_first(text)
        assert result == ("488", "Social Services")

    def test_decimal_section(self):
        text = "section 119.1 of the Mental Hygiene Law"
        result = _extract_first(text)
        assert result == ("119.1", "Mental Hygiene")

    def test_hyphen_letter_suffix(self):
        text = "section 17-a of the Arts and Cultural Affairs Law"
        result = _extract_first(text)
        assert result == ("17-a", "Arts and Cultural Affairs")

    def test_multiword_law_name(self):
        text = "section 225 of the Racing, Pari-Mutuel Wagering and Breeding Law"
        result = _extract_first(text)
        assert result == ("225", "Racing, Pari-Mutuel Wagering and Breeding")


# =============================================================================
# Pattern 2: "Y Law section X"
# =============================================================================

class TestPattern2LawSection:
    """Tests for PATTERN_LAW_SECTION."""

    def test_basic_law_section(self):
        text = "Education Law section 4401 requires"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "4401"
        assert m.group(1).strip() == "Education"

    def test_law_section_symbol(self):
        text = "Public Health Law § 2801 mandates"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "2801"
        assert m.group(1).strip() == "Public Health"

    def test_comma_before_section(self):
        """Primary fix: 'General Municipal Law, section 813' should match."""
        text = "General Municipal Law, section 813(18)(a)(1)"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "813"
        assert m.group(1).strip() == "General Municipal"

    def test_capital_section(self):
        text = "Education Law Section 4401"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "4401"

    def test_double_section_symbol(self):
        text = "Education Law §§ 4401"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "4401"

    def test_parenthetical_subsections(self):
        text = "Social Services Law section 488(a)(2)"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "488"

    def test_hyphen_suffix_section(self):
        text = "Executive Law section 296-a"
        m = _find_match(text, PATTERN_LAW_SECTION)
        assert m is not None
        assert m.group(2).strip() == "296-a"


# =============================================================================
# Pattern 3: "subdivision (a) of section X of the Y Law"
# =============================================================================

class TestPattern3SubdivisionPattern:
    """Tests for PATTERN_SUBDIV_SECTION_OF_LAW."""

    def test_basic_subdivision(self):
        text = "subdivision (a) of section 413 of the Social Services Law"
        m = _find_match(text, PATTERN_SUBDIV_SECTION_OF_LAW)
        assert m is not None
        assert m.group(1).strip() == "413"
        assert m.group(2).strip() == "Social Services"

    def test_nested_subdivision_paragraph(self):
        text = "paragraph (2) of subdivision (a) of section 413 of the Social Services Law"
        m = _find_match(text, PATTERN_SUBDIV_SECTION_OF_LAW)
        assert m is not None
        assert m.group(1).strip() == "413"

    def test_subparagraph(self):
        text = "subparagraph (i) of paragraph (2) of subdivision (a) of section 413 of the Social Services Law"
        m = _find_match(text, PATTERN_SUBDIV_SECTION_OF_LAW)
        assert m is not None
        assert m.group(1).strip() == "413"

    def test_capital_subdivision(self):
        text = "Subdivision (a) of section 413 of the Social Services Law"
        m = _find_match(text, PATTERN_SUBDIV_SECTION_OF_LAW)
        assert m is not None
        assert m.group(1).strip() == "413"

    def test_capital_paragraph(self):
        text = "Paragraph (2) of subdivision (a) of section 413 of the Social Services Law"
        m = _find_match(text, PATTERN_SUBDIV_SECTION_OF_LAW)
        assert m is not None
        assert m.group(1).strip() == "413"

    def test_capital_section_in_subdivision(self):
        text = "subdivision (a) of Section 413 of the Social Services Law"
        m = _find_match(text, PATTERN_SUBDIV_SECTION_OF_LAW)
        assert m is not None
        assert m.group(1).strip() == "413"


# =============================================================================
# Pattern 4: plural "sections X and Y of the Z Law"
# =============================================================================

class TestPattern4PluralSections:
    """Tests for plural section pattern (new)."""

    def test_two_sections_with_and(self):
        text = "sections 488 and 489 of the Social Services Law"
        result = _extract_first(text)
        assert result is not None
        assert result[0] == "488"
        assert result[1] == "Social Services"

    def test_three_sections_with_comma_and(self):
        text = "sections 488, 489, and 490 of the Social Services Law"
        result = _extract_first(text)
        assert result is not None
        assert result[0] == "488"
        assert result[1] == "Social Services"

    def test_double_section_symbol_plural(self):
        text = "§§ 488 and 489 of the Social Services Law"
        result = _extract_first(text)
        assert result is not None
        assert result[0] == "488"
        assert result[1] == "Social Services"

    def test_sections_with_hyphen_suffix(self):
        text = "sections 296-a and 296-b of the Executive Law"
        result = _extract_first(text)
        assert result is not None
        assert result[0] == "296-a"
        assert result[1] == "Executive"


# =============================================================================
# Regressions
# =============================================================================

class TestRegressions:
    """All currently-matched examples must continue to work."""

    @pytest.mark.parametrize("text,expected_section,expected_law", [
        ("section 488 of the Social Services Law", "488", "Social Services"),
        ("section 296-a of the Executive Law", "296-a", "Executive"),
        ("Education Law section 4401", "4401", "Education"),
        ("Public Health Law § 2801", "2801", "Public Health"),
        ("§ 2801 of the Public Health Law", "2801", "Public Health"),
        ("Mental Hygiene Law section 41.13", "41.13", "Mental Hygiene"),
    ])
    def test_existing_citations(self, text, expected_section, expected_law):
        result = _extract_first(text)
        assert result is not None, f"No match for: {text}"
        assert result[0] == expected_section
        assert result[1] == expected_law

    def test_subdivision_still_works(self):
        text = "subdivision (a) of section 413 of the Social Services Law"
        result = _extract_first(text)
        assert result is not None
        assert result[0] == "413"
        assert result[1] == "Social Services"

    def test_extract_citations_dedup(self):
        """Same citation appearing twice should be deduped by extract_citations."""
        text = (
            "Education Law section 4401 requires X. "
            "Per Education Law section 4401, also Y."
        )
        # extract_citations calls resolve_law_id which needs the mapping
        # but we're testing dedup logic, so just check count
        results = extract_citations(text)
        citations = [r['citation'] for r in results]
        # Should appear at most once
        assert len(citations) == len(set(citations))


# =============================================================================
# False positive guards
# =============================================================================

class TestFalsePositiveGuards:
    """Cases that should NOT match any pattern."""

    def test_lowercase_law_name_no_match(self):
        """'social services Law' (lowercase first word) should not match."""
        text = "social services Law section 488"
        result = _extract_first(text)
        assert result is None

    def test_no_law_suffix(self):
        """'Section 488 of the Social Services' without 'Law' should not match."""
        text = "section 488 of the Social Services"
        result = _extract_first(text)
        assert result is None

    def test_article_not_section(self):
        """'article 8 of the Social Services Law' should not match (article != section)."""
        text = "article 8 of the Social Services Law"
        result = _extract_first(text)
        assert result is None

    def test_plain_number_no_context(self):
        """Bare numbers without law context should not match."""
        text = "see 488 for details"
        result = _extract_first(text)
        assert result is None

    def test_njac_citation_no_match(self):
        """NJ citations should not match NY patterns."""
        text = "N.J.A.C. 7:26J-2.2(c)4"
        result = _extract_first(text)
        assert result is None
