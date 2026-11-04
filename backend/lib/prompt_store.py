"""
Prompt template storage for observability.

Stores deduplicated prompt templates in the prompt_templates table
and returns IDs for linking to compliance_issue_analyses rows.

Deduplication is by SHA-256 hash of canonical request params
(model, system, messages, tools, tool_choice, max_tokens).

Usage:
    from lib.prompt_store import store_prompt_batch

    # After preparing batch requests:
    prompt_ids = store_prompt_batch(requests, pipeline="research", tier=1)
    # prompt_ids: {"notarization_12345": 42, "g_fax_required_67890": 43, ...}

Each request dict must have a 'custom_id' key. Request params can be
nested under a 'params' key or flat at the top level.
"""

import hashlib
import json
import logging
from typing import Optional

import psycopg

from lib.db import get_db_connection

logger = logging.getLogger(__name__)

VALID_PIPELINES = ("research", "barrier", "summarization")


def _validate_pipeline(pipeline: str) -> None:
    """Raise ValueError if pipeline is not a known name."""
    if pipeline not in VALID_PIPELINES:
        raise ValueError(
            f"Invalid pipeline '{pipeline}', must be one of {VALID_PIPELINES}"
        )


def _canonical_params(request_params: dict) -> dict:
    """Extract canonical fields from request params for hashing.

    Includes model, system, messages, tools, tool_choice, max_tokens.
    Excludes cache_control metadata since it doesn't affect prompt content.
    """
    canonical = {}
    for key in ("model", "system", "messages", "tools", "tool_choice", "max_tokens"):
        if key in request_params:
            canonical[key] = request_params[key]
    return canonical


def _compute_hash(canonical_params: dict) -> str:
    """Compute SHA-256 hash of canonical request params."""
    serialized = json.dumps(canonical_params, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def _extract_system_prompt(params: dict) -> Optional[str]:
    """Extract system prompt text from request params."""
    system = params.get("system")
    if not system:
        return None
    if isinstance(system, list):
        return "\n".join(block.get("text", "") for block in system if isinstance(block, dict))
    return str(system)


def _extract_user_message(params: dict) -> Optional[str]:
    """Extract user message text from request params (all parts concatenated)."""
    messages = params.get("messages", [])
    if not messages:
        return None
    content = messages[0].get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            block.get("text", "") for block in content if isinstance(block, dict)
        )
    return str(content)


def _extract_tools(params: dict) -> Optional[list]:
    """Extract tool definitions from request params."""
    tools = params.get("tools")
    return tools if tools else None


def store_prompt(
    request_params: dict,
    pipeline: str,
    tier: Optional[int] = None,
    conn=None,
) -> int:
    """Hash, upsert, and return the prompt_templates.id for a single request.

    Args:
        request_params: The 'params' dict from a batch request
        pipeline: Pipeline name ('research', 'barrier', 'summarization')
        tier: Tier number (1, 2, 3) or None for single-pass
        conn: Optional DB connection (creates one if not provided)

    Returns:
        The prompt_templates.id
    """
    _validate_pipeline(pipeline)

    model = request_params.get("model")
    if not model:
        raise ValueError("request_params must include 'model'")

    canonical = _canonical_params(request_params)
    content_hash = _compute_hash(canonical)

    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    if conn is None:
        raise psycopg.OperationalError("Failed to establish database connection for prompt storage")

    try:
        tools = _extract_tools(request_params)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO prompt_templates (content_hash, pipeline, tier, model,
                    system_prompt, user_message, tools_schema, full_request)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (content_hash) DO UPDATE SET content_hash = EXCLUDED.content_hash
                RETURNING id
            """, (
                content_hash,
                pipeline,
                tier,
                model,
                _extract_system_prompt(request_params),
                _extract_user_message(request_params),
                json.dumps(tools) if tools else None,
                json.dumps(request_params, default=str),
            ))
            row = cur.fetchone()
            conn.commit()
            return row[0]
    except Exception:
        if should_close and conn:
            conn.rollback()
        raise
    finally:
        if should_close and conn:
            conn.close()


def store_prompt_batch(
    requests: list[dict],
    pipeline: str,
    tier: Optional[int] = None,
    conn=None,
) -> dict[str, int]:
    """Bulk upsert prompt templates and return custom_id -> prompt_id mapping.

    Args:
        requests: List of batch request dicts. Each must have 'custom_id'.
                  Request params can be nested under 'params' key or flat at top level.
        pipeline: Pipeline name ('research', 'barrier', 'summarization')
        tier: Tier number (1, 2, 3) or None for single-pass
        conn: Optional DB connection

    Returns:
        Dict mapping custom_id -> prompt_templates.id
    """
    if not requests:
        return {}

    _validate_pipeline(pipeline)

    # Validate all requests have custom_id
    for i, req in enumerate(requests):
        if "custom_id" not in req:
            raise ValueError(f"Request at index {i} missing 'custom_id' key")
        if "params" not in req:
            logger.warning(
                "Request %s missing 'params' key, using full dict as params",
                req.get("custom_id"),
            )

    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    if conn is None:
        raise psycopg.OperationalError(
            "Failed to establish database connection for prompt storage"
        )

    try:
        # Compute hashes and deduplicate
        hash_to_params: dict[str, dict] = {}
        cid_to_hash: dict[str, str] = {}

        for req in requests:
            params = req.get("params", req)
            canonical = _canonical_params(params)
            content_hash = _compute_hash(canonical)
            cid_to_hash[req["custom_id"]] = content_hash
            if content_hash not in hash_to_params:
                hash_to_params[content_hash] = params

        # Bulk upsert unique templates
        hash_to_id: dict[str, int] = {}

        with conn.cursor() as cur:
            for content_hash, params in hash_to_params.items():
                model = params.get("model")
                if not model:
                    raise ValueError(
                        f"Request params missing 'model' (hash={content_hash[:12]})"
                    )
                tools = _extract_tools(params)
                cur.execute("""
                    INSERT INTO prompt_templates (content_hash, pipeline, tier, model,
                        system_prompt, user_message, tools_schema, full_request)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (content_hash) DO UPDATE SET content_hash = EXCLUDED.content_hash
                    RETURNING id
                """, (
                    content_hash,
                    pipeline,
                    tier,
                    model,
                    _extract_system_prompt(params),
                    _extract_user_message(params),
                    json.dumps(tools) if tools else None,
                    json.dumps(params, default=str),
                ))
                row = cur.fetchone()
                hash_to_id[content_hash] = row[0]

            conn.commit()

        # Map custom_ids to prompt_ids
        result = {}
        for cid, h in cid_to_hash.items():
            result[cid] = hash_to_id[h]

        unique_count = len(hash_to_params)
        logger.info(
            "Stored %d prompt templates (%d unique) for %s tier %s",
            len(requests), unique_count, pipeline, tier,
        )

        return result

    except Exception:
        if should_close and conn:
            conn.rollback()
        raise
    finally:
        if should_close and conn:
            conn.close()
