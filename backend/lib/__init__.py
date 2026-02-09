"""
Backend library modules — split from shared_utils.py.

Re-exports all public symbols for convenience.
"""

from lib.prompts import (
    load_prompt,
    load_prompt_parts,
    get_prompt_description,
    list_prompts,
)

from lib.db import (
    get_db_connection,
    retry_db_operation,
    get_ancestors_batch,
    normalize_scope_level,
    get_filtered_documents,
    get_already_analyzed_ids,
    get_already_extracted_ids,
)

from lib.stats import (
    format_time,
    refresh_structure_stats,
    refresh_analysis_stats,
    refresh_compliance_stats,
    refresh_all_stats,
)

from lib.llm import (
    DEFAULT_MODEL,
    get_anthropic_client,
    get_async_anthropic_client,
    _pydantic_to_tool_schema,
    call_llm_parse,
    call_llm_parse_async,
    call_llm_beta_async,
)

from lib.batch import (
    format_batch_request,
    BatchManager,
    parse_batch_result_tool_use,
)

from lib.migration import (
    get_state_config,
    migrate_regulations_to_db,
    populate_parent_ids,
    cleanup_stale_documents,
)

__all__ = [
    # prompts
    "load_prompt",
    "load_prompt_parts",
    "get_prompt_description",
    "list_prompts",
    # db
    "get_db_connection",
    "retry_db_operation",
    "get_ancestors_batch",
    "normalize_scope_level",
    "get_filtered_documents",
    "get_already_analyzed_ids",
    "get_already_extracted_ids",
    # stats
    "format_time",
    "refresh_structure_stats",
    "refresh_analysis_stats",
    "refresh_compliance_stats",
    "refresh_all_stats",
    # llm
    "DEFAULT_MODEL",
    "get_anthropic_client",
    "get_async_anthropic_client",
    "_pydantic_to_tool_schema",
    "call_llm_parse",
    "call_llm_parse_async",
    "call_llm_beta_async",
    # batch
    "format_batch_request",
    "BatchManager",
    "parse_batch_result_tool_use",
    # migration
    "get_state_config",
    "migrate_regulations_to_db",
    "populate_parent_ids",
    "cleanup_stale_documents",
]
