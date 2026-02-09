"""
Batch API management: request formatting, submission, status tracking, and result parsing.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Type

from pydantic import BaseModel

from lib.llm import DEFAULT_MODEL, _pydantic_to_tool_schema, get_anthropic_client


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
            batch_name="red_flags_NJ_3A",
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
        except Exception as e:
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

    return response_format.model_validate(input_data)
