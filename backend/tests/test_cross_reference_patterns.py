"""Tests for cross-reference pattern matching improvements.

Covers:
- Deep subsection matching (trailing paragraph numbers and roman numerals)
- _normalize_njac_section helper
- Same-section range patterns ((b) through (f) below)
- NJAC range detection (N.J.A.C. 7:26J-4.1 through 4.5)
"""

import pytest

from scripts.cross_references.patterns import (
    NJAC_PATTERN,
    SAME_SECTION_RANGE_PATTERN,
    _normalize_njac_section,
    extract_all_matches,
    RefType,
)


class TestNJACDeepSubsections:
    """Test that trailing paragraph numbers and roman numerals are captured."""

    def test_trailing_paragraph_number(self):
        """N.J.A.C. 7:26J-2.2(c)4 should capture the trailing 4."""
        text = "See N.J.A.C. 7:26J-2.2(c)4 for details."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].components['section'] == '2.2(c)4'
        assert matches[0].components['section_base'] == '2.2'
        assert matches[0].normalized == 'N.J.A.C. 7:26J-2.2'

    def test_trailing_roman_numeral(self):
        """N.J.A.C. 7:26J-7.3(a)1vi should capture trailing 1vi."""
        text = "Per N.J.A.C. 7:26J-7.3(a)1vi requirements."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].components['section'] == '7.3(a)1vi'
        assert matches[0].components['section_base'] == '7.3'

    def test_full_eight_item_comma_list(self):
        """The full 8-item comma list from issue #68 should produce 8 references."""
        text = (
            "N.J.A.C. 7:26J-2.2(c)4, 2.3(i), 3.1(e)5, 4.1(g), "
            "4.2, 7.3(a)1vi, 8.1(h)6, and 9.8(d)3"
        )
        matches = extract_all_matches(text)
        assert len(matches) == 8

        # Check each normalized citation
        expected_bases = ['2.2', '2.3', '3.1', '4.1', '4.2', '7.3', '8.1', '9.8']
        for match, expected in zip(matches, expected_bases):
            assert match.normalized == f'N.J.A.C. 7:26J-{expected}', (
                f"Expected base {expected}, got {match.normalized}"
            )

    def test_simple_subsection_still_works(self):
        """Regression: simple (a) subsection should still match."""
        text = "N.J.A.C. 8:43-1.2(a) applies."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].components['section'] == '1.2(a)'
        assert matches[0].normalized == 'N.J.A.C. 8:43-1.2'

    def test_plain_section_still_works(self):
        """Regression: plain section without subsection should still match."""
        text = "See N.J.A.C. 7:50-6 et seq."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].normalized == 'N.J.A.C. 7:50-6'

    def test_comma_list_with_chapter_switch(self):
        """Regression: chapter switch detection should still work."""
        text = "N.J.A.C. 7:22-3 and 7:22A-6"
        matches = extract_all_matches(text)
        assert len(matches) == 2
        assert matches[0].normalized == 'N.J.A.C. 7:22-3'
        assert matches[1].normalized == 'N.J.A.C. 7:22A-6'


class TestNormalization:
    """Test _normalize_njac_section helper."""

    @pytest.mark.parametrize("input_section,expected", [
        ('2.2', '2.2'),
        ('2.2(c)4', '2.2'),
        ('7.3(a)1vi', '7.3'),
        ('1.2a', '1.2'),
        ('1.2(a)', '1.2'),
        ('6', '6'),
        ('3.1(e)5', '3.1'),
        ('4.2', '4.2'),
        ('8.1(h)6', '8.1'),
        ('9.8(d)3', '9.8'),
    ])
    def test_normalize(self, input_section, expected):
        assert _normalize_njac_section(input_section) == expected


