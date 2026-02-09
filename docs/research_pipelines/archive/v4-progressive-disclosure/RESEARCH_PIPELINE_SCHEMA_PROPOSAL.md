# Research Pipeline Schema Proposal

> **Status: CURRENT**
> Updated for Progressive Context Disclosure architecture.
> **Related**: See `RESEARCH_PIPELINE_MODELS.md` for Pydantic models.

## Overview

The architecture introduces **document-level analysis with match grouping**. This requires a new table structure:

1. **`compliance_issues`** - Original regex match records (unchanged)
2. **`compliance_issue_analyses`** - NEW: Document-level analysis results

### Processing Unit

```
ProcessingUnit = (document_id, issue_type, [all_regex_matches])
```

One `compliance_issue_analyses` record per unique (document_id, issue_type) pair.

---

## New Table: `compliance_issue_analyses`

```sql
CREATE TABLE compliance_issue_analyses (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id),
    issue_type VARCHAR(50) NOT NULL,
    state VARCHAR(2) NOT NULL CHECK (state IN ('NY', 'NJ')),

    -- ═══════════════════════════════════════════════════════════════════
    -- Match Grouping
    -- ═══════════════════════════════════════════════════════════════════
    grouped_match_count INTEGER NOT NULL,
    -- Number of regex matches evaluated together

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 1: Match Filtering
    -- ═══════════════════════════════════════════════════════════════════
    tier1_relevant_match_ids INTEGER[],
    -- IDs from compliance_issues that passed filtering

    tier1_dismissed_match_ids INTEGER[],
    -- IDs from compliance_issues that were filtered out

    tier1_dismissed_reasons JSONB,
    -- Array of {match_id, text, reason}

    tier1_classification VARCHAR(30),
    -- 'all_false_positives' | 'needs_research'

    tier1_confidence REAL,
    -- 0.0-1.0

    tier1_reasoning TEXT,
    -- Explanation of filtering decisions

    tier1_context_requests JSONB,
    -- Array of ContextRequest objects for Tier 2:
    -- [{context_type, identifier, need_level: 'summary', reason}]

    tier1_batch_id VARCHAR(100),
    tier1_completed_at TIMESTAMP,

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 2: Summary-Based Research
    -- ═══════════════════════════════════════════════════════════════════
    tier2_classification VARCHAR(30),
    -- 'unrelated' | 'justified' | 'burdensome' | 'needs_full_context'

    tier2_confidence REAL,
    tier2_reasoning TEXT,

    verbatim_requirements TEXT[],
    -- Extracted requirement text (document-level, not per-match)
    -- Replaces the old per-match verbatim_supporting_text concept

    severity INTEGER CHECK (severity >= 1 AND severity <= 10),
    severity_baseline INTEGER,
    severity_calculation TEXT,
    -- e.g., "Base 5 + no alternative (+2) - professional licensee (-1) = 6"

    argument_for_regulation TEXT,
    argument_against_regulation TEXT,

    context_used JSONB,
    -- Unified array of all context sources used in analysis
    -- See context_used schema below

    tier2_full_text_requests JSONB,
    -- Array of ContextRequest objects for Tier 3:
    -- [{context_type, identifier, need_level: 'full_text', reason}]

    needs_web_search BOOLEAN DEFAULT FALSE,
    web_search_topics TEXT[],

    -- Escalation flags for web search
    potentially_controversial BOOLEAN DEFAULT FALSE,
    -- True if affects vulnerable populations, civil rights, or has known advocacy concerns

    federal_mandate_suspected BOOLEAN DEFAULT FALSE,
    -- True if federal statute cited but state discretion unclear

    ambiguity_type VARCHAR(20),
    -- 'internal' | 'external' | 'both' | NULL
    -- Routing hint for needs_full_context cases:
    -- 'internal' = more state regulatory context needed → Tier 3
    -- 'external' = federal mandate verification needed → Skip to Tier 4
    -- 'both' = need Tier 3 then Tier 4

    tier2_batch_id VARCHAR(100),
    tier2_completed_at TIMESTAMP,

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 3: Full Context Deep Dive
    -- ═══════════════════════════════════════════════════════════════════
    tier3_classification VARCHAR(30),
    -- 'burdensome' | 'justified' | 'unrelated'
    -- Full classification (no 'unchanged' - Tier 3 always outputs final classification)

    tier3_confidence REAL,
    tier3_reasoning TEXT,

    tier3_severity_adjustment INTEGER CHECK (tier3_severity_adjustment >= -3 AND tier3_severity_adjustment <= 3),
    -- Adjustment after seeing full context (delta from Tier 2)

    tier3_severity_adjustment_reasoning TEXT,
    -- Explanation of the adjustment calculation

    tier3_batch_id VARCHAR(100),
    tier3_completed_at TIMESTAMP,

    -- ═══════════════════════════════════════════════════════════════════
    -- Tier 4: Web Search Validation
    -- ═══════════════════════════════════════════════════════════════════
    tier4_classification VARCHAR(30),
    -- 'burdensome' | 'justified' | 'unrelated'
    -- Full classification range - web search can change assessment in any direction

    tier4_severity_adjustment INTEGER CHECK (tier4_severity_adjustment >= -3 AND tier4_severity_adjustment <= 3),
    tier4_reasoning TEXT,
    web_search_summary TEXT,

    tier4_completed_at TIMESTAMP,
    -- No batch_id - Tier 4 uses real-time API

    -- ═══════════════════════════════════════════════════════════════════
    -- Final Derived Fields
    -- ═══════════════════════════════════════════════════════════════════
    requirement_found BOOLEAN,
    -- Derived: true for burdensome OR justified, false for unrelated

    is_justified BOOLEAN DEFAULT FALSE,
    -- Derived: true when classification is 'justified'

    is_verbatim BOOLEAN,
    -- Derived: all verbatim_requirements found in source document

    final_severity INTEGER,
    -- Derived: severity + tier3_adjustment + tier4_adjustment

    -- ═══════════════════════════════════════════════════════════════════
    -- Pipeline Tracking
    -- ═══════════════════════════════════════════════════════════════════
    pipeline_version VARCHAR(20) DEFAULT 'v4',
    highest_tier_completed INTEGER DEFAULT 0 CHECK (highest_tier_completed >= 0 AND highest_tier_completed <= 4),
    classification_tier INTEGER,
    -- Which tier made the final classification (1, 2, 3, or 4)

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(document_id, issue_type)
);
```

