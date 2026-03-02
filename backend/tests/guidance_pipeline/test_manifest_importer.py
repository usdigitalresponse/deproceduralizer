"""Tests for manifest_importer: dual-table URL lookup."""

import unittest
from scripts.guidance_pipeline.manifest_importer import _build_url_index, _find_in_index


class TestBuildUrlIndex(unittest.TestCase):
    """Test URL index building."""

    def test_builds_exact_and_normalized(self):
        from unittest.mock import MagicMock

        cur = MagicMock()
        cur.fetchall.return_value = [
            (1, "Doc A", "https://www.example.com/doc-a.pdf"),
            (2, "Doc B", "http://example.com/doc-b.html"),
        ]

        exact, normalized = _build_url_index(cur, "guidance_documents")

        self.assertIn("https://www.example.com/doc-a.pdf", exact)
        self.assertIn("http://example.com/doc-b.html", exact)

        # Normalized should strip protocol and www
        self.assertIn("example.com/doc-a.pdf", normalized)
        self.assertIn("example.com/doc-b.html", normalized)


class TestFindInIndex(unittest.TestCase):
    """Test URL lookup with exact and normalized matching."""

    def test_exact_match(self):
        exact = {"https://example.com/doc.pdf": (1, "Doc")}
        normalized = {}

        result = _find_in_index("https://example.com/doc.pdf", exact, normalized)
        self.assertEqual(result, (1, "Doc"))

    def test_normalized_match(self):
        exact = {}
        normalized = {"example.com/doc.pdf": (1, "Doc")}

        result = _find_in_index("https://www.example.com/doc.pdf", exact, normalized)
        self.assertEqual(result, (1, "Doc"))

    def test_no_match(self):
        exact = {}
        normalized = {"other.com/doc.pdf": (1, "Doc")}

        result = _find_in_index("https://example.com/missing.pdf", exact, normalized)
        self.assertIsNone(result)


class TestDualTableLookup(unittest.TestCase):
    """Test that preview_manifest checks both tables."""

    def test_regulation_entry_found_in_regulatory_documents(self):
        """Entries that exist in regulatory_documents should not show as MISSING."""
        # Simulate: URL not in guidance_documents, but IS in regulatory_documents
        gd_exact: dict[str, tuple[int, str]] = {}
        gd_norm: dict[str, tuple[int, str]] = {}
        rd_exact = {"https://ocfs.ny.gov/regs/ssl-390.pdf": (999, "SSL Section 390")}
        rd_norm = {"ocfs.ny.gov/regs/ssl-390.pdf": (999, "SSL Section 390")}

        url = "https://ocfs.ny.gov/regs/ssl-390.pdf"

        # Check guidance first
        row = _find_in_index(url, gd_exact, gd_norm)
        self.assertIsNone(row)

        # Check regulatory
        row = _find_in_index(url, rd_exact, rd_norm)
        self.assertIsNotNone(row)
        self.assertEqual(row[0], 999)


if __name__ == "__main__":
    unittest.main()
