"""
Web search utilities for Tier 3.

Handles Claude's web_search tool configuration, response extraction,
and citation formatting.
"""

from dataclasses import dataclass
from typing import Optional, Any

from ..models.context import ContextEntryLLM
from ..config import STATE_LOCATIONS, MAX_WEB_SEARCHES_PER_REQUEST


# =============================================================================
# WEB SEARCH TOOL CONFIGURATION
# =============================================================================


def get_web_search_tool(state: str = "NJ", max_uses: Optional[int] = None) -> dict:
    """
    Get web search tool configuration with state-specific location.

    The user_location parameter localizes search results to the relevant state,
    improving relevance for state-specific regulatory research.

    Args:
        state: Two-letter state code (default "NJ" for New Jersey)
        max_uses: Maximum number of searches per request (cost control).
                  Defaults to MAX_WEB_SEARCHES_PER_REQUEST from config.

    Returns:
        Web search tool configuration dict
    """
    # Use centralized config for default max_uses
    if max_uses is None:
        max_uses = MAX_WEB_SEARCHES_PER_REQUEST

    # Use centralized STATE_LOCATIONS from config
    location = STATE_LOCATIONS.get(state.upper())
    if location is None:
        print(f"  Warning: Unknown state '{state}' for web search, defaulting to NJ")
        location = STATE_LOCATIONS["NJ"]

    return {
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": max_uses,
        "user_location": {
            "type": "approximate",
            **location,
        },
    }


# Legacy constant for backward compatibility
WEB_SEARCH_TOOL = get_web_search_tool("NJ", MAX_WEB_SEARCHES_PER_REQUEST)


# =============================================================================
# WEB SEARCH RESPONSE DATACLASSES
# =============================================================================


@dataclass
class WebSearchCitation:
    """A citation extracted from Claude's text response with web search."""
    cited_text: str  # Actual quoted text from the source (up to 150 chars)
    url: str
    title: str


@dataclass
class WebSearchResult:
    """A single web search result (from web_search_tool_result block)."""
    title: str
    url: str
    snippet: Optional[str] = None  # For backward compatibility with tests
    page_age: Optional[str] = None
    # Note: encrypted_content is not accessible in production - use citations instead


@dataclass
class WebSearchQuery:
    """A web search query and its results."""
    query: str
    results: list[WebSearchResult]


@dataclass
class WebSearchResponse:
    """Complete web search response with text, citations, and metadata."""
    text: str  # Claude's synthesized response (or JSON string for structured outputs)
    citations: list[WebSearchCitation]  # Cited text from sources
    queries: list[WebSearchQuery]  # Search queries executed
    usage: dict  # Token usage info
    json_data: dict | None = None  # V5.1: Direct JSON from structured outputs


# =============================================================================
# RESPONSE EXTRACTION
# =============================================================================


