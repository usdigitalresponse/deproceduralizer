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
    GUIDANCE_REF_PATTERN,
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
        # Fallback cases: input returned unchanged when no leading digits
        ('(a)2', '(a)2'),
        ('', ''),
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

    def test_through_no_direction_not_matched(self):
        """'(a) through (c)' without direction word should NOT match as range (ambiguous prose)."""
        text = "Items (a) through (c) are required."
        matches = extract_all_matches(text)
        range_matches = [m for m in matches if m.components.get('is_range')]
        assert len(range_matches) == 0

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

    def test_range_followed_by_more_items(self):
        """Items after a range in an abbreviated list should still be captured."""
        text = "N.J.A.C. 7:26J-2.1, 4.1 through 4.5, 6.1 and 8.2"
        matches = extract_all_matches(text)
        assert len(matches) == 4
        assert matches[0].normalized == 'N.J.A.C. 7:26J-2.1'
        assert matches[1].components.get('is_range') is True
        assert matches[1].normalized == 'N.J.A.C. 7:26J-4.1'
        assert matches[2].normalized == 'N.J.A.C. 7:26J-6.1'
        assert matches[3].normalized == 'N.J.A.C. 7:26J-8.2'

    def test_initial_range_followed_by_comma_list(self):
        """Comma-list items after an initial-match range should still be captured."""
        text = "N.J.A.C. 7:26J-4.1 through 4.5, 6.1 and 8.2"
        matches = extract_all_matches(text)
        assert len(matches) == 3
        assert matches[0].components.get('is_range') is True
        assert matches[0].normalized == 'N.J.A.C. 7:26J-4.1'
        assert matches[1].normalized == 'N.J.A.C. 7:26J-6.1'
        assert matches[2].normalized == 'N.J.A.C. 7:26J-8.2'

    def test_section_range_raw_text(self):
        """Range raw_text should contain the full citation including 'through X'."""
        text = "See N.J.A.C. 7:26J-4.1 through 4.5 for details."
        matches = extract_all_matches(text)
        assert len(matches) == 1
        assert matches[0].raw_text == 'N.J.A.C. 7:26J-4.1 through 4.5'


class TestNYCRRPatternImprovements:
    """Test Tier 2 NYCRR pattern improvements for guidance doc OCR content."""

    def test_comma_after_nycrr(self):
        """'18 NYCRR, Part 360-8.1' should match."""
        matches = extract_all_matches("18 NYCRR, Part 360-8.1")
        assert len(matches) == 1
        assert matches[0].ref_type == RefType.NYCRR
        assert matches[0].normalized == "18 NYCRR 360-8.1"

    def test_comma_section(self):
        """'18 NYCRR, Section 487.2(c)' should match."""
        matches = extract_all_matches("18 NYCRR, Section 487.2(c)")
        assert len(matches) == 1
        assert matches[0].normalized == "18 NYCRR 487.2"

    def test_double_section_sign(self):
        """'18 NYCRR §§487.10(e)' should match."""
        matches = extract_all_matches("18 NYCRR §§487.10(e)")
        assert len(matches) == 1
        assert matches[0].normalized == "18 NYCRR 487.10"

    def test_double_section_with_list(self):
        """'18 NYCRR §§487.10(e), 488.10(e) and 490.10(e)' should expand."""
        matches = extract_all_matches("18 NYCRR §§487.10(e), 488.10(e) and 490.10(e)")
        assert len(matches) == 3
        norms = [m.normalized for m in matches]
        assert "18 NYCRR 487.10" in norms
        assert "18 NYCRR 488.10" in norms
        assert "18 NYCRR 490.10" in norms

    def test_parts_plural(self):
        """'10 NYCRR Parts 717, 793 and 794' should expand."""
        matches = extract_all_matches("10 NYCRR Parts 717, 793 and 794")
        assert len(matches) == 3
        norms = [m.normalized for m in matches]
        assert "10 NYCRR 717" in norms
        assert "10 NYCRR 793" in norms
        assert "10 NYCRR 794" in norms

    def test_no_space_ocr(self):
        """'18NYCRR 431.7' should match (OCR artifact)."""
        matches = extract_all_matches("18NYCRR 431.7")
        assert len(matches) == 1
        assert matches[0].normalized == "18 NYCRR 431.7"

    def test_semicolon_list(self):
        """'18 NYCRR 430.12; 431.8' should expand."""
        matches = extract_all_matches("18 NYCRR 430.12; 431.8")
        assert len(matches) == 2
        norms = [m.normalized for m in matches]
        assert "18 NYCRR 430.12" in norms
        assert "18 NYCRR 431.8" in norms

    def test_nycrr_list_does_not_eat_guidance_ref(self):
        """NYCRR list expansion should stop before guidance refs."""
        matches = extract_all_matches("18 NYCRR 505.14 and 23-OCFS-ADM-15 for details.")
        types = [m.ref_type for m in matches]
        assert RefType.NYCRR in types
        assert RefType.GUIDANCE in types
        nycrr = [m for m in matches if m.ref_type == RefType.NYCRR]
        assert len(nycrr) == 1
        assert nycrr[0].normalized == "18 NYCRR 505.14"


