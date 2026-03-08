"""
Batch API management: request formatting, submission, status tracking, and result parsing.
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional, Type

import logging

import anthropic
from pydantic import BaseModel, ValidationError

from lib.llm import DEFAULT_MODEL, _pydantic_to_tool_schema, call_llm_parse_async, get_anthropic_client
from lib.stats import format_time

logger = logging.getLogger(__name__)

# TYPE_CHECKING avoids circular import; CacheManager is only needed for type hints
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from lib.cache import CacheManager


def format_batch_request(
    custom_id: str,
    prompt: str,
    response_format: Type[BaseModel] = None,
    model: str = None,
    system: str = None,
    max_tokens: int = 64000,
    user_cached_prefix: str = None,
    tools: list[dict] = None,
) -> dict:
    """
    Format a single request for Anthropic Message Batches API submission.

    Used by batch_definitions.py for async batch processing.

    Args:
        custom_id: Unique identifier for matching results (e.g., "doc_12345")
        prompt: User prompt/message (document-specific content)
        response_format: Pydantic model for structured output (mutually exclusive with tools)
        model: Model name (default: DEFAULT_MODEL)
        system: Optional system message (static, cached across requests)
        user_cached_prefix: Optional prefix for user message that's shared across
            requests (e.g., issue config, batch context). Gets cache_control applied.
        tools: Optional list of tool definitions (e.g., web_search). When provided,
            response_format is ignored and model decides when to use tools.

    Returns:
        Dict formatted for client.beta.messages.batches.create()

    Example with structured output (Pydantic model):
        request = format_batch_request(
            custom_id=f"doc_{doc_id}",
            prompt=parts['user'],
            response_format=DefinitionsResponse,
            system=parts['system'],
        )

    Example with server tools (e.g., web search):
        request = format_batch_request(
            custom_id=f"tier3_{unit_id}",
            prompt=tier3_prompt,
            system=system_prompt,
            tools=[web_search_tool],  # Model decides when to search
        )
    """
    if model is None:
        model = DEFAULT_MODEL

    # Build user message content
    if user_cached_prefix:
        # Use multi-part content with cache_control on the shared prefix
        user_content = [
            {
                "type": "text",
                "text": user_cached_prefix,
                "cache_control": {"type": "ephemeral"}
            },
            {
                "type": "text",
                "text": prompt,
            }
        ]
    else:
        user_content = prompt

    params = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": user_content}],
    }

    # Add tools - either server tools (like web_search) or structured output tool
    if tools:
        # Server tools (e.g., web_search) - model decides when to use them
        params["tools"] = tools
        # Don't set tool_choice - let model decide when to search
    elif response_format:
        # Structured output via Pydantic model
        tool = _pydantic_to_tool_schema(response_format)
        params["tools"] = [tool]
        params["tool_choice"] = {"type": "tool", "name": tool["name"]}
    # If neither tools nor response_format, no tools in request

    # Add system message with cache_control for prompt caching
    # See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    if system:
        params["system"] = [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"}
            }
        ]

    return {
        "custom_id": custom_id,
        "params": params,
    }


class BatchManager:
    """
    Manages Anthropic Message Batches API operations.

    Provides a reusable interface for:
    - Submitting batches
    - Checking batch status
    - Processing batch results
    - Managing batch directories for caching

    Usage:
        manager = BatchManager(batches_dir=Path("data/outputs/batches"))

        # Submit a batch
        batch_id = manager.submit_batch(
            requests=formatted_requests,
            batch_name="compliance_NJ_3A",
            metadata={"state": "NJ", "title": "3A"}
        )

        # Check status
        status = manager.get_batch_status(batch_id)

        # Process results when complete
        for result in manager.get_batch_results(batch_id):
            # result has custom_id, result.type, result.message, etc.
            pass
    """

    def __init__(self, batches_dir: Path = None, client=None):
        """
        Initialize batch manager.

        Args:
            batches_dir: Directory to store batch metadata (default: None, no caching)
            client: Anthropic client (default: creates one using env var)
        """
        self.batches_dir = batches_dir
        self.client = client or get_anthropic_client()

        if batches_dir:
            batches_dir.mkdir(parents=True, exist_ok=True)

    def submit_batch(
        self,
        requests: list,
        batch_name: str = None,
        metadata: dict = None,
    ) -> str:
        """
        Submit a batch of requests to Anthropic.

        Args:
            requests: List of formatted batch requests (from format_batch_request)
            batch_name: Optional name for the batch directory
            metadata: Optional metadata to store with batch info

        Returns:
            Batch API ID (e.g., "msgbatch_xxx")

        Raises:
            Exception if batch submission fails
        """
        batch = self.client.beta.messages.batches.create(requests=requests)
        batch_id = batch.id

        # Save batch info locally if batches_dir is set
        if self.batches_dir:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            dir_name = f"{batch_name}_{timestamp}" if batch_name else f"batch_{timestamp}"
            batch_dir = self.batches_dir / dir_name
            batch_dir.mkdir(parents=True, exist_ok=True)

            batch_info = {
                'batch_api_id': batch_id,
                'created_at': datetime.now().isoformat(),
                'total_requests': len(requests),
                'status': 'submitted',
                **(metadata or {}),
            }

            with open(batch_dir / 'batch_info.json', 'w') as f:
                json.dump(batch_info, f, indent=2)

            # Save requests for later retrieval (for Langfuse logging)
            requests_file = batch_dir / 'requests.json'
            with open(requests_file, 'w') as f:
                json.dump({r['custom_id']: r for r in requests}, f, indent=2)

            # Add batch_id -> directory mapping for fast lookup
            mapping_file = self.batches_dir / 'batch_mapping.json'
            mapping = {}
            if mapping_file.exists():
                mapping = json.loads(mapping_file.read_text())
            mapping[batch_id] = str(batch_dir)
            mapping_file.write_text(json.dumps(mapping, indent=2))

        return batch_id

    def list_active_batches(self) -> list[dict]:
        """
        List all in-progress batches from the API.

        Returns:
            List of dicts with batch_id and request_counts for active batches
        """
        active = []
        try:
            batches = self.client.beta.messages.batches.list(limit=100)
            for batch in batches.data:
                if batch.processing_status == 'in_progress':
                    active.append({
                        'batch_id': batch.id,
                        'created_at': batch.created_at,
                        'processing': batch.request_counts.processing if batch.request_counts else 0,
                        'succeeded': batch.request_counts.succeeded if batch.request_counts else 0,
                    })
        except anthropic.APIStatusError as e:
            if e.status_code in (401, 403):
                raise  # Auth errors should not be silently caught
            print(f"Warning: Could not list batches from API: {e}")
        return active

    def get_batch_status(self, batch_id: str) -> dict:
        """
        Get status of a batch.

        Args:
            batch_id: Batch API ID

        Returns:
            Dict with:
                - status: 'in_progress', 'ended', 'canceling', 'canceled'
                - succeeded: count of succeeded requests
                - errored: count of errored requests
                - expired: count of expired requests
                - processing: count of still-processing requests
                - total: total request count
        """
        batch = self.client.beta.messages.batches.retrieve(batch_id)
        counts = batch.request_counts

        return {
            'status': batch.processing_status,
            'succeeded': counts.succeeded if counts else 0,
            'errored': counts.errored if counts else 0,
            'expired': counts.expired if counts else 0,
            'canceled': counts.canceled if counts else 0,
            'processing': counts.processing if counts else 0,
            'total': (counts.succeeded + counts.errored + counts.expired +
                     counts.canceled + counts.processing) if counts else 0,
        }

    def poll_until_complete(
        self,
        batch_id: str,
        poll_interval: int = 30,
        timeout: int = 3600 * 48,
        log: Callable[[str], None] = print,
    ) -> dict:
        """
        Poll a batch until complete with progress reporting and timeout.

        Args:
            batch_id: Batch API ID
            poll_interval: Seconds between polls
            timeout: Max seconds to wait (default: 48 hours)
            log: Logging function (default: print)

        Returns:
            Final status dict from get_batch_status

        Raises:
            TimeoutError: If batch doesn't complete within timeout
            Exception: If polling fails after max retries
        """
        start_time = time.time()
        last_progress = 0
        retry_count = 0
        max_retries = 5

        while True:
            elapsed = time.time() - start_time
            if elapsed > timeout:
                error_msg = f"Batch timed out after {format_time(elapsed)}"
                log(f"  {error_msg}")
                raise TimeoutError(error_msg)

            try:
                status = self.get_batch_status(batch_id)
                retry_count = 0

                if status["status"] == "ended":
                    log(f"  Batch complete in {format_time(elapsed)}")
                    log(f"    Succeeded: {status['succeeded']}, Errored: {status['errored']}")
                    return status

                completed = status.get("succeeded", 0) + status.get("errored", 0)
                total = status.get("total", 0)

                if completed > last_progress and total > 0:
                    rate = completed / elapsed if elapsed > 0 else 0
                    remaining = (total - completed) / rate if rate > 0 else 0
                    eta = format_time(remaining)
                    processing = status.get("processing", 0)
                    log(f"  Progress: {completed}/{total} ({processing} processing) ETA: {eta}")
                    last_progress = completed

            except Exception as e:
                retry_count += 1
                if retry_count > max_retries:
                    error_msg = f"Batch polling failed after {max_retries} retries: {e}"
                    log(f"  {error_msg}")
                    raise

                backoff = min(60, 2 ** retry_count)
                log(f"  API error (attempt {retry_count}/{max_retries}): {e}")
                log(f"      Retrying in {backoff}s...")
                time.sleep(backoff)
                continue

            time.sleep(poll_interval)

    def get_batch_results(self, batch_id: str):
        """
        Get results from a completed batch.

        Args:
            batch_id: Batch API ID

        Yields:
            Result objects with:
                - custom_id: The ID you provided when submitting
                - result.type: 'succeeded', 'errored', 'expired', 'canceled'
                - result.message: The response message (if succeeded)
                - result.error: Error info (if errored)

        Raises:
            Exception if batch is not complete
        """
        status = self.get_batch_status(batch_id)
        if status['status'] != 'ended':
            raise Exception(f"Batch not complete: {status['status']}")

        return self.client.beta.messages.batches.results(batch_id)

    def find_batch_dir(self, batch_id: str) -> Optional[Path]:
        """
        Find local batch directory by batch API ID.

        Args:
            batch_id: Batch API ID

        Returns:
            Path to batch directory, or None if not found
        """
        if not self.batches_dir or not self.batches_dir.exists():
            return None

        for batch_dir in self.batches_dir.iterdir():
            if not batch_dir.is_dir():
                continue
            info_file = batch_dir / 'batch_info.json'
            if info_file.exists():
                with open(info_file) as f:
                    info = json.load(f)
                if info.get('batch_api_id') == batch_id:
                    return batch_dir

        return None

    def load_requests(self, batch_id: str) -> dict:
        """
        Load original requests for a batch (for Langfuse logging).

        Uses the batch_mapping.json index for fast lookup, with fallback to
        directory scanning via find_batch_dir().

        Args:
            batch_id: Batch API ID (e.g., 'msgbatch_xxx')

        Returns:
            Dict mapping custom_id -> request dict, or empty dict if not found
        """
        if not self.batches_dir:
            return {}

        # Try fast lookup via mapping file
        mapping_file = self.batches_dir / 'batch_mapping.json'
        batch_dir = None

        if mapping_file.exists():
            try:
                mapping = json.loads(mapping_file.read_text())
                batch_dir_str = mapping.get(batch_id)
                if batch_dir_str:
                    batch_dir = Path(batch_dir_str)
            except (json.JSONDecodeError, IOError):
                pass  # Fall through to find_batch_dir

        # Fallback to directory scanning
        if batch_dir is None:
            batch_dir = self.find_batch_dir(batch_id)

        if batch_dir is None:
            return {}

        # Load requests file
        requests_file = batch_dir / 'requests.json'
        if not requests_file.exists():
            return {}

        try:
            return json.loads(requests_file.read_text())
        except (json.JSONDecodeError, IOError):
            return {}

    def log_error(self, batch_dir: Path, custom_id: str, error_type: str, message: str):
        """
        Log an error to the batch's error log file.

        Args:
            batch_dir: Path to batch directory
            custom_id: Custom ID of the failed request
            error_type: Type of error (e.g., 'ERROR', 'EXPIRED', 'TRUNCATED')
            message: Error message
        """
        errors_file = batch_dir / 'errors.log'
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(errors_file, 'a') as f:
            f.write(f"{timestamp} | {custom_id} | {error_type} | {message}\n")


def parse_batch_result_tool_use(result, response_format: Type[BaseModel]) -> Optional[BaseModel]:
    """
    Parse a batch result's tool_use content into a Pydantic model.

    Args:
        result: A batch result object (from BatchManager.get_batch_results)
        response_format: Pydantic model class to parse into

    Returns:
        Parsed Pydantic model, or None if parsing fails
    """
    if result.result.type != 'succeeded':
        return None

    message = result.result.message

    # Find tool_use block
    tool_use = None
    for block in message.content:
        if block.type == 'tool_use':
            tool_use = block
            break

    if not tool_use:
        return None

    # Parse input
    input_data = tool_use.input
    if isinstance(input_data, str):
        input_data = json.loads(input_data)

    # Pre-parse any stringified JSON values (batch API sometimes returns
    # nested structures like arrays/objects as JSON strings)
    if isinstance(input_data, dict):
        for key, val in input_data.items():
            if isinstance(val, str) and val.strip().startswith(('[', '{')):
                try:
                    input_data[key] = json.loads(val)
                except json.JSONDecodeError:
                    logger.debug("Pre-parse: key '%s' starts with [/{ but is not valid JSON: %.100s", key, val)

    return response_format.model_validate(input_data)


def _parse_cached_response(response_body: dict, output_class: Type[BaseModel]) -> Optional[BaseModel]:
    """Parse a cached response body into a Pydantic model.

    Handles two cache formats:
    - {"tool_use_input": {...}} — stored from realtime responses
    - {"content": [...]} — stored from batch message dicts
    """
    from pydantic import ValidationError

    try:
        # Format 1: direct tool_use input (from realtime cache)
        if "tool_use_input" in response_body:
            return output_class.model_validate(response_body["tool_use_input"])

        # Format 2: full message dict (from batch cache)
        content = response_body.get("content", [])
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                return output_class.model_validate(block.get("input", {}))

        return None
    except (ValidationError, json.JSONDecodeError) as e:
        print(f"  Cache parse error: {e}")
        return None


def _message_to_dict(message) -> dict:
    """Convert an Anthropic message object to a JSON-serializable dict for caching."""
    content = []
    for block in message.content:
        if block.type == "tool_use":
            content.append({
                "type": "tool_use",
                "id": block.id,
                "name": block.name,
                "input": block.input,
            })
        elif block.type == "text":
            content.append({
                "type": "text",
                "text": block.text,
            })
    return {
        "content": content,
        "model": message.model,
        "stop_reason": message.stop_reason,
        "role": message.role,
    }


def extract_request_params(request: dict) -> tuple[str, str]:
    """Extract (user_prompt, system) from a batch-formatted request dict."""
    params = request.get("params", request.get("body", {}))
    messages = params.get("messages", [])
    user_prompt = messages[0]["content"] if messages else ""

    system_raw = params.get("system", "")
    if isinstance(system_raw, list) and system_raw:
        system = system_raw[0].get("text", "")
    else:
        system = system_raw

    return user_prompt, system


def run_batch_tier(
    batch_requests: list[dict],
    id_map: dict[str, int],
    units: list,
    output_class: Type[BaseModel],
    output_attr: str,
    batch_id_attr: str,
    success_state,
    batch_name: str,
    get_unit_id: Callable = None,
    manager: BatchManager | None = None,
    cache: "CacheManager | None" = None,
    cache_pipeline: str | None = None,
    cache_tier: int | None = None,
    error_state=None,
) -> str:
    """Submit batch, poll, parse results into units. Returns batch_id.

    When cache is provided:
    - Hash each request and check cache in bulk
    - Submit only uncached requests to Anthropic
    - Store new responses in cache after results
    - Merge cached + fresh results

    Args:
        error_state: Optional state to assign to units whose results fail to parse.
                     If None, parse failures are silently skipped.
    """
    if get_unit_id is None:
        get_unit_id = lambda u: u.document_id

    if manager is None:
        manager = BatchManager()

    # --- Cache: split into cached and uncached ---
    cached_results: dict[str, dict] = {}  # custom_id -> response_body
    uncached_requests = batch_requests
    request_hashes: dict[str, str] = {}  # custom_id -> hash

    if cache and cache.enabled:
        # Compute hashes for all requests
        for req in batch_requests:
            h = cache.compute_hash(req["params"])
            request_hashes[req["custom_id"]] = h

        # Bulk lookup
        all_hashes = list(request_hashes.values())
        hash_to_response = cache.lookup_batch(all_hashes)

        # Split
        hash_to_custom_ids = {}
        for cid, h in request_hashes.items():
            hash_to_custom_ids.setdefault(h, []).append(cid)

        cached_custom_ids = set()
        for h, resp in hash_to_response.items():
            for cid in hash_to_custom_ids.get(h, []):
                cached_results[cid] = resp
                cached_custom_ids.add(cid)

        uncached_requests = [r for r in batch_requests if r["custom_id"] not in cached_custom_ids]

        if cached_results:
            print(f"  Cache: {len(cached_results)} hits, {len(uncached_requests)} to submit")

    # --- Process cached results ---
    unit_by_id = {get_unit_id(u): u for u in units}
    for custom_id, response_body in cached_results.items():
        parsed = _parse_cached_response(response_body, output_class)
        if parsed:
            doc_id = id_map.get(custom_id)
            if doc_id and doc_id in unit_by_id:
                unit = unit_by_id[doc_id]
                setattr(unit, output_attr, parsed)
                setattr(unit, batch_id_attr, "cache")
                unit.state = success_state

    # --- Submit uncached requests ---
    if not uncached_requests:
        print(f"  All {len(batch_requests)} requests served from cache")
        return "cache"

    batch_id = manager.submit_batch(uncached_requests, batch_name=batch_name)
    manager.poll_until_complete(batch_id)

    # --- Process fresh results and store in cache ---
    cache_entries = []
    parse_errors = 0
    for result in manager.get_batch_results(batch_id):
        try:
            parsed = parse_batch_result_tool_use(result, output_class)
        except Exception as e:
            parse_errors += 1
            logger.warning("Failed to parse result for %s: %s", result.custom_id, e)
            parsed = None
        if parsed:
            doc_id = id_map.get(result.custom_id)
            if doc_id and doc_id in unit_by_id:
                unit = unit_by_id[doc_id]
                setattr(unit, output_attr, parsed)
                setattr(unit, batch_id_attr, batch_id)
                unit.state = success_state

            # Store in cache
            if cache and cache.enabled and result.result.type == "succeeded":
                custom_id = result.custom_id
                h = request_hashes.get(custom_id)
                if h:
                    # Find original request for this custom_id
                    orig_req = next((r for r in uncached_requests if r["custom_id"] == custom_id), None)
                    if orig_req:
                        msg = result.result.message
                        usage = {
                            "input_tokens": getattr(msg.usage, "input_tokens", 0) if msg.usage else 0,
                            "output_tokens": getattr(msg.usage, "output_tokens", 0) if msg.usage else 0,
                            "cache_read_tokens": getattr(msg.usage, "cache_read_input_tokens", 0) if msg.usage else 0,
                            "cache_write_tokens": getattr(msg.usage, "cache_creation_input_tokens", 0) if msg.usage else 0,
                        }
                        response_body = _message_to_dict(msg)
                        cache_entries.append({
                            "request_hash": h,
                            "model": orig_req["params"].get("model", DEFAULT_MODEL),
                            "request_body": orig_req["params"],
                            "response_body": response_body,
                            "usage": usage,
                            "pipeline": cache_pipeline,
                            "tier": cache_tier,
                            "document_id": doc_id,
                        })
        elif error_state is not None:
            # Mark units with unparseable results as errors
            doc_id = id_map.get(result.custom_id)
            if doc_id and doc_id in unit_by_id:
                unit = unit_by_id[doc_id]
                unit.state = error_state

    if cache_entries:
        cache.store_batch(cache_entries)
        print(f"  Cache: stored {len(cache_entries)} new responses")

    if parse_errors:
        print(f"  WARNING: {parse_errors} result(s) failed to parse and were skipped")

    return batch_id


def run_realtime_tier(
    batch_requests: list[dict],
    id_map: dict[str, int],
    units: list,
    output_class: Type[BaseModel],
    output_attr: str,
    batch_id_attr: str,
    success_state,
    error_state,
    tier_name: str,
    model: str,
    get_unit_id: Callable = None,
    get_unit_label: Callable = None,
    cache: "CacheManager | None" = None,
    cache_pipeline: str | None = None,
    cache_tier: int | None = None,
) -> None:
    """Run batch-formatted requests one-by-one via the realtime API.

    When cache is provided, checks cache before each API call and stores after.
    """
    if get_unit_id is None:
        get_unit_id = lambda u: u.document_id

    if get_unit_label is None:
        get_unit_label = lambda u: str(get_unit_id(u))

    async def _run():
        client = anthropic.AsyncAnthropic()
        unit_by_id = {get_unit_id(u): u for u in units}
        total = len(batch_requests)
        cache_hit_count = 0

        for i, request in enumerate(batch_requests):
            custom_id = request["custom_id"]
            doc_id = id_map.get(custom_id)
            if not doc_id or doc_id not in unit_by_id:
                continue

            unit = unit_by_id[doc_id]
            label = get_unit_label(unit)

            print(f"  [{i+1}/{total}] {label}...", end="", flush=True)

            # --- Cache check ---
            if cache and cache.enabled:
                request_hash = cache.compute_hash(request["params"])
                cached = cache.lookup(request_hash)
                if cached:
                    parsed = _parse_cached_response(cached, output_class)
                    if parsed:
                        setattr(unit, output_attr, parsed)
                        setattr(unit, batch_id_attr, "cache")
                        unit.state = success_state
                        cache_hit_count += 1
                        print(f" CACHE HIT")
                        continue

            user_prompt, system = extract_request_params(request)
            start = time.time()

            try:
                result, usage = await call_llm_parse_async(
                    client=client,
                    prompt=user_prompt,
                    response_format=output_class,
                    system=system,
                    model=model,
                    max_tokens=64000,
                )

                elapsed = time.time() - start

                if result:
                    setattr(unit, output_attr, result)
                    setattr(unit, batch_id_attr, "realtime")
                    unit.state = success_state
                    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
                    print(f" OK ({elapsed:.1f}s, {tokens} tokens)")

                    # Store in cache
                    if cache and cache.enabled:
                        response_body = {"tool_use_input": result.model_dump()}
                        cache.store(
                            request_hash=request_hash,
                            request_body=request["params"],
                            response_body=response_body,
                            model=model,
                            usage=usage,
                            pipeline=cache_pipeline,
                            tier=cache_tier,
                            document_id=doc_id,
                        )
                else:
                    unit.state = error_state
                    unit.error = f"{tier_name} returned None"
                    print(f" FAILED (no result, {elapsed:.1f}s)")

            except Exception as e:
                elapsed = time.time() - start
                unit.state = error_state
                unit.error = str(e)[:200]
                print(f" ERROR ({elapsed:.1f}s): {str(e)[:80]}")

        if cache_hit_count > 0:
            print(f"  Cache: {cache_hit_count}/{total} served from cache")

    asyncio.run(_run())