---

## context_used JSONB Schema

Unified array for all context sources used in analysis:

```jsonc
[
  {
    "type": "sibling | cross_reference | definition | hierarchy | self | web",
    "identifier": "citation or term",
    "source_id": 12345,           // Post-processed: links to source table
    "need_level": "summary | full_text",
    "quote": "verbatim text if relevant",
    "summary": "for summary-level context",
    "relevance": "how this affected the analysis",

    // For type='web' only (Tier 4):
    "url": "https://...",
    "title": "Page title",
    "source_type": "government | academic | journalism | advocacy",
    "publication_date": "2024-01-15",

    // For statute/mandate tracking:
    "is_mandate": true,
    "state_discretion": "none | partial | full"
  }
]
```

---

## Indexes

```sql
-- Classification filtering
CREATE INDEX idx_cia_tier1_classification ON compliance_issue_analyses(tier1_classification);
CREATE INDEX idx_cia_tier2_classification ON compliance_issue_analyses(tier2_classification);
CREATE INDEX idx_cia_tier3_classification ON compliance_issue_analyses(tier3_classification);

-- Pipeline workflow
CREATE INDEX idx_cia_needs_tier2 ON compliance_issue_analyses(id)
    WHERE tier1_classification = 'needs_research' AND tier2_classification IS NULL;

CREATE INDEX idx_cia_needs_tier3 ON compliance_issue_analyses(id)
    WHERE tier2_classification = 'needs_full_context' AND tier3_classification IS NULL;

-- Items needing Tier 4 (expanded escalation logic)
CREATE INDEX idx_cia_needs_tier4 ON compliance_issue_analyses(id)
    WHERE needs_web_search = true AND tier4_completed_at IS NULL;

-- JUSTIFIED items that need web search validation (prevent "Justified Trap")
CREATE INDEX idx_cia_justified_controversial ON compliance_issue_analyses(id)
    WHERE tier2_classification = 'justified'
      AND potentially_controversial = true
      AND tier4_completed_at IS NULL;

-- State and issue type queries
CREATE INDEX idx_cia_state_issue ON compliance_issue_analyses(state, issue_type);
CREATE INDEX idx_cia_document ON compliance_issue_analyses(document_id);

-- JSONB queries
CREATE INDEX idx_cia_context_used ON compliance_issue_analyses USING GIN (context_used);

-- Severity filtering
CREATE INDEX idx_cia_severity ON compliance_issue_analyses(final_severity)
    WHERE final_severity IS NOT NULL;
CREATE INDEX idx_cia_high_severity ON compliance_issue_analyses(id)
    WHERE final_severity >= 7;
```

