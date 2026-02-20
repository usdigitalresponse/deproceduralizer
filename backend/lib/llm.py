"""
LLM client factories, structured output parsing (sync + async), and observability logging.
"""

import asyncio
import os
import time
from typing import Optional, Type, Any, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from observability.types import LLMTraceContext

import anthropic
import pydantic
from pydantic import BaseModel


# Default model
DEFAULT_MODEL = "claude-sonnet-4-6"


def get_anthropic_client(api_key: Optional[str] = None) -> anthropic.Anthropic:
    """
    Create Anthropic client (sync).

    Args:
        api_key: API key (default: ANTHROPIC_API_KEY env var)

    Returns:
        Anthropic client instance
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=api_key)


def get_async_anthropic_client(api_key: Optional[str] = None) -> anthropic.AsyncAnthropic:
    """
    Create AsyncAnthropic client (async).

    Args:
        api_key: API key (default: ANTHROPIC_API_KEY env var)

    Returns:
        AsyncAnthropic client instance
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    # Set timeout to avoid streaming requirement for operations under 10 minutes
    # See: https://github.com/anthropics/anthropic-sdk-python#long-requests
    return anthropic.AsyncAnthropic(
        api_key=api_key,
        timeout=600.0,  # 10 minute timeout
    )


def _pydantic_to_tool_schema(model: Type[BaseModel], with_cache_control: bool = True) -> dict:
    """
    Convert a Pydantic model to Anthropic tool schema.

    Args:
        model: Pydantic model class to convert
        with_cache_control: If True, add cache_control for prompt caching
                           (should be True for the last tool in the array)

    Returns:
        Tool schema dict for Anthropic API
    """
    schema = model.model_json_schema()
    tool = {
        "name": model.__name__,
        "description": f"Extract {model.__name__} from the text",
        "input_schema": schema
    }

    # Add cache_control for prompt caching
    # See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    # TTL must be >= system prompt TTL (1h) because the API requires
    # non-increasing TTL order across tools → system → messages.
    if with_cache_control:
        tool["cache_control"] = {"type": "ephemeral", "ttl": "1h"}

    return tool


