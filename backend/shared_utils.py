"""
Shared utilities for NY regulations backend scripts.

Consolidates duplicate code (DB connections, LLM calls, parsing, etc.)
to reduce duplication and enable easier maintenance.
"""

import os
import time
from typing import Optional, Type, Any
import psycopg
from psycopg import Connection
from openai import OpenAI, AsyncOpenAI
from pydantic import BaseModel


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
# LLM Utilities
# ============================================================================

def get_openai_client(api_key: Optional[str] = None) -> OpenAI:
    """
    Create OpenAI client (sync).

    Args:
        api_key: API key (default: OPENAI_API_KEY env var)

    Returns:
        OpenAI client instance
    """
    if api_key is None:
        api_key = os.getenv("OPENAI_API_KEY")
    return OpenAI(api_key=api_key)


def get_async_openai_client(api_key: Optional[str] = None) -> AsyncOpenAI:
    """
    Create AsyncOpenAI client (async).

    Args:
        api_key: API key (default: OPENAI_API_KEY env var)

    Returns:
        AsyncOpenAI client instance
    """
    if api_key is None:
        api_key = os.getenv("OPENAI_API_KEY")
    return AsyncOpenAI(api_key=api_key)


def call_llm_parse(
    client: OpenAI,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = "gpt-5-nano",
    temperature: float = 0,
    max_retries: int = 3,
) -> Optional[BaseModel]:
    """
    Call OpenAI API with structured output (Pydantic model).

    Handles retries automatically.

    Args:
        client: OpenAI client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: gpt-5-nano)
        temperature: Temperature for determinism (default: 0 for reproducibility)
        max_retries: Number of retries on failure (default: 3)

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    for attempt in range(max_retries):
        try:
            response = client.beta.chat.completions.parse(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format=response_format,
                temperature=temperature
            )

            parsed = response.choices[0].message.parsed

            if parsed is None:
                finish_reason = response.choices[0].finish_reason
                print(
                    f"      ⚠️  Parse failed (attempt {attempt + 1}/{max_retries}, "
                    f"finish_reason={finish_reason})"
                )
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to parse")
                    return None

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
    client: AsyncOpenAI,
    prompt: str,
    response_format: Type[BaseModel],
    model: str = "gpt-5-nano",
    temperature: float = 0,
    max_retries: int = 3,
) -> Optional[BaseModel]:
    """
    Call OpenAI API async with structured output (Pydantic model).

    Handles retries automatically.

    Args:
        client: AsyncOpenAI client instance
        prompt: User prompt/message
        response_format: Pydantic model for structured output
        model: Model name (default: gpt-5-nano)
        temperature: Temperature for determinism (default: 0 for reproducibility)
        max_retries: Number of retries on failure (default: 3)

    Returns:
        Parsed Pydantic model instance, or None if all retries fail
    """
    for attempt in range(max_retries):
        try:
            response = await client.beta.chat.completions.parse(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format=response_format,
                temperature=temperature
            )

            parsed = response.choices[0].message.parsed

            if parsed is None:
                finish_reason = response.choices[0].finish_reason
                print(
                    f"      ⚠️  Parse failed (attempt {attempt + 1}/{max_retries}, "
                    f"finish_reason={finish_reason})"
                )
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                else:
                    print(f"      ❌ All {max_retries} attempts failed to parse")
                    return None

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