def extract_web_search_response(response: Any) -> WebSearchResponse:
    """
    Extract complete web search response including citations from text blocks.

    Claude's web_search response contains:
    1. server_tool_use blocks - search queries Claude issued
    2. web_search_tool_result blocks - search results (encrypted_content)
    3. text blocks with citations - Claude's response WITH cited_text

    The key insight: actual quoted text is in the citations array of text blocks,
    NOT in the encrypted web_search_tool_result blocks.

    Args:
        response: Anthropic API response from messages.create()

    Returns:
        WebSearchResponse with text, citations, queries, and usage
    """
    text_parts = []
    citations = []
    queries = []
    query_map = {}  # Map tool_use_id to query string
    json_data = None  # V5.1: Capture JSON from structured outputs

    # First pass: collect queries from server_tool_use blocks
    for block in response.content:
        if getattr(block, 'type', None) == 'server_tool_use':
            tool_use_id = getattr(block, 'id', None)
            input_data = getattr(block, 'input', {})
            query = input_data.get('query', '')
            if tool_use_id and query:
                query_map[tool_use_id] = query

    # Second pass: collect results and text with citations
    for block in response.content:
        block_type = getattr(block, 'type', None)

        # Collect search result metadata (titles/URLs only - content is encrypted)
        if block_type == 'web_search_tool_result':
            tool_use_id = getattr(block, 'tool_use_id', None)
            query = query_map.get(tool_use_id, 'unknown query')

            results = []
            content_items = getattr(block, 'content', [])
            for item in content_items:
                if getattr(item, 'type', None) == 'web_search_result':
                    results.append(WebSearchResult(
                        title=getattr(item, 'title', ''),
                        url=getattr(item, 'url', ''),
                        page_age=getattr(item, 'page_age', None),
                    ))

            queries.append(WebSearchQuery(query=query, results=results))

        # Extract text AND citations from text blocks
        elif block_type == 'text':
            # Get the synthesized text
            text_content = getattr(block, 'text', '')
            if text_content:
                text_parts.append(text_content)

            # Extract citations - THIS is where the actual quoted text lives
            block_citations = getattr(block, 'citations', None) or []
            for citation in block_citations:
                citation_type = getattr(citation, 'type', '')
                if citation_type == 'web_search_result_location':
                    cited_text = getattr(citation, 'cited_text', '')
                    url = getattr(citation, 'url', '')
                    title = getattr(citation, 'title', '')

                    if cited_text:  # Only add if we have actual text
                        citations.append(WebSearchCitation(
                            cited_text=cited_text,
                            url=url,
                            title=title,
                        ))

        # V5.1: Handle JSON blocks from structured outputs
        # When using output_format with tools, Claude returns a json block
        # instead of (or in addition to) text blocks
        elif block_type == 'json':
            import json as json_module
            # The json block contains the structured data
            block_json = getattr(block, 'json', None)
            if block_json:
                # Capture the raw JSON data for direct use
                if isinstance(block_json, dict):
                    json_data = block_json
                    text_parts.append(json_module.dumps(block_json))
                else:
                    text_parts.append(str(block_json))

        # Extract tool_use blocks (e.g., submit_analysis for structured output)
        elif block_type == 'tool_use':
            tool_name = getattr(block, 'name', '')
            tool_input = getattr(block, 'input', None)
            if tool_name == 'submit_analysis' and isinstance(tool_input, dict):
                json_data = tool_input

    # Extract usage info (gracefully handle missing usage attribute for mocks/tests)
    response_usage = getattr(response, 'usage', None)
    if response_usage:
        usage = {
            "input_tokens": getattr(response_usage, "input_tokens", 0),
            "output_tokens": getattr(response_usage, "output_tokens", 0),
            "cache_read_tokens": getattr(response_usage, "cache_read_input_tokens", 0),
            "cache_write_tokens": getattr(response_usage, "cache_creation_input_tokens", 0),
        }
    else:
        usage = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
        }

    return WebSearchResponse(
        text="\n\n".join(text_parts),
        citations=citations,
        queries=queries,
        usage=usage,
        json_data=json_data,  # V5.1: Direct JSON for structured outputs
    )


def format_citations_for_evidence(citations: list[WebSearchCitation]) -> list[ContextEntryLLM]:
    """
    Convert web search citations to ContextEntryLLM format for Tier 3 output.

    Args:
        citations: List of WebSearchCitation from extract_web_search_response()

    Returns:
        List of ContextEntryLLM objects for the context_used field
    """
    entries = []
    for citation in citations:
        entries.append(ContextEntryLLM(
            type="web",
            identifier=citation.url,
            quote=citation.cited_text,
            relevance=f"Source: {citation.title}",
        ))
    return entries


# Legacy function for backward compatibility
def extract_web_search_results(response: Any) -> list[WebSearchQuery]:
    """
    Legacy function - extracts only query/result metadata.

    For full citation extraction including cited_text, use extract_web_search_response().
    """
    full_response = extract_web_search_response(response)
    return full_response.queries


def format_web_results_for_prompt(web_results: list[WebSearchQuery]) -> str:
    """
    Format web search results for inclusion in the Tier 3 analysis prompt.

    Note: This formats metadata only. For actual quoted content, use
    the citations from extract_web_search_response().

    Args:
        web_results: List of WebSearchQuery objects

    Returns:
        Formatted string showing search queries and result URLs
    """
    if not web_results:
        return "(No web search results available)"

    parts = []
    for search in web_results:
        parts.append(f"## Search Query: \"{search.query}\"")
        parts.append("")

        if not search.results:
            parts.append("(No results found for this query)")
            parts.append("")
            continue

        for i, result in enumerate(search.results[:5], 1):  # Top 5 per query
            parts.append(f"### Result {i}: {result.title}")
            parts.append(f"**URL:** {result.url}")
            if result.page_age:
                parts.append(f"**Age:** {result.page_age}")
            parts.append("")

    return "\n".join(parts)
