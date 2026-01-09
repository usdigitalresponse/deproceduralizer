"""
Database writer for the research pipeline.

This module re-exports functions from the new db/ module for backward compatibility.
All implementations have been moved to:
- db/analysis_writer.py (save functions)
- db/analysis_reader.py (get_existing_analyses)
- db/connection.py (DatabaseManager)

NOTE: New code should import directly from scripts.research_pipeline.db instead.
"""

# Re-export shared_utils.get_db_connection for backward compatibility
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from shared_utils import get_db_connection

# Re-export from db.analysis_writer
from .db.analysis_writer import (
    save_tier1_results,
    save_tier2_results,
    save_tier3_results,
    save_final_results,
    save_all_results,
)

# Import PIPELINE_VERSION from centralized config
from .config import PIPELINE_VERSION

# Re-export from db.analysis_reader
from .db.analysis_reader import (
    get_existing_analyses,
)

__all__ = [
    "get_db_connection",
    "save_tier1_results",
    "save_tier2_results",
    "save_tier3_results",
    "save_final_results",
    "save_all_results",
    "get_existing_analyses",
    "PIPELINE_VERSION",
]
