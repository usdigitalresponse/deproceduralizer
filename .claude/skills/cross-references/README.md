# Cross-References Skill

Extract and display internal cross-references between regulatory documents.

## Quick Commands

```bash
# Run extraction for a state
cd ~/Documents/Programming/raf/deproceduralizer-crossrefs/backend/scripts/cross_references
python3 run_extraction.py --state NJ --output db

# Check stats
./scripts/db-query.sh "SELECT state, count(*), sum(case when is_resolved then 1 else 0 end) as resolved FROM cross_references GROUP BY state"

# Sample cross-references
./scripts/db-query.sh "SELECT raw_text, normalized_citation, is_resolved FROM cross_references LIMIT 10"
```

## Current Stats (Dec 2024)

| State | Total Refs | Documents | Resolution Rate |
|-------|------------|-----------|-----------------|
| NY    | 31,024     | 12,826    | 99.6%           |
| NJ    | 75,680     | 23,425    | 99.9%           |
| **Total** | **106,704** | - | **99.8%** |

## When to Re-run Extraction

Re-run the extraction pipeline when:
- New regulations are scraped/imported
- Patterns are updated to catch more references
- Resolution logic is improved

## Reference Files

- **[extraction.md](extraction.md)** - Step-by-step extraction guide
- **[patterns.md](patterns.md)** - Pattern reference and troubleshooting

## Architecture

### Backend (Extraction)

```
backend/scripts/cross_references/
├── patterns.py       # Regex patterns for citation detection
├── extractor.py      # Text extraction logic
├── resolver.py       # Citation resolution to document IDs
├── db_writer.py      # Write results to database
└── run_extraction.py # CLI entry point
```

### Database

Table: `cross_references`
- See [`.claude/skills/database/schema.md`](../database/schema.md) for full schema

Key columns:
- `source_document_id` - Document containing the citation
- `target_document_id` - Document being cited (NULL if unresolved)
- `raw_text` - Original citation text
- `ref_type` - nycrr, njac, ny_short_form, same_section

### Frontend

Repository: `frontend/packages/database/src/repositories/cross-references.repository.ts`
Server Actions: `frontend/apps/web/src/lib/actions/cross-references.ts`
Components: `frontend/apps/web/src/components/cross-references/`
Hooks: `frontend/apps/web/src/hooks/useCrossRefHighlighting.ts`

#### Display Features

1. **Cross-References Section**: Shows list of outgoing references on regulation detail pages
2. **Cited By Section**: Shows incoming references (documents that cite this one)
3. **Inline Highlighting**: Citations are highlighted in regulation text with green dotted underlines
   - Click a highlighted citation to show a popover with target document info
   - Popover includes "View referenced document" link for navigation
4. **Tree View Badges**: Documents show cross-reference counts in browse tree

## Pattern Types

| Type | Example | Notes |
|------|---------|-------|
| NYCRR | `18 NYCRR 505.14` | Full-form NY citation |
| NJAC | `N.J.A.C. 8:43-1.2` | Full-form NJ citation |
| NY Short-form | `section 624.8 of this Part` | Requires source context |
| Same-section | `paragraph (a) of this section` | Internal reference |
