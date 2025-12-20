# Definitions - Future Enhancements

This document outlines potential future improvements to the definitions visualization and management features.

## Priority 1: Core Improvements

### Definition Review Pipeline

Similar to the red flags and compliance issues review system, create a workflow for reviewing extracted definitions:

- **Review statuses**: unreviewed, confirmed, incorrect, needs_context
- **Quality indicators**: Use `definition_overlap` score as initial quality signal
- **Reviewer notes**: Allow reviewers to add context or corrections
- **Bulk actions**: Confirm/reject multiple definitions at once
- **Filter by quality**: Surface low-overlap definitions for review

Database additions needed:
```sql
ALTER TABLE definitions ADD COLUMN review_status VARCHAR(50) DEFAULT 'unreviewed';
ALTER TABLE definitions ADD COLUMN reviewed_by VARCHAR(255);
ALTER TABLE definitions ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE definitions ADD COLUMN reviewer_notes TEXT;
```

### Term Highlighting in Regulation Text

Highlight defined terms within the regulation content:

- Detect when defined terms appear in regulation text
- Apply subtle highlighting (e.g., dotted underline, background color)
- Link highlighted terms to their definitions
- Consider performance implications for long regulations

### Tooltip Definitions on Hover

Show definition previews on hover:

- Hovering over a highlighted term shows a tooltip with the definition
- Include scope badge in tooltip
- "See more" link to full definition in glossary
- Keyboard accessible (focus states)

## Priority 2: Enhanced Discovery

### Cross-Reference Detection

Identify related definitions:

- Terms that reference other terms in their definitions
- Same term with different definitions across regulations
- Synonyms or related terminology

### Full-Text Search with PostgreSQL

Improve search capabilities:

```sql
-- Add full-text search index
CREATE INDEX idx_definitions_search ON definitions USING GIN (to_tsvector('english', term || ' ' || definition));
```

- Faster search performance
- Fuzzy matching
- Phrase search
- Relevance ranking

### Definition Usage Analysis

Track how terms are used across regulations:

- Count occurrences of defined terms in regulation text
- Identify regulations that use terms but lack definitions
- Surface commonly used but undefined terminology

## Priority 3: Quality & Accuracy

### Definition Conflict Detection

Find same term, different definitions:

```sql
-- Find conflicting definitions
SELECT term, COUNT(DISTINCT definition) as def_count
FROM definitions
GROUP BY LOWER(term)
HAVING COUNT(DISTINCT definition) > 1
ORDER BY def_count DESC;
```

- Flag terms with multiple distinct definitions
- Show scope context for each variant
- Allow reviewers to mark as "intentionally different" vs "conflict"

### Improved Overlap Calculation

Enhance the `definition_overlap` metric:

- Weight by term importance (TF-IDF)
- Consider semantic similarity (embeddings)
- Handle paraphrasing better
- Track extraction confidence separately

### Source Context Preservation

Store more context about where definitions came from:

- Surrounding paragraph text
- Section/subsection headers
- Footnotes or annotations
- Links to related statutory definitions

## Priority 4: State Expansion

### NJ Definition Extraction

Currently all 4,357 definitions are from NY. Extend to NJ:

- Extract definitions from NJAC regulations
- Handle NJAC-specific citation formats
- Populate `url` field for document linking
- Run document_id migration after import

### Cross-State Comparison

Compare definitions between states:

- Same term, different state definitions
- Identify common vs unique terminology
- Support multi-state regulation comparison view

## Priority 5: Integration

### Definition API

Expose definitions via API for external tools:

- REST endpoints for term lookup
- Batch lookup for multiple terms
- Integration with document editing tools
- API for definition suggestions

### Export Capabilities

Allow data export:

- CSV/JSON export of all definitions
- Filtered exports (by scope, quality, state)
- Integration with regulatory compliance tools

## Implementation Notes

### Database Considerations

- Consider partitioning definitions by state if data grows significantly
- Add indexes for common query patterns
- Monitor query performance on glossary page

### Frontend Patterns

When implementing these features, follow existing patterns:

- Use `ActionResult<T>` for server actions
- Follow `ComplianceIssuesList` pattern for review UI
- Use existing `Badge`, `Card`, `Alert` components
- Update `STYLE_GUIDE.md` with new components

### Testing Considerations

- Unit tests for definition matching logic
- Integration tests for review workflow
- Performance tests for full-text search
- Accessibility tests for hover/tooltip features