class TestGuidanceRefPatterns:
    """Test guidance-to-guidance reference patterns."""

    def test_agency_prefixed(self):
        """'23-OCFS-ADM-15' should match."""
        matches = extract_all_matches("23-OCFS-ADM-15")
        assert len(matches) == 1
        assert matches[0].ref_type == RefType.GUIDANCE
        assert matches[0].normalized == "23-OCFS-ADM-15"

    def test_agency_prefixed_lcm(self):
        """'07-OCFS-LCM-12' should match."""
        matches = extract_all_matches("07-OCFS-LCM-12")
        assert len(matches) == 1
        assert matches[0].components['agency'] == 'OCFS'
        assert matches[0].components['doc_type'] == 'LCM'

    def test_agency_prefixed_with_revision(self):
        """'19-OCFS-ADM-21-R1' should match."""
        matches = extract_all_matches("19-OCFS-ADM-21-R1")
        assert len(matches) == 1
        assert matches[0].normalized == "19-OCFS-ADM-21-R1"

    def test_short_format(self):
        """'90 ADM-31' should match."""
        matches = extract_all_matches("90 ADM-31")
        assert len(matches) == 1
        assert matches[0].ref_type == RefType.GUIDANCE
        assert matches[0].components['format'] == 'short'

    def test_gis_format(self):
        """'GIS-20-MA/10' should match."""
        matches = extract_all_matches("GIS-20-MA/10")
        assert len(matches) == 1
        assert matches[0].ref_type == RefType.GUIDANCE

    def test_mixed_nycrr_and_guidance(self):
        """Both NYCRR and guidance refs should be found in mixed content."""
        text = "See 18 NYCRR 430.12 and 16-OCFS-ADM-09 for details."
        matches = extract_all_matches(text)
        nycrr = [m for m in matches if m.ref_type == RefType.NYCRR]
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(nycrr) == 1
        assert len(guidance) == 1


class TestGuidancePatternEdgeCases:
    """Test guidance reference pattern edge cases in realistic regulatory text."""

    def test_multiple_guidance_refs_in_paragraph(self):
        """Multiple guidance refs embedded in regulatory prose should all be found."""
        text = (
            "As outlined in 23-OCFS-ADM-15, providers must comply with the "
            "requirements established in 07-OCFS-LCM-12 and further clarified "
            "by 19-OCFS-INF-06. See also GIS-20-MA/10 for implementation details."
        )
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 4
        norms = [m.normalized for m in guidance]
        assert "23-OCFS-ADM-15" in norms
        assert "07-OCFS-LCM-12" in norms
        assert "19-OCFS-INF-06" in norms
        assert "GIS-20-MA/10" in norms

    def test_guidance_ref_with_revision_suffix(self):
        """Guidance ref with revision marker '-R1' should be captured fully."""
        text = "Refer to 19-OCFS-ADM-21-R1 for updated procedures."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 1
        assert guidance[0].normalized == "19-OCFS-ADM-21-R1"

    def test_lowercase_agency_does_not_match(self):
        """Lowercase agency names should not match (pattern is case-sensitive)."""
        text = "See 23-ocfs-adm-15 for details."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 0

    def test_partial_ref_missing_number_does_not_match(self):
        """A truncated reference missing its number should not produce a guidance match."""
        text = "The directive 23-OCFS-ADM- was never finalized."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        # Should not match the incomplete ref (no number after final dash)
        assert len(guidance) == 0

    def test_year_like_number_in_prose_not_matched(self):
        """Bare numbers that look like years should not be matched as guidance refs."""
        text = "In 2023, the agency issued 15 new directives."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 0

    def test_guidance_and_nycrr_adjacent(self):
        """Guidance ref immediately after NYCRR citation should both be captured."""
        text = "18 NYCRR 505.14 and 23-OCFS-ADM-15 apply."
        matches = extract_all_matches(text)
        nycrr = [m for m in matches if m.ref_type == RefType.NYCRR]
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(nycrr) == 1
        assert len(guidance) == 1
        assert nycrr[0].normalized == "18 NYCRR 505.14"
        assert guidance[0].normalized == "23-OCFS-ADM-15"

    def test_short_format_in_regulatory_text(self):
        """Short-format guidance refs should match in regulatory prose."""
        text = "Consistent with 90 ADM-31 and 04 INF-22 requirements."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 2
        formats = [m.components.get("format") for m in guidance]
        assert all(f == "short" for f in formats)


