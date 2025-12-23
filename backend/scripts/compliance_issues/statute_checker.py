"""
Generic statute checker for compliance issue detection.

Handles statute lookup for states that have statute data available.
Decoupled from state - can be used with any StateConfig that has
statute_file and statute_pattern configured.
"""

import json
import re
from pathlib import Path
from typing import Optional

from .config import StateConfig


class StatuteChecker:
    """
    Check and retrieve statute information for a given state.

    This class is state-agnostic - it works with any StateConfig
    that has statute data configured.

    Usage:
        checker = StatuteChecker(state_config)
        if checker.is_available():
            refs = checker.extract_references(regulation_content)
            context = checker.get_statute_context(refs)
    """

    def __init__(self, state_config: StateConfig):
        """
        Initialize statute checker for a state.

        Args:
            state_config: State configuration with statute_file and statute_pattern
        """
        self.state_config = state_config
        self.statute_citations: set[str] = set()
        self.statutes_by_citation: dict[str, dict] = {}
        self._loaded = False

        # Only load if statute data is configured
        if state_config.statute_file and state_config.statute_pattern:
            self._load_statutes()

    def _load_statutes(self) -> None:
        """Load statute data from file."""
        if not self.state_config.statute_file:
            return

        statute_file = self.state_config.statute_file
        if not statute_file.exists():
            print(f"Warning: Statute file not found at {statute_file}")
            return

        try:
            with open(statute_file, 'r') as f:
                statutes = json.load(f)

            self.statute_citations = {s['citation'] for s in statutes}
            self.statutes_by_citation = {s['citation']: s for s in statutes}
            self._loaded = True
            print(f"Loaded {len(self.statute_citations)} {self.state_config.state_code} statutes")

        except Exception as e:
            print(f"Error loading statutes: {e}")

    def is_available(self) -> bool:
        """Check if statute lookup is available."""
        return self._loaded and len(self.statutes_by_citation) > 0

    def get_statute_text(self, citation: str) -> Optional[dict]:
        """
        Get statute text and metadata for a citation.

        Tries exact match first, then fallback strategies:
        - Strip trailing letter (subsection like 5.1b -> 5.1)
        - Strip decimal portion (5.1 -> 5)

        Args:
            citation: Statute citation (e.g., "30:4D-6.1")

        Returns:
            Dict with statute data, or None if not found
        """
        if not self.is_available():
            return None

        # Exact match
        if citation in self.statutes_by_citation:
            return self.statutes_by_citation[citation]

        # Try stripping trailing letter (subsection like 5.1b -> 5.1)
        base = re.sub(r'[a-z]$', '', citation)
        if base in self.statutes_by_citation:
            return self.statutes_by_citation[base]

        # Try stripping decimal portion (5.1 -> 5)
        base2 = re.sub(r'\.\d+[a-z]?$', '', citation)
        if base2 in self.statutes_by_citation:
            return self.statutes_by_citation[base2]

        return None

    def extract_references(self, content: str) -> list[str]:
        """
        Extract all statute references from content.

        Args:
            content: Regulation text to search

        Returns:
            List of unique statute citations found
        """
        if not self.state_config.statute_pattern:
            return []

        refs = []
        for match in self.state_config.statute_pattern.finditer(content):
            # Build citation from match groups
            # Pattern should have groups for title, chapter, section
            groups = match.groups()
            if len(groups) >= 3:
                citation = f"{groups[0]}:{groups[1]}-{groups[2]}"
                refs.append(citation)

        return list(set(refs))

    def get_statute_context(
        self,
        citations: list[str],
        max_statutes: int = 5,
        max_length_per_statute: int = 2000,
    ) -> str:
        """
        Build context string with statute text for LLM prompt.

        Args:
            citations: List of statute citations to look up
            max_statutes: Maximum number of statutes to include
            max_length_per_statute: Max characters per statute text

        Returns:
            Formatted string with statute text, or empty string if none found
        """
        if not self.is_available() or not citations:
            return ""

        context_parts = []
        found_count = 0

        # Check more citations in case some are missing
        for citation in citations[:max_statutes * 2]:
            if found_count >= max_statutes:
                break

            statute = self.get_statute_text(citation)
            if statute:
                found_count += 1
                content = statute.get('content', '')[:max_length_per_statute]
                prefix = self.state_config.statute_citation_prefix or 'Statute'

                # Get section name if available (field names vary by state)
                section_name = (
                    statute.get('njsa_section_name') or
                    statute.get('section_name') or
                    statute.get('title') or
                    'Unknown'
                )

                context_parts.append(
                    f"{prefix} {citation} - {section_name}:\n{content}"
                )

        if not context_parts:
            return ""

        return "\n\n---\n\n".join(context_parts)


class NoOpStatuteChecker:
    """
    A no-op statute checker for when statute lookup is disabled.

    Provides the same interface as StatuteChecker but returns empty results.
    Used when --skip-statutes flag is passed or state has no statute data.
    """

    def __init__(self, state_config: StateConfig = None):
        """Initialize no-op checker."""
        self.state_config = state_config

    def is_available(self) -> bool:
        """Always returns False."""
        return False

    def get_statute_text(self, citation: str) -> None:
        """Always returns None."""
        return None

    def extract_references(self, content: str) -> list[str]:
        """Always returns empty list."""
        return []

    def get_statute_context(
        self,
        citations: list[str],
        max_statutes: int = 5,
        max_length_per_statute: int = 2000,
    ) -> str:
        """Always returns empty string."""
        return ""


def create_statute_checker(
    state_config: StateConfig,
    with_statutes: bool = True,
) -> StatuteChecker | NoOpStatuteChecker:
    """
    Factory function to create the appropriate statute checker.

    Args:
        state_config: State configuration
        with_statutes: Whether to enable statute lookup

    Returns:
        StatuteChecker if enabled and data available, else NoOpStatuteChecker
    """
    if not with_statutes:
        print("Statute lookup disabled (--skip-statutes)")
        return NoOpStatuteChecker(state_config)

    if not state_config.has_statute_data():
        print(f"No statute data available for {state_config.state_code}")
        return NoOpStatuteChecker(state_config)

    return StatuteChecker(state_config)
