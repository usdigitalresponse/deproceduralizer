"""
Langfuse client for LLM observability.

Provides lazy initialization and graceful degradation when Langfuse is not configured.
"""

import os
from functools import lru_cache
from typing import Optional, Dict, Any

from .types import LLMTraceContext
from .cost_map import calculate_cost


@lru_cache(maxsize=1)
def get_langfuse():
    """
    Get Langfuse client (lazy init, cached).

    Returns None if Langfuse is not configured (LANGFUSE_PUBLIC_KEY not set).
    All logging functions gracefully handle None client.

    Environment variables:
        LANGFUSE_SECRET_KEY: Langfuse secret key
        LANGFUSE_PUBLIC_KEY: Langfuse public key
        LANGFUSE_BASE_URL: Langfuse host URL (default: https://cloud.langfuse.com)
    """
    if not os.getenv("LANGFUSE_PUBLIC_KEY"):
        return None

    try:
        from langfuse import Langfuse
        # Langfuse reads env vars automatically:
        # LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_BASE_URL
        return Langfuse()
    except ImportError:
        print("Warning: langfuse package not installed. Run: pip install langfuse")
        return None
    except Exception as e:
        print(f"Warning: Failed to initialize Langfuse: {e}")
        return None


def log_generation(
    context: LLMTraceContext,
    name: str,
    model: str,
    input_text: str,
    output_text: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
    success: bool = True,
    error_message: Optional[str] = None,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
    trace_id: Optional[str] = None,
) -> None:
    """
    Log an LLM generation to Langfuse.

    Args:
        context: LLM trace context with run_id, stage, etc.
        name: Name for the generation (e.g., "call_llm_parse")
        model: Model name (e.g., "claude-haiku-4-5-20251001")
        input_text: Full input prompt
        output_text: Full output response
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        latency_ms: Latency in milliseconds
        success: Whether the call succeeded
        error_message: Error message if failed
        cache_read_tokens: Tokens read from cache
        cache_write_tokens: Tokens written to cache
        trace_id: Optional existing trace ID to attach to
    """
    client = get_langfuse()
    if not client:
        return

    try:
        # Calculate cost
        cost = calculate_cost(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_write_tokens=cache_write_tokens,
        )

        # Build metadata
        metadata = context.to_metadata()
        metadata["latency_ms"] = latency_ms
        metadata["success"] = success
        if error_message:
            metadata["error"] = error_message
        if cache_read_tokens:
            metadata["cache_read_tokens"] = cache_read_tokens
        if cache_write_tokens:
            metadata["cache_write_tokens"] = cache_write_tokens

        # Use the low-level API with start_span and start_generation
        with client.start_as_current_span(
            name=f"{context.stage or 'llm'}-{context.run_id}",
            input=input_text,  # Full prompt for visibility
            metadata={"run_id": context.run_id, "session_id": context.get_session_id()},
        ) as span:
            # Update trace with session info
            span.update_trace(
                name=f"{context.stage or 'pipeline'}-run",
                session_id=context.get_session_id(),
                user_id=context.run_id,
                tags=[context.state] if context.state else [],
            )

            # Log the generation
            with span.start_as_current_generation(
                name=name,
                model=model,
                input=input_text,
                model_parameters={"max_tokens": 64000},
                metadata=metadata,
            ) as generation:
                generation.update(
                    output=output_text,
                    usage_details={
                        "input": input_tokens,
                        "output": output_tokens,
                        "total": input_tokens + output_tokens,
                    },
                    cost_details={"total_cost": cost},
                    level="DEFAULT" if success else "ERROR",
                    status_message=error_message if error_message else None,
                )

    except Exception as e:
        # Fail silently - don't break the pipeline for observability issues
        print(f"Warning: Failed to log to Langfuse: {e}")


