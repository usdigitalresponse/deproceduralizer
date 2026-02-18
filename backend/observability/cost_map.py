"""
Cost calculation for Anthropic models.

Pricing as of January 2025. Update when pricing changes.
"""

from typing import Dict

# Anthropic pricing per 1M tokens (input, output)
# Source: https://www.anthropic.com/pricing
ANTHROPIC_PRICING: Dict[str, Dict[str, float]] = {
    # Claude 4.5 models (latest)
    "claude-opus-4-5-20251101": {
        "input": 15.00,
        "output": 75.00,
        "cache_read": 1.50,  # 90% discount for cached input
        "cache_write": 18.75,  # 25% premium for cache writes
    },
    "claude-sonnet-4-5-20250929": {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_write": 3.75,
    },
    "claude-sonnet-4-6": {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_write": 3.75,
    },
    "claude-haiku-4-5-20251001": {
        "input": 0.80,
        "output": 4.00,
        "cache_read": 0.08,
        "cache_write": 1.00,
    },
    # Legacy Claude 3.5 models
    "claude-3-5-sonnet-20241022": {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_write": 3.75,
    },
    "claude-3-5-haiku-20241022": {
        "input": 0.80,
        "output": 4.00,
        "cache_read": 0.08,
        "cache_write": 1.00,
    },
    # Legacy Claude 3 models
    "claude-3-opus-20240229": {
        "input": 15.00,
        "output": 75.00,
        "cache_read": 1.50,
        "cache_write": 18.75,
    },
    "claude-3-sonnet-20240229": {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_write": 3.75,
    },
    "claude-3-haiku-20240307": {
        "input": 0.25,
        "output": 1.25,
        "cache_read": 0.03,
        "cache_write": 0.30,
    },
}

# Aliases for common model names
MODEL_ALIASES = {
    "claude-haiku-4.5": "claude-haiku-4-5-20251001",
    "claude-sonnet-4.5": "claude-sonnet-4-5-20250929",
    "claude-sonnet-4.6": "claude-sonnet-4-6",
    "claude-opus-4.5": "claude-opus-4-5-20251101",
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> float:
    """
    Calculate cost for an LLM call.

    Args:
        model: Model name (e.g., "claude-haiku-4-5-20251001")
        input_tokens: Number of input tokens (excluding cache)
        output_tokens: Number of output tokens
        cache_read_tokens: Number of tokens read from cache
        cache_write_tokens: Number of tokens written to cache

    Returns:
        Cost in USD

    Example:
        >>> calculate_cost("claude-haiku-4-5-20251001", 1000, 500)
        0.0028  # $0.80/1M input + $4.00/1M output
    """
    # Resolve alias if present
    if model in MODEL_ALIASES:
        model = MODEL_ALIASES[model]

    # Get pricing, default to haiku if unknown
    pricing = ANTHROPIC_PRICING.get(model, ANTHROPIC_PRICING["claude-haiku-4-5-20251001"])

    # Calculate cost (pricing is per 1M tokens)
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    cache_read_cost = (cache_read_tokens / 1_000_000) * pricing.get("cache_read", pricing["input"] * 0.1)
    cache_write_cost = (cache_write_tokens / 1_000_000) * pricing.get("cache_write", pricing["input"] * 1.25)

    return input_cost + output_cost + cache_read_cost + cache_write_cost


def get_model_pricing(model: str) -> Dict[str, float]:
    """Get pricing info for a model."""
    if model in MODEL_ALIASES:
        model = MODEL_ALIASES[model]
    return ANTHROPIC_PRICING.get(model, ANTHROPIC_PRICING["claude-haiku-4-5-20251001"])