def call_llm_parse(
    client: anthropic.Anthropic,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    max_retries: int = 3,
    max_tokens: int = 64000,
    system: Optional[str] = None,
    trace_context: Optional["LLMTraceContext"] = None,
) -> Optional[BaseModel]:
    """
    Call Anthropic API with structured output (Pydantic model via tool_use).

    Handles retries automatically. Uses system prompt for caching when provided.

    Args:
        client: Anthropic client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)
        max_tokens: Max output tokens (default: 64000 for Claude 4.5 models)
        system: Optional system prompt (cached across requests)
        trace_context: Optional LLMTraceContext for observability logging

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    # Build request kwargs
    request_kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": tool["name"]},
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        # Use cache_control for prompt caching on repeated system prompts
        request_kwargs["system"] = [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral", "ttl": "1h"}
            }
        ]

    for attempt in range(max_retries):
        start_time = time.time()
        try:
            response = client.messages.create(**request_kwargs)
            latency_ms = (time.time() - start_time) * 1000

            # Check for truncation due to max_tokens
            if response.stop_reason == "max_tokens":
                print(
                    f"      ⚠️  Response truncated (stop_reason=max_tokens). "
                    f"Output may be incomplete."
                )

            # Extract tool use from response
            tool_use = None
            for block in response.content:
                if block.type == "tool_use":
                    tool_use = block
                    break

            # Extract usage for logging
            usage = {
                "input_tokens": getattr(response.usage, "input_tokens", 0),
                "output_tokens": getattr(response.usage, "output_tokens", 0),
                "cache_read_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
                "cache_write_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
            }

            if tool_use is None:
                print(
                    f"      ⚠️  No tool_use in response (attempt {attempt + 1}/{max_retries})"
                )
                if attempt < max_retries - 1:
                    time.sleep(min(30, 2 ** attempt))
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to get tool_use")
                    # Log failure if trace_context provided
                    if trace_context:
                        _log_llm_call(trace_context, model, prompt, "", usage, latency_ms, success=False, error_message="No tool_use in response")
                    return None

            # Parse the tool input with Pydantic
            parsed = response_format.model_validate(tool_use.input)
            if attempt > 0:
                print(f"      ✅ Retry succeeded on attempt {attempt + 1}")

            # Log success if trace_context provided
            if trace_context:
                output_text = parsed.model_dump_json() if parsed else ""
                _log_llm_call(trace_context, model, prompt, output_text, usage, latency_ms, success=True)

            return parsed

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )
            if attempt < max_retries - 1:
                time.sleep(min(30, 2 ** attempt))
                continue
            print(f"      ❌ All {max_retries} attempts failed")
            # Log failure if trace_context provided
            if trace_context:
                _log_llm_call(trace_context, model, prompt, "", {}, latency_ms, success=False, error_message=str(e))
            return None

    return None


def _log_llm_call(
    trace_context: "LLMTraceContext",
    model: str,
    input_text: str,
    output_text: str,
    usage: Dict,
    latency_ms: float,
    success: bool = True,
    error_message: Optional[str] = None,
) -> None:
    """Helper to log LLM calls to Langfuse if available."""
    try:
        from observability.langfuse_client import log_generation
        log_generation(
            context=trace_context,
            name="call_llm_parse",
            model=model,
            input_text=input_text,
            output_text=output_text,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            latency_ms=latency_ms,
            success=success,
            error_message=error_message,
            cache_read_tokens=usage.get("cache_read_tokens", 0),
            cache_write_tokens=usage.get("cache_write_tokens", 0),
        )
    except ImportError:
        pass  # Observability not available
    except Exception:
        pass  # Don't let logging errors break the main flow


# TODO: Consolidate call_llm_parse and call_llm_parse_async into a single
# implementation. The async variant returns (parsed, usage) while sync returns
# just parsed — unifying the return types is a separate concern.

async def call_llm_parse_async(
    client: anthropic.AsyncAnthropic,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    max_retries: int = 3,
    system: Optional[str] = None,
    max_tokens: int = 64000,
    trace_context: Optional[dict] = None,
    cache: Optional[Any] = None,
    cache_metadata: Optional[Dict] = None,
) -> tuple[Optional[BaseModel], dict]:
    """
    Call Anthropic API async with structured output (Pydantic model via tool_use).

    Handles retries automatically. Uses system prompt for caching when provided.

    Args:
        client: AsyncAnthropic client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)
        system: Optional system prompt (cached across batch requests)
        max_tokens: Max output tokens (default: 64000)
        trace_context: Optional Langfuse trace context for observability
        cache: Optional CacheManager for LLM response caching
        cache_metadata: Optional dict with pipeline, tier, document_id for cache storage

    Returns:
        Tuple of (parsed Pydantic model instance or None, usage dict with token counts)
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    # Build request kwargs
    request_kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": tool["name"]},
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        # Use cache_control for prompt caching on repeated system prompts
        request_kwargs["system"] = [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral", "ttl": "1h"}
            }
        ]

    # --- Cache check ---
    request_hash = None
    if cache and cache.enabled:
        request_hash = cache.compute_hash(request_kwargs)
        cached = cache.lookup(request_hash)
        if cached:
            # Parse cached response
            tool_input = cached.get("tool_use_input")
            if tool_input:
                try:
                    parsed = response_format.model_validate(tool_input)
                    return parsed, {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0}
                except pydantic.ValidationError as e:
                    print(f"  Cache parse warning: {e}")
                    # Fall through to API call

    for attempt in range(max_retries):
        start_time = time.time()
        try:
            # Use streaming to avoid timeout for long-running requests
            async with client.messages.stream(**request_kwargs) as stream:
                response = await stream.get_final_message()
            latency_ms = (time.time() - start_time) * 1000

            # Check for truncation due to max_tokens
            if response.stop_reason == "max_tokens":
                print(
                    f"      ⚠️  Response truncated (stop_reason=max_tokens). "
                    f"Output may be incomplete."
                )

            # Extract tool use from response
            tool_use = None
            for block in response.content:
                if block.type == "tool_use":
                    tool_use = block
                    break

            # Extract usage from response
            usage = {
                "input_tokens": getattr(response.usage, "input_tokens", 0),
                "output_tokens": getattr(response.usage, "output_tokens", 0),
                "cache_read_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
                "cache_write_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
            }

            if tool_use is None:
                print(
                    f"      ⚠️  No tool_use in response (attempt {attempt + 1}/{max_retries})"
                )
                # Log failure if trace_context provided
                if trace_context:
                    _log_llm_call(trace_context, model, prompt, "", usage, latency_ms, success=False, error_message="No tool_use in response")
                if attempt < max_retries - 1:
                    await asyncio.sleep(min(30, 2 ** attempt))
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to get tool_use")
                    return None, usage

            # Parse the tool input with Pydantic
            parsed = response_format.model_validate(tool_use.input)
            if attempt > 0:
                print(f"      ✅ Retry succeeded on attempt {attempt + 1}")

            # Log success if trace_context provided
            if trace_context:
                output_text = parsed.model_dump_json() if parsed else ""
                _log_llm_call(trace_context, model, prompt, output_text, usage, latency_ms, success=True)

            # --- Cache store ---
            if cache and cache.enabled and request_hash and parsed:
                meta = cache_metadata or {}
                cache.store(
                    request_hash=request_hash,
                    request_body=request_kwargs,
                    response_body={"tool_use_input": parsed.model_dump()},
                    model=model,
                    usage=usage,
                    pipeline=meta.get("pipeline"),
                    tier=meta.get("tier"),
                    document_id=meta.get("document_id"),
                    stale_after=meta.get("stale_after"),
                )

            return parsed, usage

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(min(30, 2 ** attempt))
                continue
            print(f"      ❌ All {max_retries} attempts failed")
            # Log failure if trace_context provided
            if trace_context:
                _log_llm_call(trace_context, model, prompt, "", {}, latency_ms, success=False, error_message=str(e))
            return None, {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0}

    return None, {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0}


