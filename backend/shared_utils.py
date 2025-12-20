"""
Shared utilities for NY regulations backend scripts.

Consolidates duplicate code (DB connections, LLM calls, parsing, etc.)
to reduce duplication and enable easier maintenance.
"""

import os
import time
import json
import asyncio
from pathlib import Path
from typing import Optional, Type, Any, Dict
import yaml
import psycopg
from psycopg import Connection
import anthropic
from pydantic import BaseModel


# ============================================================================
# Prompt Loading Utilities
# ============================================================================

# Cache for loaded prompts
_prompts_cache: Optional[Dict] = None


def _get_prompts_path() -> Path:
    """Get the path to prompts.yaml in the project root."""
    # shared_utils.py is in backend/, prompts.yaml is in root
    return Path(__file__).parent.parent / "prompts.yaml"


def _load_prompts() -> Dict:
    """Load prompts from YAML file (cached)."""
    global _prompts_cache
    if _prompts_cache is None:
        prompts_path = _get_prompts_path()
        with open(prompts_path, 'r') as f:
            _prompts_cache = yaml.safe_load(f)
    return _prompts_cache


def load_prompt(prompt_name: str, **kwargs) -> str:
    """
    Load a prompt template and fill in variables.

    Args:
        prompt_name: Name of the prompt in prompts.yaml (e.g., "red_flags_analysis")
        **kwargs: Variables to substitute in the template (e.g., section_text="...", citation="...")

    Returns:
        Formatted prompt string with variables filled in

    Example:
        prompt = load_prompt("red_flags_analysis",
                            section_text="The regulation text...",
                            citation="N.J.A.C. 1:1-1.1",
                            heading="General Provisions")
    """
    prompts = _load_prompts()

    if prompt_name not in prompts:
        available = list(prompts.keys())
        raise ValueError(f"Unknown prompt '{prompt_name}'. Available: {available}")

    prompt_data = prompts[prompt_name]
    template = prompt_data.get("template", "")

    # Fill in variables
    return template.format(**kwargs)


def get_prompt_description(prompt_name: str) -> str:
    """Get the description of a prompt."""
    prompts = _load_prompts()
    if prompt_name not in prompts:
        raise ValueError(f"Unknown prompt '{prompt_name}'")
    return prompts[prompt_name].get("description", "")


def list_prompts() -> list:
    """List all available prompt names."""
    prompts = _load_prompts()
    return list(prompts.keys())


def get_db_connection(timeout: int = 30) -> Optional[Connection]:
    """
    Create connection to Neon PostgreSQL database.

    Consolidates duplicate implementation from multiple scripts.
    Used by: migrate_to_postgres, populate_parent_ids, analyze_definition_usage,
             analyze_red_flags, run_pipeline, extract_definitions

    Args:
        timeout: Connection timeout in seconds

    Returns:
        Connection object, or None if connection fails or DATABASE_URL not set
    """
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("Warning: DATABASE_URL not set in .env")
            return None

        conn = psycopg.connect(database_url, connect_timeout=timeout)

        # Set statement timeout (Neon pooler compatibility)
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '300000ms'")  # 5 minute timeout

        return conn
    except Exception as e:
        print(f"Warning: Database connection failed: {e}")
        return None


# ============================================================================
# LLM Utilities (Anthropic)
# ============================================================================

# Default model
DEFAULT_MODEL = "claude-haiku-4-5-20251001"


def get_openai_client(api_key: Optional[str] = None) -> anthropic.Anthropic:
    """
    Create Anthropic client (sync).
    Named get_openai_client for backwards compatibility.

    Args:
        api_key: API key (default: ANTHROPIC_API_KEY env var)

    Returns:
        Anthropic client instance
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=api_key)


def get_async_openai_client(api_key: Optional[str] = None) -> anthropic.AsyncAnthropic:
    """
    Create AsyncAnthropic client (async).
    Named get_async_openai_client for backwards compatibility.

    Args:
        api_key: API key (default: ANTHROPIC_API_KEY env var)

    Returns:
        AsyncAnthropic client instance
    """
    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
    return anthropic.AsyncAnthropic(api_key=api_key)


def _pydantic_to_tool_schema(model: Type[BaseModel]) -> dict:
    """Convert a Pydantic model to Anthropic tool schema."""
    schema = model.model_json_schema()
    return {
        "name": model.__name__,
        "description": f"Extract {model.__name__} from the text",
        "input_schema": schema
    }


def call_llm_parse(
    client: anthropic.Anthropic,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    max_retries: int = 3,
) -> Optional[BaseModel]:
    """
    Call Anthropic API with structured output (Pydantic model via tool_use).

    Handles retries automatically.

    Args:
        client: Anthropic client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    for attempt in range(max_retries):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract tool use from response
            tool_use = None
            for block in response.content:
                if block.type == "tool_use":
                    tool_use = block
                    break

            if tool_use is None:
                print(
                    f"      ⚠️  No tool_use in response (attempt {attempt + 1}/{max_retries})"
                )
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to get tool_use")
                    return None

            # Parse the tool input with Pydantic
            parsed = response_format.model_validate(tool_use.input)

            if attempt > 0:
                print(f"      ✓ Success on attempt {attempt + 1}")

            return parsed

        except Exception as e:
            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            print(f"      ❌ All {max_retries} attempts failed")
            return None

    return None


async def call_llm_parse_async(
    client: anthropic.AsyncAnthropic,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = None,
    max_retries: int = 3,
) -> Optional[BaseModel]:
    """
    Call Anthropic API async with structured output (Pydantic model via tool_use).

    Handles retries automatically.

    Args:
        client: AsyncAnthropic client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: DEFAULT_MODEL)
        max_retries: Number of retries on failure (default: 3)

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    if model is None:
        model = DEFAULT_MODEL

    tool = _pydantic_to_tool_schema(response_format)

    for attempt in range(max_retries):
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=4096,
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract tool use from response
            tool_use = None
            for block in response.content:
                if block.type == "tool_use":
                    tool_use = block
                    break

            if tool_use is None:
                print(
                    f"      ⚠️  No tool_use in response (attempt {attempt + 1}/{max_retries})"
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to get tool_use")
                    return None

            # Parse the tool input with Pydantic
            parsed = response_format.model_validate(tool_use.input)

            if attempt > 0:
                print(f"      ✓ Success on attempt {attempt + 1}")

            return parsed

        except Exception as e:
            print(
                f"      ⚠️  API error: {type(e).__name__}: {e} "
                f"(attempt {attempt + 1}/{max_retries})"
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            print(f"      ❌ All {max_retries} attempts failed")
            return None

    return None