---

## Original compliance_issues Table (Unchanged)

The existing `compliance_issues` table remains for individual regex matches:

| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK - referenced by tier1_relevant/dismissed_match_ids |
| document_id | bigint | FK to regulatory_documents |
| issue_type | varchar | |
| occurrence_number | integer | Multiple matches in same doc |
| regex_match_pattern | varchar | The regex that matched |
| regex_match_context | text | ±300 chars around match |
| url | text | |
| state | varchar | |
| created_at | timestamp | |

**Note:** Analysis fields (requirement_found, severity, etc.) move to `compliance_issue_analyses` for v4 pipeline. Legacy records retain their values.

---

## Migration Strategy

### Phase 1: Create New Table
```sql
CREATE TABLE compliance_issue_analyses (...);
```

### Phase 2: Group Existing Records
```sql
-- Create analysis records from grouped compliance_issues
INSERT INTO compliance_issue_analyses (
    document_id, issue_type, state, grouped_match_count, created_at
)
SELECT
    document_id,
    issue_type,
    state,
    COUNT(*) as grouped_match_count,
    MIN(created_at)
FROM compliance_issues
GROUP BY document_id, issue_type, state;
```

### Phase 3: Backfill Legacy Data
For records processed by legacy pipeline, copy analysis fields:
```sql
UPDATE compliance_issue_analyses cia
SET
    requirement_found = ci.requirement_found,
    final_severity = ci.severity,
    verbatim_requirements = ci.verbatim_supporting_text,
    pipeline_version = 'legacy',
    highest_tier_completed = 0
FROM compliance_issues ci
WHERE ci.document_id = cia.document_id
  AND ci.issue_type = cia.issue_type
  AND ci.requirement_found IS NOT NULL;
```

---

## Tier-by-Tier Field Mapping

### Tier 1: Match Filtering
| Field | Source | Notes |
|-------|--------|-------|
| tier1_relevant_match_ids | LLM output | Array of match IDs that passed |
| tier1_dismissed_match_ids | LLM output | Array of filtered out match IDs |
| tier1_dismissed_reasons | LLM output | JSONB array |
| tier1_classification | LLM output | 'all_false_positives' or 'needs_research' |
| tier1_confidence | LLM output | 0.0-1.0 |
| tier1_reasoning | LLM output | |
| tier1_context_requests | LLM output | Requests for Tier 2 |
| tier1_batch_id | Pipeline metadata | |
| tier1_completed_at | Pipeline metadata | |

