"""
Context registry for tracking and deduplicating context items.

The ContextRegistry class manages all context items used during analysis,
ensuring:
1. Deduplication - same document is only included once even if it appears
   in multiple roles (e.g., sibling AND cross-reference target)
2. Audit trail - tracks what context was used and from where
3. Tier-appropriate rendering - shows catalog in Tier 1, summaries in Tier 2,
   full text in Tier 3
"""

from dataclasses import dataclass, field
from typing import Literal, Optional
import hashlib

from scripts.research_pipeline.models.context import ContextEntryDB


# Type aliases
ContextType = Literal["self", "hierarchy", "sibling", "definition", "cross_reference", "statute", "web"]
ContentLevel = Literal["catalog", "summary", "full_text"]


@dataclass
class ContextItem:
    """
    Internal representation of a context item in the registry.
    """
    context_type: ContextType
    identifier: str  # Citation for docs, term for definitions
    document_id: Optional[int] = None  # None for web sources
    content: str = ""
    content_level: ContentLevel = "catalog"
    summary: Optional[str] = None
    # Track if this item appears in multiple roles
    also_appears_as: list[ContextType] = field(default_factory=list)
    # For definitions
    is_cross_reference: bool = False
    # Relevance (set when LLM uses this context)
    relevance: Optional[str] = None
    quote: Optional[str] = None  # Verbatim quote from this context
    # Statute/web specific
    is_mandate: Optional[bool] = None
    state_discretion: Optional[Literal["none", "partial", "full"]] = None
    # Web specific
    url: Optional[str] = None
    title: Optional[str] = None
    source_type: Optional[Literal["advocacy", "journalism", "academic", "government"]] = None
    publication_date: Optional[str] = None

    def content_hash(self) -> str:
        """Generate a hash of the content for verification."""
        if self.content:
            return hashlib.md5(self.content.encode()).hexdigest()[:8]
        return ""


