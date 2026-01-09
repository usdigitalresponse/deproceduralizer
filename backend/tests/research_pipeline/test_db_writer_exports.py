"""Tests for research_pipeline/db_writer.py - Verify re-exports.

db_writer.py is a backward-compatibility module that re-exports functions
from the db/ subpackage. These tests verify all expected exports are available.
"""

import pytest


class TestDbWriterExports:
    """Verify db_writer.py re-exports are available."""

    def test_save_functions_exported(self):
        """Save functions should be available from db_writer."""
        from scripts.research_pipeline.db_writer import (
            save_tier1_results,
            save_tier2_results,
            save_tier3_results,
            save_final_results,
            save_all_results,
        )

        assert callable(save_tier1_results)
        assert callable(save_tier2_results)
        assert callable(save_tier3_results)
        assert callable(save_final_results)
        assert callable(save_all_results)

    def test_get_existing_analyses_exported(self):
        """get_existing_analyses should be available from db_writer."""
        from scripts.research_pipeline.db_writer import get_existing_analyses

        assert callable(get_existing_analyses)

    def test_get_db_connection_exported(self):
        """get_db_connection should be available from db_writer."""
        from scripts.research_pipeline.db_writer import get_db_connection

        assert callable(get_db_connection)

    def test_pipeline_version_exported(self):
        """PIPELINE_VERSION should be available from db_writer."""
        from scripts.research_pipeline.db_writer import PIPELINE_VERSION

        assert isinstance(PIPELINE_VERSION, str)
        # V5+ format expected
        assert PIPELINE_VERSION.startswith("v") or PIPELINE_VERSION[0].isdigit()

    def test_all_exports_in_dunder_all(self):
        """__all__ should list all exports."""
        from scripts.research_pipeline import db_writer

        expected_exports = {
            "get_db_connection",
            "save_tier1_results",
            "save_tier2_results",
            "save_tier3_results",
            "save_final_results",
            "save_all_results",
            "get_existing_analyses",
            "PIPELINE_VERSION",
        }

        assert set(db_writer.__all__) == expected_exports
