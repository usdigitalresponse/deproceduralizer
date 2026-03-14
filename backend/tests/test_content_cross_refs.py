"""Tests for content cross-reference resolution functions.

Covers:
- _resolve_nycrr_citation: exact section match, part fallback, hyphenated parts
- _resolve_guidance_ref: direct match, short-format agency expansion, zero-padding
"""

import pytest

from scripts.guidance_pipeline.content_cross_refs import (
    _resolve_nycrr_citation,
    _resolve_guidance_ref,
    _zero_pad_ref_number,
)


class TestResolveNYCRRCitation:
    """Test _resolve_nycrr_citation(title, section, section_lookup, part_lookup)."""

    def test_exact_section_match(self):
        """When the exact (title, section) key exists, return its ID."""
        section_lookup = {("18", "505.14"): 123}
        part_lookup = {}
        result = _resolve_nycrr_citation("18", "505.14", section_lookup, part_lookup)
        assert result == 123

    def test_fallback_to_part_level(self):
        """When section misses but part matches, return the first part-level ID."""
        section_lookup = {}
        part_lookup = {("18", "505"): [456]}
        result = _resolve_nycrr_citation("18", "505.14", section_lookup, part_lookup)
        assert result == 456

    def test_hyphenated_section_extracts_part(self):
        """Section '360-8.1' should extract part '360-8' for fallback."""
        section_lookup = {}
        part_lookup = {("18", "360-8"): [789]}
        result = _resolve_nycrr_citation("18", "360-8.1", section_lookup, part_lookup)
        assert result == 789

    def test_no_match_returns_none(self):
        """When neither lookup has the key, return None."""
        section_lookup = {}
        part_lookup = {}
        result = _resolve_nycrr_citation("18", "999.99", section_lookup, part_lookup)
        assert result is None

    def test_multiple_part_matches_returns_first(self):
        """When multiple IDs exist for a part, return the first one."""
        section_lookup = {}
        part_lookup = {("18", "430"): [100, 200, 300]}
        result = _resolve_nycrr_citation("18", "430.12", section_lookup, part_lookup)
        assert result == 100

    def test_exact_match_takes_precedence_over_part(self):
        """Exact section match should be returned even when part also matches."""
        section_lookup = {("18", "505.14"): 123}
        part_lookup = {("18", "505"): [456]}
        result = _resolve_nycrr_citation("18", "505.14", section_lookup, part_lookup)
        assert result == 123