class TestTSBMGuidancePatterns:
    """Test TSB-M (Tax Service Bureau Memoranda) guidance reference patterns."""

    def test_compact_format(self):
        """Compact TSB-M format: TSB-M-08(3)S"""
        text = "See TSB-M-08(3)S for details."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 1
        assert guidance[0].normalized == "TSB-M-08(3)S"
        assert guidance[0].components['format'] == 'tsb_m'
        assert guidance[0].components['year'] == '08'
        assert guidance[0].components['number'] == '3'
        assert guidance[0].components['tax_type'] == 'S'

    def test_spaced_format_with_hyphen(self):
        """Spaced TSB-M format: TSB-M-83 (12)-I"""
        text = "Referenced in TSB-M-83 (12)-I above."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 1
        assert guidance[0].normalized == "TSB-M-83(12)I"

    def test_wide_spaced_format(self):
        """Wide-spaced TSB-M format: TSB-M-90 (10) S"""
        text = "TSB-M-90 (10) S Sales Tax October 10, 1990"
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 1
        assert guidance[0].normalized == "TSB-M-90(10)S"

    def test_decimal_number(self):
        """TSB-M with decimal sub-number: TSB-M-05(2.1)C"""
        text = "As described in TSB-M-05(2.1)C and TSB-M-05(2.2)C."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 2
        assert guidance[0].normalized == "TSB-M-05(2.1)C"
        assert guidance[1].normalized == "TSB-M-05(2.2)C"

    def test_all_suffix_types(self):
        """All common tax type suffixes should be recognized."""
        for suffix, label in [('C', 'Corporation'), ('S', 'Sales'), ('I', 'Income'), ('M', 'Misc'), ('R', 'Real estate')]:
            text = f"TSB-M-09(5){suffix} {label} Tax"
            matches = extract_all_matches(text)
            guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
            assert len(guidance) == 1, f"Failed for suffix {suffix}"
            assert guidance[0].normalized == f"TSB-M-09(5){suffix}"

    def test_lowercase_suffix_normalized_to_upper(self):
        """Lowercase suffix should be normalized to uppercase."""
        text = "TSB-M-91(5)c Corporation Tax"
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 1
        assert guidance[0].normalized == "TSB-M-91(5)C"

    def test_no_false_positive_bare_tsb_m(self):
        """Bare 'TSB-M' without full citation should not match."""
        text = "This TSB-M is obsolete and cannot be relied upon."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 0

    def test_no_false_positive_truncated(self):
        """TSB-M- without number should not match."""
        text = "The TSB-M- series covers various tax topics."
        matches = extract_all_matches(text)
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(guidance) == 0

    def test_mixed_with_nycrr(self):
        """TSB-M and NYCRR refs in same text should both be captured."""
        text = "Per 20 NYCRR 526.7 and TSB-M-14(5)C, the exemption applies."
        matches = extract_all_matches(text)
        nycrr = [m for m in matches if m.ref_type == RefType.NYCRR]
        guidance = [m for m in matches if m.ref_type == RefType.GUIDANCE]
        assert len(nycrr) == 1
        assert len(guidance) == 1
        assert guidance[0].normalized == "TSB-M-14(5)C"
