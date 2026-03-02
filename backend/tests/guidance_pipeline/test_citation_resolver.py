"""Tests for citation_resolver: parsing and part-only resolution."""

import unittest

from scripts.guidance_pipeline.citation_resolver import (
    parse_nycrr_citation,
)


class TestParseNycrrCitation(unittest.TestCase):
    """Test NYCRR citation parsing."""

    def test_section_level(self):
        title, part, section = parse_nycrr_citation("18 NYCRR 415.2")
        self.assertEqual(title, "18")
        self.assertEqual(part, "415")
        self.assertEqual(section, "415.2")

    def test_section_with_symbol(self):
        title, part, section = parse_nycrr_citation("18 NYCRR § 385.3")
        self.assertEqual(title, "18")
        self.assertEqual(part, "385")
        self.assertEqual(section, "385.3")

    def test_part_only_explicit(self):
        title, part, section = parse_nycrr_citation("18 NYCRR Part 413")
        self.assertEqual(title, "18")
        self.assertEqual(part, "413")
        self.assertIsNone(section)

    def test_part_only_no_dot(self):
        """A citation like '18 NYCRR 360' is part-level (no dot = no section)."""
        title, part, section = parse_nycrr_citation("18 NYCRR 360")
        self.assertEqual(title, "18")
        self.assertEqual(part, "360")
        self.assertIsNone(section)

    def test_part_only_with_symbol(self):
        title, part, section = parse_nycrr_citation("18 NYCRR §360")
        self.assertEqual(title, "18")
        self.assertEqual(part, "360")
        self.assertIsNone(section)

    def test_hyphenated_section(self):
        title, part, section = parse_nycrr_citation("9 NYCRR 180-7.5(c)")
        self.assertEqual(title, "9")
        self.assertEqual(part, "180-7")
        self.assertEqual(section, "180-7.5")

    def test_hyphenated_subpart_section(self):
        title, part, section = parse_nycrr_citation("18 NYCRR 360-4.8")
        self.assertEqual(title, "18")
        self.assertEqual(part, "360-4")
        self.assertEqual(section, "360-4.8")

    def test_invalid_citation(self):
        title, part, section = parse_nycrr_citation("not a citation")
        self.assertIsNone(title)
        self.assertIsNone(part)
        self.assertIsNone(section)


class TestBuildRegulationLookups(unittest.TestCase):
    """Test that part-only rows are included in lookups."""

    def test_part_only_rows_included(self):
        """Part-only regulation docs (no sections) should appear in part_lookup."""
        from unittest.mock import MagicMock

        from scripts.guidance_pipeline.citation_resolver import _build_regulation_lookups

        cur = MagicMock()
        # First call: section-level rows
        # Second call: part-only rows
        cur.execute = MagicMock()
        cur.fetchall = MagicMock(side_effect=[
            # Section-level query results
            [(1, "18", "415", "415.2"), (2, "18", "360", "360-3.2")],
            # Part-only query results (no sections)
            [(3, "18", "413")],
        ])

        section_lookup, part_lookup = _build_regulation_lookups(cur)

        # Section lookup should have section-level entries
        self.assertIn(("18", "415.2"), section_lookup)
        self.assertIn(("18", "360-3.2"), section_lookup)

        # Part lookup should have entries from BOTH queries
        self.assertIn(("18", "415"), part_lookup)
        self.assertIn(("18", "360"), part_lookup)
        self.assertIn(("18", "413"), part_lookup)  # part-only row

        # The part-only row should resolve
        self.assertEqual(part_lookup[("18", "413")], [3])


class TestResolveSingleCitation(unittest.TestCase):
    """Test resolution fallback from section to part."""

    def test_part_only_citation_resolves(self):
        from scripts.guidance_pipeline.citation_resolver import _resolve_single_citation

        section_lookup = {("18", "415.2"): 1}
        part_lookup = {("18", "413"): [99]}

        # Part-only citation should resolve via part_lookup
        result = _resolve_single_citation("18", "413", None, section_lookup, part_lookup)
        self.assertEqual(result, 99)

    def test_section_citation_resolves(self):
        from scripts.guidance_pipeline.citation_resolver import _resolve_single_citation

        section_lookup = {("18", "415.2"): 1}
        part_lookup = {("18", "415"): [1, 2]}

        result = _resolve_single_citation("18", "415", "415.2", section_lookup, part_lookup)
        self.assertEqual(result, 1)

    def test_unresolvable_returns_none(self):
        from scripts.guidance_pipeline.citation_resolver import _resolve_single_citation

        result = _resolve_single_citation("99", "999", "999.1", {}, {})
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
