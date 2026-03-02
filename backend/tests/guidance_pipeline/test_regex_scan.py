"""Tests for regex_scan: atomicity of delete+insert."""

import unittest
from unittest.mock import MagicMock, call, patch


class TestRegexScanAtomicity(unittest.TestCase):
    """Verify that DELETE and INSERTs commit atomically."""

    @patch("scripts.guidance_pipeline.regex_scan.get_db_connection")
    @patch("scripts.guidance_pipeline.regex_scan._load_patterns")
    def test_no_commit_between_delete_and_inserts(self, mock_patterns, mock_conn):
        """conn.commit() should NOT be called after DELETE, only after all INSERTs."""
        from scripts.guidance_pipeline.regex_scan import regex_scan

        conn = MagicMock()
        cur = MagicMock()
        mock_conn.return_value = conn
        conn.cursor.return_value = cur

        # Mock: 1 existing match, 1 document to scan
        cur.fetchone = MagicMock(side_effect=[
            (1,),     # existing count
            None,     # fetchone in scan loop (end)
        ])
        cur.fetchall = MagicMock(return_value=[
            (1, "ADM", "Test Doc", "https://example.com/doc.pdf",
             "This regulation requires a wet signature on all forms."),
        ])

        # Simple pattern that matches
        import re
        mock_patterns.return_value = {
            "wet_signature": [re.compile(r"wet signature", re.IGNORECASE)],
        }

        regex_scan(execute=True)

        # Collect all commit() calls
        commit_calls = conn.commit.call_args_list

        # There should be exactly ONE commit (at the end), not two
        # The old buggy code would have committed after DELETE (before inserts)
        self.assertEqual(
            len(commit_calls), 1,
            f"Expected exactly 1 commit (at end), got {len(commit_calls)}"
        )

    @patch("scripts.guidance_pipeline.regex_scan.get_db_connection")
    @patch("scripts.guidance_pipeline.regex_scan._load_patterns")
    def test_dry_run_no_commits(self, mock_patterns, mock_conn):
        """Dry run should not commit anything."""
        from scripts.guidance_pipeline.regex_scan import regex_scan

        conn = MagicMock()
        cur = MagicMock()
        mock_conn.return_value = conn
        conn.cursor.return_value = cur

        cur.fetchall = MagicMock(return_value=[
            (1, "ADM", "Test Doc", "https://example.com/doc.pdf", "Some content"),
        ])

        import re
        mock_patterns.return_value = {
            "wet_signature": [re.compile(r"wet signature", re.IGNORECASE)],
        }

        regex_scan(execute=False)

        conn.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