### Tier 2: Summary Research
| Field | Source | Notes |
|-------|--------|-------|
| tier2_classification | LLM output | 'unrelated', 'justified', 'burdensome', 'needs_full_context' |
| tier2_confidence | LLM output | |
| tier2_reasoning | LLM output | |
| verbatim_requirements | LLM output | Document-level requirement text |
| severity | LLM output | |
| severity_baseline | LLM output | From issue config |
| severity_calculation | LLM output | Formula string |
| argument_for_regulation | LLM output | Steelman for |
| argument_against_regulation | LLM output | Steelman against |
| context_used | LLM output + post-processing | source_id populated later |
| tier2_full_text_requests | LLM output | Requests for Tier 3 |
| needs_web_search | LLM output | |
| web_search_topics | LLM output | |
| potentially_controversial | LLM output | Affects vulnerable populations, civil rights, known advocacy |
| federal_mandate_suspected | LLM output | Federal statute cited but state discretion unclear |
| ambiguity_type | LLM output | 'internal' (→Tier 3), 'external' (→Tier 4), 'both', or NULL |
| tier2_batch_id | Pipeline metadata | |
| tier2_completed_at | Pipeline metadata | |

### Tier 3: Full Context Deep Dive
| Field | Source | Notes |
|-------|--------|-------|
| tier3_classification | LLM output | `burdensome \| justified \| unrelated` |
| tier3_confidence | LLM output | |
| tier3_reasoning | LLM output | |
| tier3_severity_adjustment | LLM output | -3 to +3 (delta from Tier 2) |
| tier3_severity_adjustment_reasoning | LLM output | Explains adjustment calculation |
| context_used | LLM output (appended) | Full text context added |
| tier3_batch_id | Pipeline metadata | |
| tier3_completed_at | Pipeline metadata | |

### Tier 4: Web Search Validation
| Field | Source | Notes |
|-------|--------|-------|
| tier4_classification | LLM output | `burdensome \| justified \| unrelated` |
| tier4_severity_adjustment | LLM output | -3 to +3 |
| tier4_reasoning | LLM output | |
| web_search_summary | LLM output | |
| context_used | LLM output (appended) | Web sources added |
| tier4_completed_at | Pipeline metadata | Real-time API, no batch |

### Derived Fields (Post-Processing)
| Field | Derivation |
|-------|------------|
| requirement_found | True if final classification is 'burdensome' or 'justified' |
| is_justified | True if final classification is 'justified' |
| is_verbatim | are_all_verbatim(verbatim_requirements, document.content) |
| final_severity | severity + tier3_adjustment + tier4_adjustment |

---

## Design Decisions (v4)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | New `compliance_issue_analyses` table | Document-level analysis separate from per-match records |
| 2026-01-01 | 4-tier architecture | Progressive context disclosure with full-text tier before web |
| 2026-01-01 | Match grouping per (document, issue_type) | 19% API call reduction, natural deduplication |
| 2026-01-01 | Context requests in output | LLM requests what it needs, not pre-fetched |
| 2026-01-01 | `verbatim_requirements` array | Document-level, not per-match |
| 2026-01-01 | Separate tier3/tier4 adjustments | Full context and web search can each adjust severity |
| 2026-01-01 | Keep original compliance_issues table | Backwards compatibility, match-level data preserved |

---

## Column Counts

| Category | Count | Notes |
|----------|-------|-------|
| Match Grouping | 1 | grouped_match_count |
| Tier 1 | 10 | Including context_requests JSONB |
| Tier 2 | 17 | Including full_text_requests JSONB + escalation flags + ambiguity_type |
| Tier 3 | 7 | Including severity_adjustment_reasoning |
| Tier 4 | 5 | |
| Derived | 4 | |
| Tracking | 5 | |
| **Total New** | **49** | In compliance_issue_analyses |

---

## Related Documents

- [RESEARCH_PIPELINE_MODELS.md](./RESEARCH_PIPELINE_MODELS.md) - Pydantic models
- [MATCH_GROUPING.md](./MATCH_GROUPING.md) - Match grouping details
- [RESEARCH_PIPELINE_DESIGN.md](./RESEARCH_PIPELINE_DESIGN.md) - Full architecture
