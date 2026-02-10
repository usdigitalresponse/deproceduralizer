> **Status: PROPOSED**
> This document describes a proposed approach that has NOT been implemented.

# Plan: Link NY Statutes to NY Regulations

## Goal

Create `regulation_statute_links` entries connecting NY regulations (NYCRR) to NY statutes (NYCLS), mirroring what we already have for NJ. Two passes:

1. **Regex scan** — find statute citations in regulation text, match to statutes table
2. **LLM classification** — for matched links only, classify the relationship type

## Context

### Citation Patterns in NYCRR

NY regulations cite statutes in natural language (unlike NJ's compact `N.J.S.A. 52:27D-119` format). The most common patterns, from analyzing ~60K NY regulation sections:

| Pattern | Example | Frequency |
|---------|---------|-----------|
| `section X of the Y Law` | "section 488 of the Social Services Law" | ~3,700 regs |
| `pursuant to section X` | "pursuant to section 160" | ~4,400 regs |
| `Y Law section X` | "Education Law section 4401" | ~1,000 regs |
| `Y Law § X` | "Public Health Law § 2801" | ~300 regs |
| `subdivision X of section Y` | "subdivision (a) of section 413" | ~1,800 regs |

### Top Referenced Laws

| Law Name in Regs | Law ID | Citation Count |
|------------------|--------|----------------|
| Education | EDN | 1,101 |
| Public Health | PBH | 621 |
| Social Services | SOS | 592 |
| Tax | TAX | 543 |
| Insurance | ISC | 504 |
| Executive | EXC | 481 |
| Vehicle and Traffic | VAT | 451 |
| Public Officers | PBO | 330 |
| State Finance | STF | 317 |

### Existing Infrastructure

- `regulation_statute_links` table already exists (used for NJ)
- Columns: `regulation_id`, `statute_id`, `citation`, `context`, `link_type`, `match_status`, `original_citation`, `correction_notes`, `reviewed_at`
- NJ linking logic in `backend/scripts/nj_statutes.py::create_regulation_statute_links()` — good template

## Implementation

### Phase 1: Ingest All Referenced Laws

Before linking, we need the statutes in the DB. Currently only SOS is loaded.

```bash
# Priority laws (top 9 by citation count):
python backend/scripts/ny_statutes.py EDN PBH TAX ISC EXC VAT PBO STF SOS

# Then all remaining consolidated laws:
python backend/scripts/ny_statutes.py
```

### Phase 2: Build Law Name → Law ID Mapping

The tricky part: regulations say "Social Services Law" but our DB has `law_id = 'SOS'`. We need a mapping table.

**Source**: The OpenLegislation API law list already returns `{lawId, name}` pairs. We cache this during ingestion. Build a lookup like:

```python
LAW_NAME_TO_ID = {
    'Social Services': 'SOS',
    'Education': 'EDN',
    'Public Health': 'PBH',
    'Executive': 'EXC',
    'Insurance': 'ISC',
    # ... ~95 total
    # Also handle variants:
    'Vehicle and Traffic': 'VAT',
    'New York State Vehicle and Traffic': 'VAT',  # seen in regs
}
```

**File**: Create `backend/lib/ny_law_names.py` with the mapping. Auto-generate from API + manual variant additions.

### Phase 3: Regex Scan (New Script)

**File**: `backend/scripts/link_ny_statutes.py`

#### Regex Patterns

```python
# Pattern 1: "section 488 of the Social Services Law"
r'(?i)section\s+(\d+[\-a-z]*)\s+of\s+the\s+((?:[A-Z][a-z]+\s+)*[A-Z][a-z]+)\s+Law'

# Pattern 2: "Education Law section 4401" / "Education Law § 4401"
r'(?i)((?:[A-Z][a-z]+\s+)*[A-Z][a-z]+)\s+Law\s+(?:section|§)\s*(\d+[\-a-z]*)'

# Pattern 3: "pursuant to section 160 of the Transportation Law"
# (covered by Pattern 1)

# Pattern 4: "subdivision (a) of section 413 of the Social Services Law"
r'(?i)subdivision\s+\([a-z0-9]+\)\s+of\s+section\s+(\d+[\-a-z]*)\s+of\s+the\s+((?:[A-Z][a-z]+\s+)*[A-Z][a-z]+)\s+Law'
```

#### Logic

For each NY regulation section:
1. Run all regex patterns against content
2. Extract (section_number, law_name) pairs
3. Look up law_name → law_id via mapping
4. Build citation as `"{LAW_ID} {section_number}"` (e.g., `"SOS 488"`)
5. Look up citation in statutes table
6. Insert into `regulation_statute_links` with:
   - `match_status = 'matched'` if statute found
   - `match_status = 'unmatched'` if law_id resolved but section not in DB
   - `match_status = 'unknown_law'` if law name not in mapping
   - `link_type = NULL` (filled in by LLM in Phase 4)

#### CLI

```bash
python backend/scripts/link_ny_statutes.py                    # Full scan
python backend/scripts/link_ny_statutes.py --dry-run           # Preview without writing
python backend/scripts/link_ny_statutes.py --law SOS           # Only links to SOS statutes
python backend/scripts/link_ny_statutes.py --title 18          # Only scan NYCRR Title 18
```

### Phase 4: LLM Classification (Add to Research Pipeline)

Only for `regulation_statute_links` rows where `match_status = 'matched'` and `link_type IS NULL`.

#### Classification Task

Given the regulation context (150 chars before/after the citation), classify as:
- `enabling_authority` — statute authorizes/creates the regulation
- `definition` — regulation references a statutory definition
- `requirement` — regulation implements a statutory requirement
- `reference` — general cross-reference

This is a simple classification task — use Haiku via batch API for cost efficiency.

#### Integration Options

**Option A**: Add as a new issue type in the research pipeline (`compliance_issues.yaml`)
- Pro: reuses existing batch infrastructure
- Con: statute links aren't really "compliance issues"

**Option B**: Standalone batch script (like `batch_definitions.py`)
- Pro: clean separation of concerns
- Con: duplicates batch API boilerplate

**Option C**: Add `link_type` classification directly to `link_ny_statutes.py` using regex heuristics first, LLM for ambiguous cases
- Pro: simplest, regex can handle ~70% of cases (NJ patterns show this)
- Con: less accurate than LLM-only

**Recommended: Option C** — Start with regex classification (reuse NJ's `LINK_TYPE_PATTERNS` adapted for NY citation style), then add an optional `--llm-classify` flag that sends ambiguous cases to Haiku batch. This keeps it self-contained and cheap.

## Files to Create/Modify

| Action | File | What |
|--------|------|------|
| CREATE | `backend/lib/ny_law_names.py` | Law name → law ID mapping (auto-generated + manual variants) |
| CREATE | `backend/scripts/link_ny_statutes.py` | Regex scan + link creation + optional LLM classification |
| MODIFY | `backend/scripts/ny_statutes.py` | Add `--link` flag to run linking after ingestion |
| MODIFY | `docs/OPERATIONS.md` | Document the linking script |

## Order of Operations

1. **Ingest all statutes** — `python backend/scripts/ny_statutes.py` (all ~95 consolidated laws)
2. **Build law name mapping** — auto-generate from API data + review
3. **Regex scan** — `python backend/scripts/link_ny_statutes.py --dry-run` to preview, then run
4. **Review match rates** — check `unknown_law` and `unmatched` counts
5. **LLM classify** — `python backend/scripts/link_ny_statutes.py --llm-classify` for link_type

## Cost Estimate

| Step | Cost | Time |
|------|------|------|
| Ingest all laws | Free (API) | ~4 hours |
| Regex scan | Free | Minutes |
| LLM classification (Haiku batch) | ~$5-10 | Hours (batch queue) |