class ContextRegistry:
    """
    Tracks and deduplicates context items across tiers.

    Handles dual-role documents (e.g., a section that's both a sibling
    and a cross-reference target) by recording secondary roles in
    also_appears_as.

    Usage:
        registry = ContextRegistry()

        # Add sibling sections (from context catalog)
        for sibling in context_catalog.sibling_sections:
            registry.add_context(
                context_type="sibling",
                identifier=sibling.citation,
                document_id=sibling_doc_id,  # if available
            )

        # When Tier 2 uses a context item, update its relevance
        registry.mark_used("N.J.A.C. 1:1-1.1", "Provides exemption criteria")

        # Export for database storage
        context_used = registry.to_context_used()
    """

    def __init__(self):
        self.items: list[ContextItem] = []
        self.seen_doc_ids: set[int] = set()
        self.seen_identifiers: set[str] = set()  # Normalized identifiers
        self._id_to_item: dict[str, ContextItem] = {}  # normalized_id -> item

    def _normalize_id(self, identifier: str) -> str:
        """Normalize identifier for consistent matching (case-insensitive)."""
        return identifier.lower().strip()

    def add_context(
        self,
        context_type: ContextType,
        identifier: str,
        document_id: Optional[int] = None,
        content: str = "",
        content_level: ContentLevel = "catalog",
        summary: Optional[str] = None,
        **extra_fields,
    ) -> bool:
        """
        Add a context item if not already seen.

        If the same document_id or identifier already exists but under a
        different context_type, records this as an additional role.

        Args:
            context_type: Type of context (sibling, cross_reference, etc.)
            identifier: Citation for documents, term for definitions
            document_id: ID from regulatory_documents (None for web)
            content: The content text (empty for catalog level)
            content_level: What detail level we have (catalog/summary/full_text)
            summary: Summary text (for summary level)
            **extra_fields: Additional fields like is_mandate, url, etc.

        Returns:
            True if new item was added, False if deduplicated
        """
        # Normalize identifier for consistent matching
        normalized = self._normalize_id(identifier)

        # Check if we already have this item
        existing = self._id_to_item.get(normalized)

        if existing:
            # Same identifier, possibly different role
            if context_type not in [existing.context_type] + existing.also_appears_as:
                existing.also_appears_as.append(context_type)
            # Upgrade content if we have more detail
            if content_level == "full_text" and existing.content_level != "full_text":
                existing.content = content
                existing.content_level = content_level
            elif content_level == "summary" and existing.content_level == "catalog":
                existing.content = content
                existing.content_level = content_level
                if summary:
                    existing.summary = summary
            return False

        # Also check by document_id if provided
        if document_id and document_id in self.seen_doc_ids:
            # Find the existing item with this doc_id
            for item in self.items:
                if item.document_id == document_id:
                    if context_type not in [item.context_type] + item.also_appears_as:
                        item.also_appears_as.append(context_type)
                    # Also register this identifier as an alias (normalized)
                    self._id_to_item[normalized] = item
                    self.seen_identifiers.add(normalized)
                    return False

        # New item - store original identifier, use normalized for lookup
        item = ContextItem(
            context_type=context_type,
            identifier=identifier,  # Keep original for output
            document_id=document_id,
            content=content,
            content_level=content_level,
            summary=summary,
            is_mandate=extra_fields.get("is_mandate"),
            state_discretion=extra_fields.get("state_discretion"),
            url=extra_fields.get("url"),
            title=extra_fields.get("title"),
            source_type=extra_fields.get("source_type"),
            publication_date=extra_fields.get("publication_date"),
        )

        self.items.append(item)
        self._id_to_item[normalized] = item  # Use normalized key
        self.seen_identifiers.add(normalized)
        if document_id:
            self.seen_doc_ids.add(document_id)

        return True

    def mark_used(
        self,
        identifier: str,
        relevance: str,
        quote: Optional[str] = None,
        is_mandate: Optional[bool] = None,
        state_discretion: Optional[Literal["none", "partial", "full"]] = None,
    ) -> bool:
        """
        Mark a context item as used in the analysis with relevance info.

        Called when the LLM cites a context item in its analysis.
        Uses normalized identifier for case-insensitive matching.

        Args:
            identifier: Citation or term that was used
            relevance: How this context affected the analysis
            quote: Optional verbatim quote from the context
            is_mandate: For statute/web - does this mandate the requirement?
            state_discretion: For statute/web - how much discretion?

        Returns:
            True if item was found and marked, False otherwise
        """
        normalized = self._normalize_id(identifier)
        item = self._id_to_item.get(normalized)
        if item:
            item.relevance = relevance
            if quote is not None:
                item.quote = quote
            if is_mandate is not None:
                item.is_mandate = is_mandate
            if state_discretion is not None:
                item.state_discretion = state_discretion
            return True
        return False

    def upgrade_content(
        self,
        identifier: str,
        content: str,
        content_level: ContentLevel,
        summary: Optional[str] = None,
    ) -> bool:
        """
        Upgrade an existing item's content level (e.g., from catalog to summary).

        Args:
            identifier: Citation or term
            content: New content text
            content_level: New content level
            summary: Summary text if applicable

        Returns:
            True if upgraded, False if not found
        """
        normalized = self._normalize_id(identifier)
        item = self._id_to_item.get(normalized)
        if item:
            # Only upgrade, never downgrade
            level_order = {"catalog": 0, "summary": 1, "full_text": 2}
            if level_order[content_level] > level_order[item.content_level]:
                item.content = content
                item.content_level = content_level
                if summary:
                    item.summary = summary
                return True
        return False

    def get_item(self, identifier: str) -> Optional[ContextItem]:
        """Get a context item by identifier (case-insensitive)."""
        normalized = self._normalize_id(identifier)
        return self._id_to_item.get(normalized)

    def get_items_by_type(self, context_type: ContextType) -> list[ContextItem]:
        """Get all items of a specific type."""
        return [
            item for item in self.items
            if item.context_type == context_type
            or context_type in item.also_appears_as
        ]

    def get_used_items(self) -> list[ContextItem]:
        """Get only items that were marked as used (have relevance set)."""
        return [item for item in self.items if item.relevance]

    def render_for_tier(self, tier: int) -> str:
        """
        Render context for a specific tier level.

        Tier 1: Catalog only (just lists what's available)
        Tier 2: Summaries + definitions
        Tier 3: Full text for requested items

        Args:
            tier: Tier number (1, 2, or 3)

        Returns:
            Formatted string with context appropriate for the tier
        """
        if tier == 1:
            return self._render_catalog()
        elif tier == 2:
            return self._render_summaries()
        else:  # tier 3+
            return self._render_full_text()

    def _render_catalog(self) -> str:
        """Render catalog view (Tier 1) - metadata only, no content."""
        sections = []

        # Group by type
        siblings = [i for i in self.items if i.context_type == "sibling"]
        crossrefs = [i for i in self.items if i.context_type == "cross_reference"]
        definitions = [i for i in self.items if i.context_type == "definition"]
        hierarchy = [i for i in self.items if i.context_type == "hierarchy"]

        if siblings:
            lines = ["## Sibling Sections"]
            for item in siblings:
                roles = [item.context_type] + item.also_appears_as
                role_note = f" (also: {', '.join(item.also_appears_as)})" if item.also_appears_as else ""
                lines.append(f"- {item.identifier}{role_note}")
            sections.append("\n".join(lines))

        if crossrefs:
            lines = ["## Cross-References"]
            for item in crossrefs:
                role_note = f" (also: {', '.join(item.also_appears_as)})" if item.also_appears_as else ""
                lines.append(f"- {item.identifier}{role_note}")
            sections.append("\n".join(lines))

        if definitions:
            lines = ["## Available Definitions"]
            for item in definitions:
                lines.append(f"- {item.identifier}")
            sections.append("\n".join(lines))

        if hierarchy:
            lines = ["## Ancestor Chain"]
            for item in hierarchy:
                lines.append(f"- {item.identifier}")
            sections.append("\n".join(lines))

        return "\n\n".join(sections) if sections else "No context available."

    def _render_summaries(self) -> str:
        """Render summary view (Tier 2) - includes summaries and definitions."""
        sections = []

        for item in self.items:
            if item.content_level in ("summary", "full_text") and item.content:
                header = f"### {item.context_type.replace('_', ' ').title()}: {item.identifier}"
                if item.also_appears_as:
                    header += f" (also: {', '.join(item.also_appears_as)})"
                sections.append(f"{header}\n{item.summary or item.content}")

        return "\n\n".join(sections) if sections else "No summaries available."

    def _render_full_text(self) -> str:
        """Render full text view (Tier 3) - includes full content where available."""
        sections = []

        for item in self.items:
            if item.content_level == "full_text" and item.content:
                header = f"### {item.context_type.replace('_', ' ').title()}: {item.identifier}"
                sections.append(f"{header}\n{item.content}")
            elif item.content:
                # Fall back to summary if no full text
                header = f"### {item.context_type.replace('_', ' ').title()}: {item.identifier} (summary)"
                sections.append(f"{header}\n{item.content}")

        return "\n\n".join(sections) if sections else "No full text available."

    def to_context_used(self) -> list[dict]:
        """
        Export as JSON-serializable list for storage in context_used column.

        Only includes items that were actually used (have relevance set).
        Format matches ContextEntryDB schema.

        Returns:
            List of dicts matching the context_used JSONB column format
        """
        used_items = self.get_used_items()
        if not used_items:
            return []

        result = []
        for item in used_items:
            # Use camelCase keys to match frontend TypeScript interface
            entry = {
                "type": item.context_type,
                "identifier": item.identifier,
                "relevance": item.relevance or "",
            }

            if item.document_id:
                entry["sourceId"] = item.document_id

            if item.quote:
                entry["quote"] = item.quote

            if item.summary:
                entry["summary"] = item.summary

            # Content hash for verification (not full content)
            if item.content:
                entry["contentHash"] = item.content_hash()

            # Type-specific fields (camelCase)
            if item.is_mandate is not None:
                entry["isMandate"] = item.is_mandate
            if item.state_discretion:
                entry["stateDiscretion"] = item.state_discretion

            # Web-specific fields (camelCase)
            if item.url:
                entry["url"] = item.url
            if item.title:
                entry["title"] = item.title
            if item.source_type:
                entry["sourceType"] = item.source_type
            if item.publication_date:
                entry["publicationDate"] = item.publication_date

            result.append(entry)

        return result

    def to_context_entry_db_list(self) -> list[ContextEntryDB]:
        """
        Export as list of ContextEntryDB Pydantic models.

        Useful for type-checked access to context entries.
        """
        return [
            ContextEntryDB(
                type=item.context_type,
                identifier=item.identifier,
                source_id=item.document_id,
                summary=item.summary,
                relevance=item.relevance or "",
                is_mandate=item.is_mandate,
                state_discretion=item.state_discretion,
                url=item.url,
                title=item.title,
                source_type=item.source_type,
                publication_date=item.publication_date,
            )
            for item in self.get_used_items()
        ]

    def __len__(self) -> int:
        return len(self.items)

    def __repr__(self) -> str:
        return f"ContextRegistry({len(self.items)} items, {len(self.get_used_items())} used)"
