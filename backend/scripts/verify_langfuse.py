#!/usr/bin/env python3
"""
Test script for Langfuse observability integration.

This script makes a single LLM call with tracing enabled to verify
the Langfuse integration is working correctly.

Usage:
    python backend/scripts/test_observability.py
"""

import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables
load_dotenv()

from lib.llm import call_llm_parse, get_anthropic_client
from observability import LLMTraceContext, flush_langfuse


class SimpleResponse(BaseModel):
    """Simple response for testing."""
    answer: str
    confidence: float


def test_observability():
    """Test the Langfuse observability integration with a simple LLM call."""
    print("Testing Langfuse observability integration...")
    print()

    # Check Langfuse configuration
    if not os.getenv("LANGFUSE_PUBLIC_KEY"):
        print("Warning: LANGFUSE_PUBLIC_KEY not set. Langfuse integration is disabled.")
        print("Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable observability.")
    else:
        print(f"Langfuse configured:")
        print(f"  - Public key: {os.getenv('LANGFUSE_PUBLIC_KEY')[:20]}...")
        print(f"  - Base URL: {os.getenv('LANGFUSE_BASE_URL', 'https://cloud.langfuse.com')}")
    print()

    # Create trace context
    trace_context = LLMTraceContext(
        run_id="test-observability-001",
        session_name="observability-test",
        stage="test",
        state="test",
        prompt_name="simple_test",
        extra={"test_type": "integration"},
    )

    # Create Anthropic client
    client = get_anthropic_client()
    if not client:
        print("Error: Could not create Anthropic client. Check ANTHROPIC_API_KEY.")
        return False

    # Make a simple LLM call with small max_tokens to avoid streaming warning
    print("Making test LLM call...")
    result = call_llm_parse(
        client=client,
        prompt="What is 2 + 2? Respond with just the answer and your confidence level.",
        response_format=SimpleResponse,
        system="You are a helpful math assistant. Respond concisely.",
        trace_context=trace_context,
        max_tokens=1024,  # Small value for quick test
    )

    if result:
        print(f"Response: {result.answer}")
        print(f"Confidence: {result.confidence}")
        print()
        print("LLM call succeeded!")
    else:
        print("Error: LLM call failed.")
        return False

    # Flush Langfuse to ensure all events are sent
    print("Flushing Langfuse events...")
    flush_langfuse()
    print()

    print("Test complete!")
    print("Check your Langfuse dashboard to verify the trace was recorded:")
    print(f"  https://us.cloud.langfuse.com")
    print()
    print("Look for:")
    print(f"  - Session: observability-test")
    print(f"  - Run ID: test-observability-001")

    return True


if __name__ == "__main__":
    success = test_observability()
    sys.exit(0 if success else 1)