async def call_llm_beta_async(
    client: anthropic.AsyncAnthropic,
    prompt: str,
    system: str,
    tools: list[dict],
    model: str = None,
    max_retries: int = 3,
    max_tokens: int = 64000,
    betas: list[str] = None,
    output_format: dict = None,
    cache_ttl: str = "1h",
    cache: Optional[Any] = None,
    cache_metadata: Optional[Dict] = None,
) -> tuple[Any, dict]:
    """
    Call Anthropic Beta API async with support for structured outputs and web search.

    This function extends call_llm_parse_async to support beta features like:
    - Structured outputs (output_format parameter)
    - Web search tool
    - Other beta features via betas parameter

    Handles retries with exponential backoff automatically.

    Args:
        client: AsyncAnthropic client instance
        prompt: User prompt/message
        system: System prompt (required, will be cached)
        tools: List of tool definitions (e.g., web search tool)
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)
        max_tokens: Max output tokens (default: 64000 for Claude 4.5 models)
        betas: List of beta features to enable (e.g., ["structured-outputs-2025-11-13"])
        output_format: Structured output format spec (for beta structured outputs)
        cache_ttl: Cache TTL for system prompt (default: "1h")
        cache: Optional CacheManager for LLM response caching
        cache_metadata: Optional dict with pipeline, tier, document_id, stale_after

    Returns:
        Tuple of (API response object, usage dict).
        Usage dict has: input_tokens, output_tokens, cache_read_tokens, cache_write_tokens.
        Returns (None, {}) if all retries fail.
    """
    if model is None:
        model = DEFAULT_MODEL

    # Build request kwargs
    system_block = {
        "type": "text",
        "text": system,
    }
    if cache_ttl:
        system_block["cache_control"] = {"type": "ephemeral", "ttl": cache_ttl}

    request_kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "system": [system_block],
        "messages": [{"role": "user", "content": prompt}],
    }

    if tools:
        request_kwargs["tools"] = tools

    # Add beta features if specified
    if betas:
        request_kwargs["betas"] = betas

    # Add structured output format if specified
    if output_format:
        request_kwargs["output_format"] = output_format

    # --- Cache check ---
    # Note: For web search responses, callers should set stale_after in cache_metadata
    request_hash = None
    if cache and cache.enabled:
        request_hash = cache.compute_hash(request_kwargs)
        cached = cache.lookup(request_hash)
        if cached:
            # Return a lightweight wrapper that has the cached content
            cached_response = _CachedBetaResponse(cached)
            return cached_response, {"input_tokens": 0, "output_tokens": 0, "cache_read_tokens": 0, "cache_write_tokens": 0}

    for attempt in range(max_retries):
        start_time = time.time()
        try:
            response = await client.beta.messages.create(**request_kwargs)

            # Check for truncation due to max_tokens
            if response.stop_reason == "max_tokens":
                print(
                    f"      ⚠️  Response truncated (stop_reason=max_tokens). "
                    f"Output may be incomplete."
                )

            if attempt > 0:
                print(f"      ✅ Retry succeeded on attempt {attempt + 1}")

            # Extract token usage from response
            usage = response.usage
            input_tokens = usage.input_tokens if usage else 0
            output_tokens = usage.output_tokens if usage else 0
            cache_read = getattr(usage, 'cache_read_input_tokens', 0) or 0
            cache_write = getattr(usage, 'cache_creation_input_tokens', 0) or 0

            # Return response with usage dict for cost tracking
            usage_dict = {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_read_tokens": cache_read,
                "cache_write_tokens": cache_write,
            }

            # --- Cache store ---
            if cache and cache.enabled and request_hash and response:
                meta = cache_metadata or {}
                response_body = _beta_response_to_dict(response)
                cache.store(
                    request_hash=request_hash,
                    request_body=request_kwargs,
                    response_body=response_body,
                    model=model,
                    usage=usage_dict,
                    pipeline=meta.get("pipeline"),
                    tier=meta.get("tier"),
                    document_id=meta.get("document_id"),
                    stale_after=meta.get("stale_after"),
                )

            return response, usage_dict

        except Exception as e:
            wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s

            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )

            if attempt < max_retries - 1:
                print(f"      Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue

            print(f"      ❌ All {max_retries} attempts failed")
            return None, {}

    return None, {}


class _CachedBetaResponse:
    """Lightweight wrapper around cached beta response data.

    Mimics the Anthropic beta response interface enough for callers
    that access .content, .stop_reason, .model, .role, and .usage.
    """

    def __init__(self, data: dict):
        self._data = data
        self.stop_reason = data.get("stop_reason", "end_turn")
        self.model = data.get("model", "")
        self.role = data.get("role", "assistant")
        self.usage = None
        self.content = []
        for block in data.get("content", []):
            self.content.append(_CachedContentBlock(block))


class _CachedContentBlock:
    """Mimics an Anthropic content block from cached data."""

    def __init__(self, data: dict):
        self.type = data.get("type", "text")
        self.text = data.get("text", "")
        self.id = data.get("id", "")
        self.name = data.get("name", "")
        self.input = data.get("input", {})


def _beta_response_to_dict(response) -> dict:
    """Convert a beta API response to a JSON-serializable dict for caching."""
    content = []
    for block in response.content:
        block_dict = {"type": block.type}
        if block.type == "text":
            block_dict["text"] = block.text
        elif block.type == "tool_use":
            block_dict["id"] = block.id
            block_dict["name"] = block.name
            block_dict["input"] = block.input
        elif block.type == "server_tool_use":
            block_dict["id"] = getattr(block, "id", "")
            block_dict["name"] = getattr(block, "name", "")
            block_dict["input"] = getattr(block, "input", {})
        elif block.type == "web_search_tool_result":
            block_dict["tool_use_id"] = getattr(block, "tool_use_id", "")
            block_dict["content"] = getattr(block, "content", [])
            # Content may contain search result objects — serialize them
            if hasattr(block, "content") and block.content:
                serialized = []
                for item in block.content:
                    if hasattr(item, "model_dump"):
                        serialized.append(item.model_dump())
                    elif hasattr(item, "__dict__"):
                        serialized.append(item.__dict__)
                    else:
                        serialized.append(item)
                block_dict["content"] = serialized
        content.append(block_dict)
    return {
        "content": content,
        "model": response.model,
        "stop_reason": response.stop_reason,
        "role": response.role,
    }
