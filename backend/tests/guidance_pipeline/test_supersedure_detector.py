"""Tests for supersedure_detector: null source_ref handling."""

import unittest
from unittest.mock import MagicMock

from scripts.guidance_pipeline.supersedure_detector import (
    SupersedureResult,
    resolve_bidirectional_links,
)


class TestResolveBidirectionalLinks(unittest.TestCase):
    """Test that null source_ref is handled gracefully."""

    def test_null_source_ref_still_marks_target_superseded(self):
        """When source has no canonical_ref, target should still get superseded_by."""
        results = [
            SupersedureResult(
                source_id=100,
                source_ref=None,  # No canonical_ref
                target_ref="SOME-OLD-DOC",
                target_id=200,
                relationship="supersedes",
                method="content_regex",
                confidence="high",
            ),
        ]

        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value = cur

        stats = resolve_bidirectional_links(results, conn, dry_run=True)

        # Target should be marked superseded even though source has no ref
        self.assertEqual(stats["superseded_by_updated"], 1)
        self.assertEqual(stats["status_set_superseded"], 1)

    def test_null_source_ref_uses_fallback_label(self):
        """The superseded_by value should use gd:{id} as fallback."""
        results = [
            SupersedureResult(
                source_id=100,
                source_ref=None,
                target_ref="OLD-DOC-01",
                target_id=200,
                relationship="supersedes",
                method="content_regex",
                confidence="high",
            ),
        ]

        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value = cur

        # Run with dry_run=False to check actual SQL params
        resolve_bidirectional_links(results, conn, dry_run=False)

        # Find the UPDATE call that sets superseded_by
        update_calls = [
            call for call in cur.execute.call_args_list
            if "superseded_by" in str(call) and "status" in str(call)
        ]
        self.assertTrue(len(update_calls) > 0, "Expected UPDATE with superseded_by")

        # The superseded_by value should be the fallback label
        args = update_calls[0][0]
        self.assertEqual(args[1], ("gd:100", 200))

    def test_normal_source_ref_used_directly(self):
        """When source_ref exists, it should be used as-is."""
        results = [
            SupersedureResult(
                source_id=100,
                source_ref="23-OCFS-ADM-15",
                target_ref="22-OCFS-ADM-10",
                target_id=200,
                relationship="supersedes",
                method="revision_chain",
                confidence="high",
            ),
        ]

        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value = cur

        resolve_bidirectional_links(results, conn, dry_run=False)

        update_calls = [
            call for call in cur.execute.call_args_list
            if "superseded_by" in str(call) and "status" in str(call)
        ]
        self.assertTrue(len(update_calls) > 0)
        args = update_calls[0][0]
        self.assertEqual(args[1], ("23-OCFS-ADM-15", 200))

    def test_supersedes_set_populated_even_without_source_ref(self):
        """The source doc's supersedes array should include the target_ref."""
        results = [
            SupersedureResult(
                source_id=100,
                source_ref=None,
                target_ref="OLD-DOC",
                target_id=200,
                relationship="supersedes",
                method="content_regex",
                confidence="high",
            ),
        ]

        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value = cur

        stats = resolve_bidirectional_links(results, conn, dry_run=True)

        self.assertEqual(stats["supersedes_updated"], 1)


if __name__ == "__main__":
    unittest.main()
