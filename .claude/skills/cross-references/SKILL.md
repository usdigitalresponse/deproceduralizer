---
name: cross-references
description: Extract and display internal cross-references between regulatory documents. Use when running extraction after new regulations are scraped, or when working with citation linking features.
---

# Cross-References Skill

Extract and display internal cross-references between regulatory documents.

## Quick Commands

```bash
# Run extraction for a state
cd ~/Documents/Programming/raf/deproceduralizer/backend/scripts
python3 -m cross_references.run_extraction --state NJ --output db

# Check stats
./scripts/db-query.sh "SELECT jurisdiction, count(*), sum(case when is_resolved then 1 else 0 end) as resolved FROM cross_references GROUP BY jurisdiction"

# Sample cross-references
./scripts/db-query.sh "SELECT raw_text, normalized_citation, is_resolved FROM cross_references LIMIT 10"
```

## Current Stats (Mar 2026)

### Overall

| Jurisdiction | Total Refs | Resolved | Resolution Rate |
|--------------|------------|----------|-----------------|
| NY           | 93,334     | 54,971   | 58.9%           |
| NJ           | 83,853     | 83,826   | 100.0%          |
| NYC          | 3,953      | 3,945    | 99.8%           |
| **Total**    | **181,140**| **142,742** | **78.8%**    |

### By Reference Type

| ref_type | Count | Resolved | Rate | Notes |
|----------|-------|----------|------|-------|
| njac | 58,678 | 58,652 | 100.0% | Full-form NJ citations |
| same_section | 46,561 | 46,561 | 100.0% | Self-referential, no target doc needed |
| ny_short_form | 22,816 | 22,610 | 99.1% | Relative refs resolved via source context |
| form | 19,754 | 0 | 0.0% | Form IDs (e.g. `LDSS-4013B`) — intentionally unresolved, forms not in DB |
| guidance | 17,160 | 11,970 | 69.8% | Guidance-to-guidance refs; unresolved = historical docs not scraped |
| nycrr | 12,451 | 12,214 | 98.1% | Full-form NY citations |
| ny_statute | 2,221 | 0 | 0.0% | Statute refs (e.g. `Education Law 3209`) — statutes not in DB |
| ssl | 1,499 | 0 | 0.0% | Social Services Law refs — statutes not in DB |

**Regulation-to-regulation resolution remains ~99%+.** The overall rate is lower because newer ref types (`form`, `ny_statute`, `ssl`) reference entities outside the document DB and are extracted for display/informational purposes only.

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
- `ref_type` - nycrr, njac, ny_short_form, same_section, form, guidance, ny_statute, ssl

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

## Guidance Cross-Reference Resolution

Guidance-to-guidance cross-references use a two-lookup system for resolution:

### Lookup System

1. **`canonical_lookup`**: Maps `canonical_ref` -> `guidance_documents.id`. Covers exact matches for references like `22-OCFS-ADM-02`.

2. **`latest_revision_lookup`**: Maps base ref -> id of the latest revision. When a document has revisions (e.g., `22-OCFS-ADM-02-R1`), this maps the base ref (`22-OCFS-ADM-02`) to the latest revision's ID.

### Reverse-Revision Resolution

When a cross-reference cites a base ref (e.g., `22-OCFS-ADM-02`) but only a revised version exists in the DB (`22-OCFS-ADM-02-R1`), the resolver uses reverse-revision resolution:

1. Try direct match in `canonical_lookup`
2. Strip revision suffix and try base ref in `canonical_lookup`
3. Try intermediate revisions in `latest_revision_lookup`
4. **Reverse**: Try the cited ref in `latest_revision_lookup` (base -> latest revision)

This ensures citations to the original document resolve to the most current revision.

### Implementation

- `content_cross_refs.py`: `_build_guidance_lookup()` builds both lookups, `_resolve_guidance_ref()` implements the resolution chain
- `re_resolve_refs.py`: Re-resolves previously unresolved guidance refs using updated lookups

## Pattern Types

| Type | Example | Notes |
|------|---------|-------|
| NYCRR | `18 NYCRR 505.14` | Full-form NY citation |
| NJAC | `N.J.A.C. 8:43-1.2` | Full-form NJ citation |
| NY Short-form | `section 624.8 of this Part` | Requires source context |
| Same-section | `paragraph (a) of this section` | Internal reference |
| Form | `LDSS-4013B` | Government form IDs (display only, not resolved) |
| Guidance | `85 ADM-8`, `TSB-M-14(1.1)S` | Cross-refs between guidance documents |
| NY Statute | `Education Law 3209` | NY statute references (display only) |
| SSL | `SSL 366-c` | Social Services Law references (display only) |
