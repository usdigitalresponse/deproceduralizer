# Definitions - Future Enhancements

This document outlines improvements to the definitions extraction, visualization, and management features, organized into phases that build on each other incrementally.

## Current State (Updated Dec 22, 2025)

- **28,544** definitions extracted (all from NY)
- **26,161** have scope_level populated
- **25,724** have scope_document_id linked (89%)
- **3,146** definitions unlinked - see [GitHub Issue #31](../../issues/31) for investigation
- **5,719** are cross-references
- **28,544** have definition_type (formal/abbreviation)
- **18,312** unique terms (normalized)

### Unlinked Definitions Breakdown

| Reason | Count |
|--------|-------|
| Empty scope_level (LLM didn't extract) | 2,721 |
| title (can't find title ancestor) | 260 |
| subpart (can't find subpart ancestor) | 130 |
| article | 11 |
| subchapter | 9 |
| other (order, chapter, statute, null) | 15 |

Root causes documented in GitHub Issue #31.

### Potential Truncation in High-Definition Sections

The original extraction used `max_tokens=4096`, which may have truncated responses for sections with many definitions. This has been fixed to `max_tokens=64000` (Claude 4.5's limit).

**Sections needing re-extraction:** 982 sections with >8 definitions each

| Definitions per Section | Sections |
|------------------------|----------|
| 29 | 2 |
| 20-28 | 28 |
| 15-19 | 139 |
| 10-14 | 599 |
| 9 | 223 |

**Impact:** 11,730 definitions (41% of total) may be incomplete.

**Action:** Re-run extraction on these 982 sections with the updated `max_tokens=64000` setting to capture any previously truncated definitions.

## Completed Phases

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Schema Foundation** | ✅ Complete | All columns added, indexes created |
| **Phase 2: Extraction Pipeline** | ✅ Complete | Batch processed 5,067 sections, 27,001 definitions stored |
| **Phase 3: Data Migration** | ✅ Mostly Complete | 89% linked; 3,146 unlinked tracked in Issue #31 |
| **Phase 4: Core UI Features** | ✅ Complete | Filtering, term aggregation, applicable definitions, trigram search indexes |
| **Phase 5: Enhanced Discovery** | ✅ Mostly Complete | Term highlighting, tooltips implemented; definition usage analysis not done |
| **Phase 6: State Expansion** | 📋 Planned | Infrastructure ready; NJ extraction not yet run |
| **Phase 7: Quality Assurance** | 📋 Optional | Review pipeline, conflict detection (backlogged - not needed currently) |

---

# Phase 1: Schema Foundation

**Goal**: Establish the data model that all future features depend on. This phase is foundational - most later phases require these schema changes.

**Why first**: Without structured scope data, we cannot:
- Show applicable definitions on section pages (percolation)
- Filter definitions by scope level
- Detect conflicts between overlapping scopes
- Aggregate terms in the glossary efficiently

## 1.1 Core Schema Additions

Add columns to enable scope tracking, term normalization, and definition classification:

```sql
-- Structured scope (enables percolation, filtering, conflict detection)
ALTER TABLE definitions ADD COLUMN scope_level VARCHAR(20);
  -- Values: 'section', 'subpart', 'part', 'subchapter', 'chapter', 'subtitle', 'title'
ALTER TABLE definitions ADD COLUMN scope_document_id BIGINT REFERENCES regulatory_documents(id);
  -- Direct FK to the document this definition applies to

-- Definition classification (enables filtering formal vs abbreviations)
ALTER TABLE definitions ADD COLUMN definition_type VARCHAR(20) DEFAULT 'formal';
  -- Values: 'formal', 'abbreviation'

-- Term normalization (enables aggregation in glossary)
ALTER TABLE definitions ADD COLUMN normalized_term TEXT
  GENERATED ALWAYS AS (LOWER(TRIM(term))) STORED;

-- Cross-reference flag
ALTER TABLE definitions ADD COLUMN is_cross_reference BOOLEAN DEFAULT FALSE;

-- Indexes for efficient queries
CREATE INDEX idx_definitions_scope_document ON definitions(scope_document_id);
CREATE INDEX idx_definitions_scope_level ON definitions(scope_level);
CREATE INDEX idx_definitions_normalized_term ON definitions(normalized_term);
CREATE INDEX idx_definitions_type ON definitions(definition_type);
```

## 1.2 Hierarchy Level Reference

Both NY and NJ use the same generic hierarchy levels. The `scope_level` values should match `hierarchy_level` in `regulatory_documents`:

| Depth | Generic Level | NYCRR (NY) | NJAC (NJ) |
|-------|---------------|------------|-----------|
| 1 | title | Title | Title |
| 2 | subtitle | Subtitle | Subtitle |
| 3 | chapter | Chapter | Chapter |
| 4 | subchapter | Subchapter | Subchapter |
| 5 | article | Article | Article |
| 6 | part | Part | Part |
| 7 | subpart | Subpart | Subpart |
| 8 | section | Section | Section |

## 1.3 Definition Type Classification

Not all extracted "definitions" are equal:

| Type | Pattern | Scope | Example |
|------|---------|-------|---------|
| **formal** | "X means Y", "X shall mean Y" | Broad (Part/Chapter/Title) | `"Applicant" means any person who submits an application...` |
| **abbreviation** | Inline parenthetical `("X")` | Narrow (this section only) | `New York State ("State")` |

**Do NOT extract** (false positives):
- Numeric thresholds: `"300 beds"`, `"10 days"`
- Category labels: `("-300 bed")`
- Citations in WHEREAS clauses: `chapter 506 of the laws of 2009 ("2009 Public Authorities Reform Act")`

---

# Phase 2: Extraction Pipeline Improvements

**Goal**: Improve extraction quality BEFORE extracting more definitions. This prevents accumulating bad data that would need cleanup later.

**Why second**: Schema is in place; now ensure new extractions populate it correctly and avoid false positives.

**Recommendation**: Clear existing definitions and re-extract with improved pipeline:
- Current definitions have quality issues (false positives like "300 beds", citations)
- No manual review data to preserve (review columns don't exist yet)
- Use **Sonnet 4.5** instead of Haiku for better judgment on edge cases
- Estimated cost: ~$17 for NY (5,887 sections via Batch API)

## 2.1 Improved Extraction Prompt

The current prompt is too permissive. Replace with:

```yaml
definition_extraction:
  template: |
    Extract ONLY formal term definitions from this regulation section.

    TITLE: {title}
    CONTENT (first 3000 chars):
    {content}

    WHAT IS A DEFINITION:
    A definition explicitly assigns meaning to a term, typically with patterns like:
    - "X means Y"
    - "X shall mean Y"
    - "For purposes of this [section/part], X is defined as Y"
    - "(a) X. [definition text]" in a definitions section

    WHAT IS NOT A DEFINITION (DO NOT EXTRACT):
    - Numeric thresholds or criteria (e.g., "300 beds", "10 days", "$500")
    - Category labels or abbreviations in parentheses (e.g., "("-300 bed")", "(HBF)")
    - Citations to laws (e.g., "chapter 506 of the laws of 2009")
    - Cross-references without actual definitions (e.g., "as defined in section X")
    - General descriptions of requirements or procedures
    - Examples or illustrations

    DEFINITION TYPES:
    - type="formal": Found in definitions sections, uses "means"/"shall mean" patterns
    - type="abbreviation": Inline shorthand like "New York State ("State")"

    For each definition found, extract:
    - term: The term being defined (noun phrase, not a number)
    - definition: The definition text VERBATIM from the regulation
    - type: "formal" or "abbreviation"
    - scope: The scope text (e.g., "in this Part", "in this section")
    - source_location: Where it appears (e.g., "section 1.1", "definitions section")

    If no formal definitions exist, return an empty list.
    When in doubt, DO NOT extract - false negatives are better than false positives.
```

## 2.2 Section Selection Patterns

Use optimized regex patterns to identify sections likely to contain definitions. These patterns were analyzed against 40,518 NY sections to balance precision vs recall.

### Title Patterns (High Precision)

Sections with these title patterns are almost always definition sections:

```python
DEFINITION_TITLE_PATTERNS = [
    r'definition',           # 1,508 sections - explicit definition sections
    r'glossary',             # 20 sections - 100% definition content
    r'meaning of',           # 6 sections
    r'words (and|&) (terms|phrases)',  # 3 sections
    r'terminology',          # 2 sections
]
```

### Content Patterns (Optimized)

These patterns identify definition content with high precision. **Patterns that were removed** (too many false positives):
- `\ymeans\y` alone - matches "by means of", "this means that"
- `for purposes of` alone - matches "for purposes of compliance"

```python
DEFINITION_CONTENT_PATTERNS = [
    # Explicit definition markers
    r'\ydefinitions?\y',                  # 847 sections
    r'shall mean',                        # 1,634 sections - almost always definitions
    r'shall have the following meaning',  # 229 sections
    r'have the meanings',                 # 83 sections
    r'(is|are) defined',                  # 720 sections

    # Scope-based definition intros
    r'as used in this',                   # 847 sections - "As used in this section..."
    r'when used in this',                 # 179 sections - "When used in this Part..."
    r'for (the )?purpose(s)? of this',    # Scoped definitions

    # Term patterns
    r'the term.*means',                   # 893 sections - "The term X means..."

    # Abbreviation patterns
    r'hereinafter',                       # 725 sections - formal abbreviations
    r'\("[\w]+"\)',                        # 281 sections - inline ("State"), ("DOH")
    r'referred to as',                    # 328 sections
]
```

### Combined Query

```sql
SELECT * FROM regulatory_documents
WHERE hierarchy_level = 'section' AND state = 'NY'
AND (
    -- Title patterns
    title ~* 'definition'
    OR title ~* 'glossary'
    OR title ~* 'meaning of'
    OR title ~* 'words (and|&) (terms|phrases)'
    OR title ~* 'terminology'

    -- Content patterns
    OR content ~* '\ydefinitions?\y'
    OR content ~* 'shall mean'
    OR content ~* 'shall have the following meaning'
    OR content ~* 'have the meanings'
    OR content ~* '(is|are) defined'
    OR content ~* 'as used in this'
    OR content ~* 'when used in this'
    OR content ~* 'for (the )?purpose(s)? of this'
    OR content ~* 'the term.*means'
    OR content ~* 'hereinafter'
    OR content ~ '\("[\w]+"\)'
    OR content ~* 'referred to as'
)
-- Result: 5,887 sections (vs 6,202 with loose patterns)
```

### Pattern Analysis Summary

| Approach | Sections | Est. Cost (Sonnet 4.5 Batch) |
|----------|----------|------------------------------|
| Original (loose `means`, `for purposes of`) | 6,202 | ~$18 |
| **Optimized patterns** | **5,887** | **~$17** |

Optimization removes ~300 false positive sections while adding inline abbreviation patterns that capture real definitions.

## 2.3 Infer Scope from Section Position

For sections titled "Definitions", infer scope from the parent document:

```python
def infer_scope_from_section_title(document: RegulatoryDocument) -> tuple[str, int]:
    """
    If section is titled 'Definitions', its definitions apply to the parent.
    """
    if 'definition' in document.title.lower():
        parent = get_parent_document(document.id)
        if parent:
            return parent.hierarchy_level, parent.id  # e.g., ('part', 123)
    return None, None
```

This auto-populates `scope_level` and `scope_document_id` with high confidence.

## 2.4 Scope Resolution for LLM-Extracted Scope

When the LLM extracts free-text scope, resolve it to structured fields:

```python
SCOPE_PATTERNS = {
    r'in this section': 'section',
    r'in this subpart': 'subpart',
    r'in this part': 'part',
    r'in this subchapter': 'subchapter',
    r'in this chapter': 'chapter',
    r'in this title': 'title',
    r'in this regulation': 'part',  # Usually means the current Part
    r'in this order': 'section',    # Executive orders
}

def resolve_scope(scope_text: str, source_document_id: int) -> tuple[str, int]:
    """
    Resolve free-text scope to (scope_level, scope_document_id).
    Walks up parent_id chain to find the appropriate ancestor.
    """
    scope_text_lower = scope_text.lower() if scope_text else ''

    for pattern, level in SCOPE_PATTERNS.items():
        if re.search(pattern, scope_text_lower, re.I):
            scope_document_id = find_ancestor_at_level(source_document_id, level)
            return level, scope_document_id

    return None, None
```

## 2.5 Overlap Metric Fix

The current `calculate_definition_overlap()` uses `SequenceMatcher.ratio()` which is flawed for short definitions in long documents:

**Current (broken):**
```python
matcher = SequenceMatcher(None, definition_lower, content_lower)
return matcher.ratio()  # Returns ~0.01 even for valid paraphrases
```

**Proposed fix - Key phrase matching:**
```python
def calculate_definition_overlap(definition: str, content: str) -> float:
    definition_lower = definition.lower()
    content_lower = content.lower()

    # Fast path: exact substring match
    if definition_lower in content_lower:
        return 1.0

    # Check overlapping 3-grams
    words = definition_lower.split()
    if len(words) < 3:
        return 1.0 if definition_lower in content_lower else 0.0

    trigrams = [' '.join(words[i:i+3]) for i in range(len(words) - 2)]
    matches = sum(1 for tg in trigrams if tg in content_lower)
    return matches / len(trigrams) if trigrams else 0.0
```

---

# Phase 3: Migrate Existing Data

**Goal**: Backfill the new schema columns for existing 4,357 definitions.

**Why third**: Schema exists, extraction improvements are ready. Now clean up existing data before building UI features on top.

## 3.1 Backfill scope_level

```sql
UPDATE definitions SET scope_level = CASE
    WHEN LOWER(scope) LIKE '%section%' THEN 'section'
    WHEN LOWER(scope) LIKE '%subpart%' THEN 'subpart'
    WHEN LOWER(scope) LIKE '%part%' THEN 'part'
    WHEN LOWER(scope) LIKE '%subchapter%' THEN 'subchapter'
    WHEN LOWER(scope) LIKE '%chapter%' THEN 'chapter'
    WHEN LOWER(scope) LIKE '%subtitle%' THEN 'subtitle'
    WHEN LOWER(scope) LIKE '%title%' THEN 'title'
    WHEN LOWER(scope) LIKE '%regulation%' THEN 'part'
    WHEN LOWER(scope) LIKE '%order%' THEN 'section'
    ELSE NULL
END
WHERE scope_level IS NULL;
```

## 3.2 Backfill scope_document_id

This requires walking the hierarchy for each definition. Run via Python script:

```python
def backfill_scope_document_ids():
    """
    For each definition with scope_level but no scope_document_id,
    walk up the parent chain to find the ancestor at that level.
    """
    definitions = db.query("""
        SELECT d.id, d.document_id, d.scope_level
        FROM definitions d
        WHERE d.scope_level IS NOT NULL
        AND d.scope_document_id IS NULL
        AND d.document_id IS NOT NULL
    """)

    for defn in definitions:
        scope_doc_id = find_ancestor_at_level(defn.document_id, defn.scope_level)
        if scope_doc_id:
            db.execute("""
                UPDATE definitions SET scope_document_id = %s WHERE id = %s
            """, (scope_doc_id, defn.id))
```

## 3.3 Backfill definition_type

Classify existing definitions as formal vs abbreviation based on patterns:

```sql
-- Abbreviations: typically short, parenthetical introductions
UPDATE definitions SET definition_type = 'abbreviation'
WHERE definition_type IS NULL
AND (
    -- Definition is just a proper noun / organization name
    LENGTH(definition) < 100
    AND term IN (SELECT term FROM definitions WHERE scope = 'in this section')
    AND definition ~ '^[A-Z]'  -- Starts with capital (proper noun)
);

-- Everything else is formal
UPDATE definitions SET definition_type = 'formal'
WHERE definition_type IS NULL;
```

## 3.4 Detect Cross-References

```sql
UPDATE definitions SET is_cross_reference = TRUE
WHERE is_cross_reference = FALSE
AND (
    LOWER(definition) LIKE '%as defined in%'
    OR LOWER(definition) LIKE '%has the same meaning as%'
    OR LOWER(definition) LIKE '%see section%'
    OR LOWER(definition) LIKE '%as such term is defined%'
);
```

---

# Phase 4: Core UI Features

**Goal**: Build the key user-facing features that depend on structured scope data.

**Why fourth**: Data is clean and structured. Now build UI to expose it.

## 4.1 Definition Filtering

Currently the glossary only has search and A-Z letter filters. Add:

| Filter | Type | Values | Notes |
|--------|------|--------|-------|
| Scope Level | Select | section, part, chapter, title, all | Filter by `scope_level` |
| Definition Type | Select | formal, abbreviation, all | Filter by `definition_type` |
| Quality | Select | high (1.0), medium (0.3-1.0), low (<0.3), all | Filter by `definition_overlap` |

**Implementation files:**

1. **URL parsers** (`lib/url/parsers.ts`):
```typescript
export const definitionScopeLevelParser = parseAsStringLiteral([
  'section', 'part', 'chapter', 'title', 'all'
] as const).withDefault('all');

export const definitionTypeParser = parseAsStringLiteral([
  'formal', 'abbreviation', 'all'
] as const).withDefault('all');

export const definitionQualityParser = parseAsStringLiteral([
  'high', 'medium', 'low', 'all'
] as const).withDefault('all');

export const glossaryFiltersParsers = {
  page: pageParser,
  search: searchParser,
  letter: parseAsString,
  scopeLevel: definitionScopeLevelParser,
  type: definitionTypeParser,
  quality: definitionQualityParser,
};
```

2. **Create `GlossaryFilters` component** - horizontal filter bar following `ReviewFilters` pattern

3. **Update repository** (`definitions.repository.ts`):
```typescript
// Add quality filter
if (filters.quality === 'high') {
  conditions.push(eq(definitions.definitionOverlap, 1.0));
} else if (filters.quality === 'medium') {
  conditions.push(and(
    gte(definitions.definitionOverlap, 0.3),
    lt(definitions.definitionOverlap, 1.0)
  ));
} else if (filters.quality === 'low') {
  conditions.push(lt(definitions.definitionOverlap, 0.3));
}
```

**Filter UI mockup:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Search term...]  [Scope ▼]  [Type ▼]  [Quality ▼]  [Clear All]    │
├─────────────────────────────────────────────────────────────────────┤
│ A B C D E F G H I J K L M N O P Q R S T U V W X Y Z [All]          │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Term Aggregation in Glossary

Same terms with multiple definitions should appear as one entry:

**Example results from current data:**
| Term | Count | Reason |
|------|-------|--------|
| department | 87 | Every agency defines "department" for their context |
| person | 45 | Legal definitions vary by regulation |
| applicant | 38 | Different application processes |

**Glossary UI - Aggregated View:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Department                                    [87 variants] │ │
│ │ The agency responsible for administration...                │ │
│ │ ▸ Show all 87 definitions                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GVWR                                                        │ │
│ │ Gross vehicle weight rating means the value...              │ │
│ │ Defined in: § 720.1 → Part 720                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Expanded variant view:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Department                                        [87 variants] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Title 10 (Health) ─────────────────────────────────────────┐ │
│ │ "The New York State Department of Health"                   │ │
│ │ Scope: Title 10  •  12 sections use this definition         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Title 17 (Transportation) ─────────────────────────────────┐ │
│ │ "The New York State Department of Transportation"           │ │
│ │ Scope: Title 17  •  8 sections use this definition          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Query for glossary page:**
```sql
SELECT
    normalized_term,
    COUNT(*) as variant_count,
    MAX(definition) FILTER (WHERE definition_overlap = 1.0) as preview_definition
FROM definitions
GROUP BY normalized_term
ORDER BY normalized_term;
```

## 4.3 Applicable Definitions on Section Pages

When viewing a section, show ALL definitions that apply (percolation):

**Example hierarchy:**
```
Title 17 (TRANSPORTATION)
  └── Chapter VI
        └── Part 720 (Bus and Truck Safety)
              ├── Section 720.1 (Definitions)  ← Definitions defined here
              ├── Section 720.2 (Scope)
              └── Section 720.4 (Vehicle Safety)  ← User is viewing this
```

**What the user sees on Section 720.4:**

| Term | Definition | Defined In | Applies To |
|------|------------|------------|------------|
| GVWR | Gross vehicle weight rating... | § 720.1 | Part 720 |
| Commercial vehicle | A vehicle used for... | § 720.1 | Part 720 |
| Department | The DOT... | Title 17 Intro | Title 17 |
| Inspector | A person authorized... | § 720.4(a) | § 720.4 only |

**Query:**
```sql
-- Get ancestor chain for current section
WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, hierarchy_level
    FROM regulatory_documents
    WHERE id = :current_section_id

    UNION ALL

    SELECT rd.id, rd.parent_id, rd.hierarchy_level
    FROM regulatory_documents rd
    JOIN ancestors a ON rd.id = a.parent_id
)
-- Find definitions whose scope_document_id is in ancestor chain
SELECT
    d.term,
    d.definition,
    source_doc.title as defined_in,
    scope_doc.title as applies_to,
    d.scope_level,
    d.definition_type
FROM definitions d
JOIN regulatory_documents source_doc ON d.document_id = source_doc.id
JOIN regulatory_documents scope_doc ON d.scope_document_id = scope_doc.id
WHERE d.scope_document_id IN (SELECT id FROM ancestors)
ORDER BY
    CASE d.scope_level
        WHEN 'title' THEN 1
        WHEN 'chapter' THEN 2
        WHEN 'part' THEN 3
        WHEN 'section' THEN 4
    END,
    d.term;
```

**UI mockup:**
```
┌─────────────────────────────────────────────────────────────────┐
│ § 720.4 - Vehicle Safety Requirements                          │
├─────────────────────────────────────────────────────────────────┤
│ [Content of the section...]                                     │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 📖 Applicable Definitions (4)                                   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GVWR                                        [Part 720]      │ │
│ │ Gross vehicle weight rating means...                        │ │
│ │ Defined in: § 720.1                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Inspector                      [§ 720.4 only] [Abbreviation]│ │
│ │ A person authorized by the department...                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

# Phase 5: Enhanced Discovery

**Status**: ✅ Mostly Complete (Term highlighting and tooltips implemented)

**Goal**: Help users find and understand definitions in context.

**Why fifth**: Core functionality complete. Now enhance discoverability.

## 5.1 Term Highlighting in Regulation Text ✅ IMPLEMENTED

Highlight defined terms within regulation content:

**Implementation**:
- `useTermHighlighting.ts` hook finds all occurrences of defined terms
- Uses word-boundary regex matching with longest-first priority
- Case-insensitive matching with character offset tracking
- Integrated into `AnnotatableContent.tsx` for regulation display

**Features**:
- Detect when defined terms appear in regulation text
- Apply subtle highlighting (dotted underline, background color)
- Link highlighted terms to their definitions
- Performance optimized for long regulations

## 5.2 Tooltip Definitions on Click ✅ IMPLEMENTED

Show definition previews when clicking highlighted terms:

**Implementation**:
- `DefinitionPopover.tsx` component with portal rendering
- Shows term name, scope badge, definition type badge, cross-reference flag
- Truncated definition preview (200 chars) with link to source
- Keyboard accessible (Escape to close), click-outside handling

**Features**:
- Click highlighted term shows popover with definition
- Include scope badge in popover
- "See more" link to full definition in glossary
- Keyboard accessible (focus states)

## 5.3 Definition Usage Analysis ❌ NOT IMPLEMENTED

Track how terms are used:

- Count occurrences of defined terms in regulation text
- Identify regulations that use terms but lack definitions
- Surface commonly used but undefined terminology

---

# Phase 6: State Expansion

**Status**: 📋 Infrastructure Ready

**Goal**: Extend to New Jersey and enable cross-state comparison.

**Why sixth**: NY is working well. Now replicate for NJ.

## 6.1 NJ Definition Extraction

**Infrastructure** (ready in `batch_definitions.py`):
- Script accepts `--state NJ` parameter
- State-aware database queries with `njac_*` prefix handling
- Same Pydantic models work for both NY and NJ

**Action needed**: Run extraction on NJ sections

- Extract definitions from NJAC regulations
- Handle NJAC-specific citation formats
- Use same improved prompt and schema
- Run document_id migration after import

## 6.2 Cross-State Comparison ❌ NOT IMPLEMENTED

- Same term, different state definitions
- Identify common vs unique terminology
- Multi-state regulation comparison view

---

# Phase 7: Quality Assurance (Optional)

**Status**: 📋 Backlogged

**Goal**: Add review workflows and conflict detection to ensure data quality.

**Why optional**: Core features work. Quality controls can be added when needed.

## 7.1 Review Pipeline

Add review status tracking (similar to red flags and compliance issues):

```sql
ALTER TABLE definitions ADD COLUMN review_status VARCHAR(50) DEFAULT 'unreviewed';
ALTER TABLE definitions ADD COLUMN reviewed_by VARCHAR(255);
ALTER TABLE definitions ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE definitions ADD COLUMN reviewer_notes TEXT;

CREATE INDEX idx_definitions_review_status ON definitions(review_status);
```

**Review statuses**: unreviewed, confirmed, incorrect, needs_context

**Review UI pattern** - follow `ComplianceIssueCard`:
- Card-based layout with definition details
- Inline action buttons for status changes
- Expandable section for regulation context
- Reviewer notes input
- Filter by overlap score to surface low-quality definitions first

## 7.2 Conflict Detection

Detect when definitions conflict within overlapping scopes:

**Conflict types:**
| Type | Description | Severity | Example |
|------|-------------|----------|---------|
| `duplicate` | Same term defined twice in same document | High | Two "applicant" definitions in § 100.1 |
| `scope_overlap` | Part definition conflicts with Title definition | Medium | Part 200 defines "facility" differently than Title 10 |
| `scope_shadow` | Narrower scope overrides broader (may be intentional) | Low | Part-specific definition shadows Title-wide one |

**Schema for conflict tracking:**
```sql
ALTER TABLE definitions ADD COLUMN has_conflict BOOLEAN DEFAULT FALSE;
ALTER TABLE definitions ADD COLUMN conflict_with_id BIGINT REFERENCES definitions(id);
ALTER TABLE definitions ADD COLUMN conflict_type VARCHAR(50);
ALTER TABLE definitions ADD COLUMN conflict_notes TEXT;

CREATE INDEX idx_definitions_has_conflict ON definitions(has_conflict) WHERE has_conflict = TRUE;
```

**Detection query:**
```sql
WITH definition_pairs AS (
    SELECT
        d1.id as def1_id,
        d2.id as def2_id,
        d1.term,
        d1.scope_document_id as scope1,
        d2.scope_document_id as scope2
    FROM definitions d1
    JOIN definitions d2 ON d1.normalized_term = d2.normalized_term
        AND d1.id < d2.id
        AND d1.definition != d2.definition
)
SELECT * FROM definition_pairs
WHERE scopes_overlap(scope1, scope2);  -- Custom function checking ancestry
```

**Reviewer actions:**
- Mark as Intentional (narrower scope overrides broader)
- Flag for Review (needs legal/policy review)
- Add Clarification Note

## 7.3 Performance Optimization

For tens of thousands of definitions, add materialized view:

```sql
CREATE MATERIALIZED VIEW glossary_terms AS
SELECT
    normalized_term,
    COUNT(*) as variant_count,
    MAX(definition) FILTER (WHERE definition_overlap = 1.0) as preview_definition,
    array_agg(DISTINCT scope_level) as scope_levels,
    array_agg(DISTINCT definition_type) as definition_types
FROM definitions
GROUP BY normalized_term
ORDER BY normalized_term;

CREATE UNIQUE INDEX ON glossary_terms(normalized_term);

-- Refresh after extractions
REFRESH MATERIALIZED VIEW CONCURRENTLY glossary_terms;
```

---

# Implementation Notes

## Database Considerations

- The `normalized_term` generated column auto-populates on insert
- Consider partitioning definitions by state if data grows significantly
- Monitor query performance on glossary page

## Frontend Patterns

- Use `ActionResult<T>` for server actions
- Follow `ComplianceIssuesList` pattern for review UI
- Use existing `Badge`, `Card`, `Alert` components
- Use `nuqs` for URL-based filter state
- Update `STYLE_GUIDE.md` with new components

## Testing Considerations

- Unit tests for scope resolution logic
- Integration tests for review workflow
- Performance tests for aggregation queries
- Accessibility tests for hover/tooltip features

---

# Phase Summary

| Phase | Focus | Key Deliverables | Dependencies |
|-------|-------|------------------|--------------|
| **1** | Schema Foundation | scope_level, scope_document_id, definition_type, normalized_term | None |
| **2** | Extraction Pipeline | Improved prompt, prioritize definition sections, scope inference | Phase 1 |
| **3** | Data Migration | Backfill scope_level, scope_document_id, definition_type | Phase 1 |
| **4** | Core UI | Filtering, term aggregation, applicable definitions on sections | Phase 1, 3 |
| **5** | Enhanced Discovery | Term highlighting, tooltips | Phase 4 |
| **6** | State Expansion | NJ extraction, cross-state comparison | Phase 1-4 |
| **7** | Quality Assurance (Optional) | Review pipeline, conflict detection | Phase 4 |

## Quick Wins Within Each Phase

| Phase | Quick Win | Effort | Impact |
|-------|-----------|--------|--------|
| 1 | Add schema columns | Low | Enables everything |
| 2 | Use optimized section patterns | Low | 5,887 sections with high precision |
| 2 | Improve extraction prompt | Low | Reduces false positives immediately |
| 2 | Use Sonnet 4.5 instead of Haiku | Low | Better quality, ~$17 total cost |
| 3 | Backfill scope_level from text | Low | Enables filtering |
| 4 | Add basic scope filter to glossary | Low | Immediate user value |
| 5 | Term highlighting with CSS underlines | Low | Immediate UX improvement |
| 7 | Surface low-overlap definitions for review | Low | Quality wins (optional) |

---

# Backlogged Features

These features have been deprioritized but may be revisited later.

## Full-Text Search

Add GIN index for fuzzy matching, phrase search, and relevance ranking:

```sql
CREATE INDEX idx_definitions_search ON definitions
  USING GIN (to_tsvector('english', term || ' ' || verbatim_text));
```

Features:
- Fuzzy matching (e.g., "facilities" matches "facility")
- Phrase search
- Relevance ranking
- English stemming

**Status**: Backlogged - current trigram indexes provide adequate search performance for ILIKE queries.
