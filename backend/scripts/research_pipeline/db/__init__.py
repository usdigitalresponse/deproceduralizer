"""
Database layer for the research pipeline.

This module provides centralized database access for:
- Connection management (DatabaseManager)
- Document queries (ProcessingUnitBuilder)
- Analysis reading (get_existing_analyses, etc.)
- Analysis writing (save_tier*_results, etc.)

Usage:
    from scripts.research_pipeline.db import (
        DatabaseManager,
        ProcessingUnitBuilder,
        get_existing_analyses,
        save_tier1_results,
        save_tier2_results,
        save_tier3_results,
        save_final_results,
    )
"""

# Connection management
from .connection import DatabaseManager

# Document queries
from .document_queries import (
    ProcessingUnitBuilder,
    build_match_info,
    get_issue_types_for_scope,
    fetch_documents_with_continuation,
    fetch_tier3_pending_documents,
    fetch_all_issue_documents,
    fetch_guidance_unanalyzed,
    get_guidance_issue_types,
)

# Analysis reading
from .analysis_reader import (
    get_existing_analyses,
    get_analysis_by_document,
    get_tier_completion_counts,
    get_classification_counts,
)

# Analysis writing
from .analysis_writer import (
    save_tier1_results,
    save_tier2_results,
    save_tier3_results,
    save_final_results,
    save_all_results,
    save_review_summaries,
    PIPELINE_VERSION,
)

__all__ = [
    # Connection
    "DatabaseManager",
    # Document queries
    "ProcessingUnitBuilder",
    "build_match_info",
    "get_issue_types_for_scope",
    "fetch_documents_with_continuation",
    "fetch_tier3_pending_documents",
    "fetch_all_issue_documents",
    "fetch_guidance_unanalyzed",
    "get_guidance_issue_types",
    # Analysis reading
    "get_existing_analyses",
    "get_analysis_by_document",
    "get_tier_completion_counts",
    "get_classification_counts",
    # Analysis writing
    "save_tier1_results",
    "save_tier2_results",
    "save_tier3_results",
    "save_final_results",
    "save_all_results",
    "save_review_summaries",
    "PIPELINE_VERSION",
]
