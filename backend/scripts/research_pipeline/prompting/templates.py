"""
Prompt templates for the research pipeline.

Contains hardcoded prompt strings that can't be loaded from YAML,
such as the JSON instruction for Tier 3 which requires structured
output guidance when using tools (which don't support response_format).

Most prompts are loaded from YAML via prompt_loader.py. This module
only contains templates that need to be embedded in code.
"""

from typing import Any


# =============================================================================
# TIER 3 JSON INSTRUCTION
# =============================================================================

# This instruction is appended to Tier 3 prompts because we can't use
# response_format with tools (like web_search). Claude must output
# valid JSON in its text response.

TIER3_JSON_INSTRUCTION = """

IMPORTANT: After performing web searches and analyzing the results, you MUST output your final assessment as valid JSON matching this EXACT schema. Output ONLY the JSON block, no other text:

```json
{
  "classification": "unrelated" | "justified" | "burdensome",
  "confidence": 0.0-1.0,
  "reasoning": "string explaining your classification",
  "final_severity": 1-10 or null,
  "severity_adjustment": -3 to +3 or null,
  "argument_for_regulation": "string",
  "argument_against_regulation": "string",
  "web_search_summary": "brief summary of what web search revealed",
  "verbatim_requirements": ["requirement text from regulation"],
  "superseded_by_law": {
    "value": true|false,
    "scope": "reg-specific" or "issue-type/domain",
    "reason": "explanation",
    "evidence": [{"type": "web", "identifier": "https://example.gov/...", "quote": "relevant quote", "relevance": "why this matters"}]
  },
  "federal_mandate_confirmed": {
    "value": true|false,
    "scope": "reg-specific" or "issue-type/domain",
    "reason": "explanation",
    "evidence": [{"type": "web", "identifier": "https://...", "quote": "...", "relevance": "..."}]
  },
  "state_discretion_found": {
    "value": true|false,
    "scope": "reg-specific" or "issue-type/domain",
    "reason": "explanation",
    "evidence": [{"type": "web", "identifier": "https://...", "quote": "...", "relevance": "..."}]
  },
  "modernized_alternative_found": {
    "value": true|false,
    "scope": "reg-specific" or "issue-type/domain",
    "reason": "explanation",
    "evidence": [{"type": "web", "identifier": "https://...", "quote": "...", "relevance": "..."}]
  },
  "evidence_gap": true|false,
  "federal_mandate_found": true|false,
  "state_has_discretion": true|false,
  "context_used": [{"type": "web", "identifier": "https://full-url", "quote": "actual quote from source", "relevance": "how it affects analysis"}]
}
```

CRITICAL: Each evidence item MUST have exactly these 4 fields: "type" (always "web"), "identifier" (the full URL), "quote" (text from source), "relevance" (why it matters). Do NOT use "url" or "source_type" - use "type" and "identifier" instead."""


def build_tier3_prompt_with_json_instruction(
    base_prompt: str,
) -> str:
    """
    Build a complete Tier 3 prompt by appending JSON instruction.

    Since Tier 3 uses tools (web_search), we can't use response_format.
    Instead, we instruct Claude to output JSON in its text response.

    Args:
        base_prompt: The base prompt from format_tier_prompt()

    Returns:
        Complete prompt with JSON instruction appended
    """
    return base_prompt + TIER3_JSON_INSTRUCTION