class TestResolveGuidanceRef:
    """Test _resolve_guidance_ref(normalized, components, guidance_lookup)."""

    def test_direct_match(self):
        """Direct canonical_ref lookup should return the matching ID."""
        guidance_lookup = {"23-OCFS-ADM-15": 100}
        components = {"format": "agency_prefixed"}
        result = _resolve_guidance_ref("23-OCFS-ADM-15", components, guidance_lookup)
        assert result == 100

    def test_short_format_resolves_via_otda(self):
        """Short-format ref should try OTDA first and return match."""
        guidance_lookup = {"90-OTDA-ADM-31": 200}
        components = {"format": "short", "year": "90", "doc_type": "ADM", "number": "31"}
        result = _resolve_guidance_ref("90 ADM-31", components, guidance_lookup)
        assert result == 200

    def test_short_format_resolves_via_ocfs(self):
        """Short-format ref should try OCFS when OTDA has no match."""
        guidance_lookup = {"90-OCFS-ADM-31": 300}
        components = {"format": "short", "year": "90", "doc_type": "ADM", "number": "31"}
        result = _resolve_guidance_ref("90 ADM-31", components, guidance_lookup)
        assert result == 300

    def test_zero_padded_number_strips(self):
        """Short-format with zero-padded number should try stripped variant."""
        guidance_lookup = {"90-OTDA-ADM-7": 400}
        components = {"format": "short", "year": "90", "doc_type": "ADM", "number": "07"}
        result = _resolve_guidance_ref("90 ADM-07", components, guidance_lookup)
        assert result == 400

    def test_unresolvable_returns_none(self):
        """When no matching entry exists, return None."""
        guidance_lookup = {}
        components = {"format": "short", "year": "99", "doc_type": "ADM", "number": "55"}
        result = _resolve_guidance_ref("99 ADM-55", components, guidance_lookup)
        assert result is None

    def test_gis_format_direct_only(self):
        """GIS-format refs use direct lookup only (no agency expansion)."""
        guidance_lookup = {"GIS-20-MA/10": 500}
        components = {"format": "gis"}
        result = _resolve_guidance_ref("GIS-20-MA/10", components, guidance_lookup)
        assert result == 500

    def test_gis_format_no_expansion(self):
        """GIS-format should not attempt agency expansion and return None if no direct match."""
        guidance_lookup = {"20-OTDA-GIS-10": 600}
        components = {"format": "gis"}
        result = _resolve_guidance_ref("GIS-20-MA/10", components, guidance_lookup)
        assert result is None

    def test_short_format_lcm_type(self):
        """Short-format LCM ref should try OTDA and OCFS agencies."""
        guidance_lookup = {"05-OCFS-LCM-12": 700}
        components = {"format": "short", "year": "05", "doc_type": "LCM", "number": "12"}
        result = _resolve_guidance_ref("05 LCM-12", components, guidance_lookup)
        assert result == 700

    def test_short_format_zero_padding(self):
        """Short-format ref '99 ADM-5' should resolve to '99-OTDA-ADM-05' via zero-padding."""
        guidance_lookup = {"99-OTDA-ADM-05": 800}
        components = {"format": "short", "year": "99", "doc_type": "ADM", "number": "5"}
        result = _resolve_guidance_ref("99 ADM-5", components, guidance_lookup)
        assert result == 800

    def test_agency_prefixed_zero_padding(self):
        """Agency-prefixed ref '99-OTDA-ADM-5' should resolve to '99-OTDA-ADM-05'."""
        guidance_lookup = {"99-OTDA-ADM-05": 900}
        components = {"format": "agency_prefixed"}
        result = _resolve_guidance_ref("99-OTDA-ADM-5", components, guidance_lookup)
        assert result == 900

    def test_tsb_m_zero_padding(self):
        """TSB-M ref 'TSB-M-08(3)S' should resolve to 'TSB-M-08(03)S' via zero-padding."""
        guidance_lookup = {"TSB-M-08(03)S": 1000}
        components = {"format": "tsb_m", "year": "08", "number": "3", "tax_type": "S"}
        result = _resolve_guidance_ref("TSB-M-08(3)S", components, guidance_lookup)
        assert result == 1000

    def test_reverse_revision_resolves_to_latest(self):
        """Base ref '22-OCFS-ADM-02' should resolve to latest revision '-R1'."""
        guidance_lookup = {"22-OCFS-ADM-02-R1": 1100}
        latest_rev = {"22-OCFS-ADM-02": 1100}
        components = {"format": "agency_prefixed"}
        result = _resolve_guidance_ref("22-OCFS-ADM-02", components, guidance_lookup, latest_rev)
        assert result == 1100

    def test_reverse_revision_picks_latest_not_first(self):
        """When multiple revisions exist, should resolve to the latest."""
        guidance_lookup = {
            "23-OCFS-LCM-12-R1": 1200,
            "23-OCFS-LCM-12-R4": 1500,
        }
        # latest_revision_lookup should map to -R4 (highest)
        latest_rev = {"23-OCFS-LCM-12": 1500}
        components = {"format": "agency_prefixed"}
        result = _resolve_guidance_ref("23-OCFS-LCM-12", components, guidance_lookup, latest_rev)
        assert result == 1500

    def test_intermediate_revision_resolves_to_latest(self):
        """Intermediate revision '-R1' should resolve to latest '-R4'."""
        guidance_lookup = {"23-OCFS-LCM-12-R4": 1500}
        latest_rev = {"23-OCFS-LCM-12": 1500}
        components = {"format": "agency_prefixed"}
        result = _resolve_guidance_ref("23-OCFS-LCM-12-R1", components, guidance_lookup, latest_rev)
        assert result == 1500

    def test_short_format_with_revision_fallback(self):
        """Short-format ref should fall back to latest revision via agency expansion."""
        guidance_lookup = {"99-OTDA-ADM-05-R2": 1600}
        latest_rev = {"99-OTDA-ADM-05": 1600}
        components = {"format": "short", "year": "99", "doc_type": "ADM", "number": "5"}
        result = _resolve_guidance_ref("99 ADM-5", components, guidance_lookup, latest_rev)
        assert result == 1600

    def test_no_revision_lookup_still_works(self):
        """When latest_revision_lookup is None, all existing behavior preserved."""
        guidance_lookup = {"23-OCFS-ADM-15": 100}
        components = {"format": "agency_prefixed"}
        result = _resolve_guidance_ref("23-OCFS-ADM-15", components, guidance_lookup, None)
        assert result == 100


class TestZeroPadRefNumber:
    """Test _zero_pad_ref_number helper."""

    def test_pads_single_digit_agency_prefixed(self):
        assert _zero_pad_ref_number("99-OTDA-ADM-5") == "99-OTDA-ADM-05"

    def test_pads_single_digit_short_format(self):
        assert _zero_pad_ref_number("99 ADM-5") == "99 ADM-05"

    def test_no_change_for_two_digit_number(self):
        assert _zero_pad_ref_number("99-OTDA-ADM-05") == "99-OTDA-ADM-05"

    def test_no_change_for_multi_digit_number(self):
        assert _zero_pad_ref_number("99-OTDA-ADM-123") == "99-OTDA-ADM-123"

    def test_no_change_for_gis_format(self):
        assert _zero_pad_ref_number("GIS-20-MA/10") == "GIS-20-MA/10"