class TestSameSectionRange:
    """Test same-section range pattern like (b) through (f) below."""

    def test_through_below(self):
        """'(b) through (f) below' should be a single range match."""
        text = "See (b) through (f) below for details."
        matches = extract_all_matches(text)
        range_matches = [m for m in matches if m.components.get('is_range')]
        assert len(range_matches) == 1
        assert range_matches[0].components['range_start'] == '(b)'
        assert range_matches[0].components['range_end'] == '(f)'
        assert range_matches[0].normalized == '(b)-(f)'

    def test_to_above(self):
        """'(a) to (d) above' should be a single range match."""
        text = "Per (a) to (d) above requirements."
        matches = extract_all_matches(text)
        range_matches = [m for m in matches if m.components.get('is_range')]
        assert len(range_matches) == 1
        assert range_matches[0].components['range_start'] == '(a)'
        assert range_matches[0].components['range_end'] == '(d)'

    def test_through_herein(self):
        """'(c) through (g) herein' should match."""
        text = "As in (c) through (g) herein."
        matches = extract_all_matches(text)
        range_matches = [m for m in matches if m.components.get('is_range')]
        assert len(range_matches) == 1

    def test_through_no_direction(self):
        """'(a) through (c)' without direction word should match."""
        text = "Items (a) through (c) are required."
        matches = extract_all_matches(text)
        range_matches = [m for m in matches if m.components.get('is_range')]
        assert len(range_matches) == 1
        assert range_matches[0].components['range_start'] == '(a)'
        assert range_matches[0].components['range_end'] == '(c)'

    def test_overlap_prevention(self):
        """Range match should prevent SAME_SECTION_PATTERN from matching (f) below separately."""
        text = "(b) through (f) below"
        matches = extract_all_matches(text)
        # Should be exactly 1 match (the range), not 2 (range + "(f) below")
        assert len(matches) == 1
        assert matches[0].components.get('is_range') is True

    def test_non_range_still_matches(self):
        """Regression: plain '(a) above' without range should still match."""
        text = "See (a) above for details."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].ref_type == RefType.SAME_SECTION
        assert matches[0].components.get('is_range') is not True


class TestNJACRange:
    """Test NJAC range detection (e.g., N.J.A.C. 7:26J-4.1 through 4.5)."""

    def test_section_range(self):
        """'N.J.A.C. 7:26J-4.1 through 4.5' should be a single range reference."""
        text = "See N.J.A.C. 7:26J-4.1 through 4.5 for details."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].components.get('is_range') is True
        assert matches[0].components['range_end_section'] == '4.5'
        assert matches[0].components['range_end_base'] == '4.5'
        assert matches[0].normalized == 'N.J.A.C. 7:26J-4.1'
        assert 'through 4.5' in matches[0].raw_text

    def test_section_range_with_to(self):
        """'N.J.A.C. 8:43-1.1 to 1.5' should be a range."""
        text = "Per N.J.A.C. 8:43-1.1 to 1.5 requirements."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].components.get('is_range') is True
        assert matches[0].components['range_end_section'] == '1.5'

    def test_range_does_not_consume_comma_list(self):
        """A range should not prevent subsequent comma-list parsing."""
        text = "N.J.A.C. 7:26J-4.1, 5.1 and 6.1"
        matches = extract_all_matches(text)
        # Should get 3 separate references, not a range
        assert len(matches) == 3

    def test_range_in_abbreviated_list(self):
        """Range suffix on an abbreviated item: 'N.J.A.C. 7:26J-2.1, 4.1 through 4.5'."""
        text = "See N.J.A.C. 7:26J-2.1, 4.1 through 4.5 for details."
        matches = extract_all_matches(text)
        assert len(matches) == 2
        # First: 2.1 (no range)
        assert matches[0].normalized == 'N.J.A.C. 7:26J-2.1'
        assert matches[0].components.get('is_range') is not True
        # Second: 4.1 through 4.5 (range)
        assert matches[1].normalized == 'N.J.A.C. 7:26J-4.1'
        assert matches[1].components.get('is_range') is True
        assert matches[1].components['range_end_section'] == '4.5'