def log_batch_submission(
    context: LLMTraceContext,
    batch_id: str,
    batch_name: str,
    request_count: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Log a batch submission to Langfuse.

    Args:
        context: LLM trace context
        batch_id: Anthropic batch API ID
        batch_name: Human-readable batch name
        request_count: Number of requests in the batch
        metadata: Additional metadata

    Returns:
        Trace ID for the batch, or None if Langfuse not configured
    """
    client = get_langfuse()
    if not client:
        return None

    try:
        trace_metadata = context.to_metadata()
        trace_metadata["batch_id"] = batch_id
        trace_metadata["batch_name"] = batch_name
        trace_metadata["request_count"] = request_count
        if metadata:
            trace_metadata.update(metadata)

        with client.start_as_current_span(
            name=f"batch-{batch_name}",
            input={"batch_id": batch_id, "request_count": request_count},
            metadata=trace_metadata,
        ) as span:
            span.update_trace(
                name=f"batch-{batch_name}",
                session_id=context.get_session_id(),
                user_id=context.run_id,
                tags=["batch", context.state] if context.state else ["batch"],
            )
            return span.trace_id

    except Exception as e:
        print(f"Warning: Failed to log batch submission to Langfuse: {e}")
        return None


def log_batch_result(
    context: LLMTraceContext,
    trace_id: str,
    custom_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    success: bool,
    error_message: Optional[str] = None,
    cache_read_tokens: int = 0,
) -> None:
    """
    Log a single batch result to Langfuse.

    Args:
        context: LLM trace context
        trace_id: Trace ID from log_batch_submission
        custom_id: Custom ID of the request
        model: Model used
        input_tokens: Input token count
        output_tokens: Output token count
        success: Whether the request succeeded
        error_message: Error message if failed
        cache_read_tokens: Tokens read from cache
    """
    client = get_langfuse()
    if not client:
        return

    try:
        cost = calculate_cost(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
        )

        # For batch results, we create a simple event since we don't have the full context
        with client.start_as_current_span(
            name=f"batch-result-{custom_id}",
            input={"custom_id": custom_id},
            metadata={
                "custom_id": custom_id,
                "success": success,
                "cost_usd": cost,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                **({"error": error_message} if error_message else {}),
            },
            level="DEFAULT" if success else "ERROR",
        ) as span:
            span.update(
                output={"tokens": input_tokens + output_tokens, "cost": cost},
            )

    except Exception as e:
        print(f"Warning: Failed to log batch result to Langfuse: {e}")


def log_batch_completion(
    context: LLMTraceContext,
    trace_id: str,
    succeeded: int,
    errored: int,
    expired: int,
    total_input_tokens: int,
    total_output_tokens: int,
    total_cost: float,
) -> None:
    """
    Log batch completion summary to Langfuse.

    Args:
        context: LLM trace context
        trace_id: Trace ID from log_batch_submission
        succeeded: Number of succeeded requests
        errored: Number of errored requests
        expired: Number of expired requests
        total_input_tokens: Total input tokens across all requests
        total_output_tokens: Total output tokens across all requests
        total_cost: Total cost in USD
    """
    client = get_langfuse()
    if not client:
        return

    try:
        total_requests = succeeded + errored + expired
        success_rate = succeeded / total_requests if total_requests > 0 else 0

        with client.start_as_current_span(
            name="batch-completion",
            input={"total_requests": total_requests},
            metadata={
                "succeeded": succeeded,
                "errored": errored,
                "expired": expired,
                "success_rate": success_rate,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens,
                "total_cost_usd": total_cost,
            },
        ) as span:
            span.update(
                output={
                    "succeeded": succeeded,
                    "errored": errored,
                    "expired": expired,
                    "total_cost_usd": total_cost,
                },
            )

    except Exception as e:
        print(f"Warning: Failed to log batch completion to Langfuse: {e}")


def flush_langfuse() -> None:
    """
    Flush any pending Langfuse events.

    Call this at the end of a pipeline run to ensure all events are sent.
    """
    client = get_langfuse()
    if client:
        try:
            client.flush()
        except Exception as e:
            print(f"Warning: Failed to flush Langfuse: {e}")
