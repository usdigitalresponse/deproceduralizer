# Barrier Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-tier LLM pipeline that analyzes regulatory sections for implementation complexity using a 14-category barrier framework, replacing the single-stage red flag pipeline.

**Architecture:** Two-tier Batch API pipeline. Tier 1 gets catalog-level context (sibling titles, hierarchy, definitions, cross-refs) and classifies sections. Tier 2 gets full context for promoted items, confirms/revises/discovers categories. Results stored in `barrier_analyses` + `barrier_issues` tables. Frontend adds a "Barrier" review tab reusing existing queue infrastructure.

**Tech Stack:** Python (Pydantic, psycopg2), Anthropic Batch API, PostgreSQL, Drizzle ORM, Next.js 15, nuqs

**Design doc:** `docs/plans/2026-02-15-barrier-pipeline-design.md`

---

## Multi-Agent Team Structure

This implementation is designed for **5 parallel agents** organized in 3 phases. Agents within a phase have zero file overlap and can run concurrently.

```
Phase 1 (parallel):
  Agent A: db-schema      — Migration SQL + Drizzle schemas
  Agent B: backend-models  — Python models, config, state machine
  Agent C: prompt-author   — prompts/barriers.yaml

Phase 2 (parallel, after Phase 1):
  Agent D: backend-pipeline — DB layer, tier runners, pipeline runner, CLI
  Agent E: frontend         — Repository, server actions, review tab

Phase 3 (sequential, after Phase 2):
  Lead: integration-test   — Wire everything, test run, documentation
```

### Agent boundaries (zero-overlap guarantee):

| Agent | Creates/Modifies | Never touches |
|-------|-----------------|---------------|
| A: db-schema | `migrations/0044_*.sql`, `schema/barrier-*.ts`, `schema/index.ts`, `schema/relations.ts` | `backend/`, `prompts/`, `components/`, `actions/` |
| B: backend-models | `backend/scripts/barrier_pipeline/{__init__,config,state_machine,formatting,prompt_loader}.py`, `models/` | `frontend/`, `prompts/`, `tiers/`, `db/`, `cli.py`, `pipeline_runner.py` |
| C: prompt-author | `prompts/barriers.yaml` | Everything else |
| D: backend-pipeline | `backend/scripts/barrier_pipeline/{cli,pipeline_runner}.py`, `tiers/`, `db/` | `frontend/`, `schema/`, `prompts/` |
| E: frontend | `repositories/barrier.repository.ts`, `actions/barrier.ts`, `constants/values.ts`, `types/regulation.ts`, `components/review/Barrier*.tsx`, `review/ReviewTypeTabs.tsx`, `[state]/review/page.tsx` | `backend/`, `prompts/`, `schema/` (reads only) |

---

## Phase 1: Foundation (3 agents, parallel)

### Task 1 (Agent A): Database Migration

**Files:**
- Create: `frontend/packages/database/migrations/0044_create_barrier_tables.sql`

**Step 1: Write migration SQL**

```sql
-- 0044_create_barrier_tables.sql
-- Barrier Pipeline: Two-tier regulatory implementation analysis

-- ═══════════════════════════════════════════════════════════════════
-- barrier_analyses: One row per document analyzed
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE barrier_analyses (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    state VARCHAR(2) NOT NULL,
    run_id VARCHAR(32),

    -- Tier 1: Catalog Context
    tier1_categories JSONB,
    tier1_has_issues BOOLEAN,
    tier1_classification VARCHAR(30),
    tier1_confidence REAL,
    tier1_context_requests JSONB,
    tier1_batch_id VARCHAR(100),
    tier1_completed_at TIMESTAMP,

    -- Tier 2: Full Context Confirmation
    tier2_categories JSONB,
    tier2_has_issues BOOLEAN,
    tier2_classification VARCHAR(30),
    tier2_confidence REAL,
    tier2_new_discoveries JSONB,
    tier2_context_used JSONB,
    tier2_batch_id VARCHAR(100),
    tier2_completed_at TIMESTAMP,

    -- Final Derived
    has_implementation_issues BOOLEAN,
    overall_complexity VARCHAR(10),
    summary TEXT,
    max_severity INTEGER,
    num_categories_found INTEGER,

    -- Pipeline Tracking
    highest_tier_completed INTEGER DEFAULT 0,
    pipeline_version VARCHAR(20),
    model_version VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT barrier_analyses_document_unique UNIQUE (document_id)
);

CREATE INDEX idx_barrier_analyses_state ON barrier_analyses(state);
CREATE INDEX idx_barrier_analyses_run_id ON barrier_analyses(run_id);
CREATE INDEX idx_barrier_analyses_tier_completed ON barrier_analyses(highest_tier_completed);

-- ═══════════════════════════════════════════════════════════════════
-- barrier_issues: One row per category finding per document
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE barrier_issues (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT NOT NULL REFERENCES barrier_analyses(id) ON DELETE CASCADE,
    document_id BIGINT NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'REGULATORY_COMPLEXITY',
        'POLICY_IMPLEMENTATION_SEPARATION',
        'CASCADE_OF_RIGIDITY',
        'MANDATED_STEPS_NOT_OUTCOMES',
        'ADMINISTRATIVE_BURDENS',
        'NO_FEEDBACK_LOOPS',
        'PROCESS_WORSHIP_OVERSIGHT',
        'ZERO_RISK_LANGUAGE',
        'FROZEN_TECHNOLOGY',
        'IMPLEMENTATION_OPPORTUNITY',
        'MISSING_OUTCOMES',
        'UNCLEAR_DELEGATION',
        'ACCESS_ASSUMPTION_BARRIERS',
        'INTERAGENCY_FRAGMENTATION'
    )),

    -- Analysis
    explanation TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    complexity VARCHAR(20) NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    matched_phrases TEXT[] DEFAULT '{}'::text[],
    implementation_approach TEXT,
    effort_estimate VARCHAR(255),
    text_examples TEXT[] DEFAULT '{}'::text[],

    -- Tier Tracking
    discovered_in_tier INTEGER NOT NULL CHECK (discovered_in_tier IN (1, 2)),
    confirmed_in_tier INTEGER,
    tier2_revised BOOLEAN DEFAULT FALSE,

    -- Human Review (same pattern as red_flags)
    review_status VARCHAR(50) DEFAULT 'unreviewed',
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    justification_notes TEXT,
    team_notes TEXT,
    priority INTEGER,
    impact_type VARCHAR(100),

    -- Developer Tracking (same pattern as red_flags)
    developer_status VARCHAR(50) DEFAULT 'unresolved',
    developer_assigned VARCHAR(50),
    developer_notes TEXT,
    resolution_type VARCHAR(50),
    resolution_comments TEXT,
    developer_question TEXT,
    developer_checked_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT barrier_issues_analysis_category_unique UNIQUE (analysis_id, category)
);

CREATE INDEX idx_barrier_issues_document ON barrier_issues(document_id);
CREATE INDEX idx_barrier_issues_category ON barrier_issues(category);
CREATE INDEX idx_barrier_issues_review_status ON barrier_issues(review_status);
CREATE INDEX idx_barrier_issues_severity ON barrier_issues(severity);
```

**Step 2: Run migration**

```bash
./scripts/db-query.sh "$(cat frontend/packages/database/migrations/0044_create_barrier_tables.sql)"
```

Expected: Tables created successfully.

**Step 3: Verify**

```bash
./scripts/db-query.sh describe barrier_analyses
./scripts/db-query.sh describe barrier_issues
```

---

### Task 2 (Agent A): Drizzle Schema — barrier-analyses.ts

**Files:**
- Create: `frontend/packages/database/src/schema/barrier-analyses.ts`

Write the Drizzle schema matching the migration exactly. Follow `compliance-issue-analyses.ts` pattern:

```typescript
import {
  pgTable, bigserial, bigint, varchar, text, boolean,
  timestamp, integer, real, jsonb, unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { regulatoryDocuments } from './regulatory-documents';

export const barrierAnalyses = pgTable('barrier_analyses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  state: varchar('state', { length: 2 }).notNull(),
  runId: varchar('run_id', { length: 32 }),

  // Tier 1
  tier1Categories: jsonb('tier1_categories'),
  tier1HasIssues: boolean('tier1_has_issues'),
  tier1Classification: varchar('tier1_classification', { length: 30 }),
  tier1Confidence: real('tier1_confidence'),
  tier1ContextRequests: jsonb('tier1_context_requests'),
  tier1BatchId: varchar('tier1_batch_id', { length: 100 }),
  tier1CompletedAt: timestamp('tier1_completed_at'),

  // Tier 2
  tier2Categories: jsonb('tier2_categories'),
  tier2HasIssues: boolean('tier2_has_issues'),
  tier2Classification: varchar('tier2_classification', { length: 30 }),
  tier2Confidence: real('tier2_confidence'),
  tier2NewDiscoveries: jsonb('tier2_new_discoveries'),
  tier2ContextUsed: jsonb('tier2_context_used'),
  tier2BatchId: varchar('tier2_batch_id', { length: 100 }),
  tier2CompletedAt: timestamp('tier2_completed_at'),

  // Final Derived
  hasImplementationIssues: boolean('has_implementation_issues'),
  overallComplexity: varchar('overall_complexity', { length: 10 }),
  summary: text('summary'),
  maxSeverity: integer('max_severity'),
  numCategoriesFound: integer('num_categories_found'),

  // Pipeline Tracking
  highestTierCompleted: integer('highest_tier_completed').default(0),
  pipelineVersion: varchar('pipeline_version', { length: 20 }),
  modelVersion: varchar('model_version', { length: 100 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueDocument: unique().on(table.documentId),
}));

export type BarrierAnalysis = typeof barrierAnalyses.$inferSelect;
export type NewBarrierAnalysis = typeof barrierAnalyses.$inferInsert;

// Classification types
export type BarrierTier1Classification = 'has_issues' | 'clean' | 'needs_context';
export type BarrierTier2Classification = 'confirmed' | 'revised' | 'dismissed';
```

---

### Task 3 (Agent A): Drizzle Schema — barrier-issues.ts

**Files:**
- Create: `frontend/packages/database/src/schema/barrier-issues.ts`

Follow `red-flags.ts` pattern for review/developer fields:

```typescript
import {
  pgTable, bigserial, bigint, varchar, text,
  integer, real, boolean, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { barrierAnalyses } from './barrier-analyses';
import { regulatoryDocuments } from './regulatory-documents';

export const BARRIER_CATEGORIES = [
  'REGULATORY_COMPLEXITY',
  'POLICY_IMPLEMENTATION_SEPARATION',
  'CASCADE_OF_RIGIDITY',
  'MANDATED_STEPS_NOT_OUTCOMES',
  'ADMINISTRATIVE_BURDENS',
  'NO_FEEDBACK_LOOPS',
  'PROCESS_WORSHIP_OVERSIGHT',
  'ZERO_RISK_LANGUAGE',
  'FROZEN_TECHNOLOGY',
  'IMPLEMENTATION_OPPORTUNITY',
  'MISSING_OUTCOMES',
  'UNCLEAR_DELEGATION',
  'ACCESS_ASSUMPTION_BARRIERS',
  'INTERAGENCY_FRAGMENTATION',
] as const;
export type BarrierCategory = typeof BARRIER_CATEGORIES[number];

export const BARRIER_CATEGORY_LABELS: Record<BarrierCategory, string> = {
  REGULATORY_COMPLEXITY: 'Regulatory Complexity',
  POLICY_IMPLEMENTATION_SEPARATION: 'Policy/Implementation Separation',
  CASCADE_OF_RIGIDITY: 'Cascade of Rigidity',
  MANDATED_STEPS_NOT_OUTCOMES: 'Mandated Steps, Not Outcomes',
  ADMINISTRATIVE_BURDENS: 'Administrative Burdens',
  NO_FEEDBACK_LOOPS: 'No Feedback Loops',
  PROCESS_WORSHIP_OVERSIGHT: 'Process Worship Oversight',
  ZERO_RISK_LANGUAGE: 'Zero-Risk Language',
  FROZEN_TECHNOLOGY: 'Frozen Technology',
  IMPLEMENTATION_OPPORTUNITY: 'Implementation Opportunity',
  MISSING_OUTCOMES: 'Missing Outcomes',
  UNCLEAR_DELEGATION: 'Unclear Delegation',
  ACCESS_ASSUMPTION_BARRIERS: 'Access/Assumption Barriers',
  INTERAGENCY_FRAGMENTATION: 'Interagency Fragmentation',
};

export const barrierIssues = pgTable('barrier_issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  analysisId: bigint('analysis_id', { mode: 'number' })
    .notNull()
    .references(() => barrierAnalyses.id, { onDelete: 'cascade' }),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(),

  // Analysis
  explanation: text('explanation').notNull(),
  severity: integer('severity').notNull(),
  complexity: varchar('complexity', { length: 20 }).notNull(),
  confidence: real('confidence').notNull(),
  matchedPhrases: text('matched_phrases').array().default(sql`'{}'`),
  implementationApproach: text('implementation_approach'),
  effortEstimate: varchar('effort_estimate', { length: 255 }),
  textExamples: text('text_examples').array().default(sql`'{}'`),

  // Tier Tracking
  discoveredInTier: integer('discovered_in_tier').notNull(),
  confirmedInTier: integer('confirmed_in_tier'),
  tier2Revised: boolean('tier2_revised').default(false),

  // Review fields (same as red_flags)
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  justificationNotes: text('justification_notes'),
  teamNotes: text('team_notes'),
  priority: integer('priority'),
  impactType: varchar('impact_type', { length: 100 }),

  // Developer fields (same as red_flags)
  developerStatus: varchar('developer_status', { length: 50 }).default('unresolved'),
  developerAssigned: varchar('developer_assigned', { length: 50 }),
  developerNotes: text('developer_notes'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionComments: text('resolution_comments'),
  developerQuestion: text('developer_question'),
  developerCheckedAt: timestamp('developer_checked_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueAnalysisCategory: unique().on(table.analysisId, table.category),
}));

export type BarrierIssue = typeof barrierIssues.$inferSelect;
export type NewBarrierIssue = typeof barrierIssues.$inferInsert;
```

---

### Task 4 (Agent A): Update schema exports and relations

**Files:**
- Modify: `frontend/packages/database/src/schema/index.ts`
- Modify: `frontend/packages/database/src/schema/relations.ts`

Add to `index.ts`:
```typescript
export * from './barrier-analyses';
export * from './barrier-issues';
```

Add to `relations.ts` (import barrierAnalyses and barrierIssues, add):
```typescript
export const barrierAnalysesRelations = relations(barrierAnalyses, ({ one, many }) => ({
  document: one(regulatoryDocuments, {
    fields: [barrierAnalyses.documentId],
    references: [regulatoryDocuments.id],
  }),
  issues: many(barrierIssues),
}));

export const barrierIssuesRelations = relations(barrierIssues, ({ one }) => ({
  analysis: one(barrierAnalyses, {
    fields: [barrierIssues.analysisId],
    references: [barrierAnalyses.id],
  }),
  document: one(regulatoryDocuments, {
    fields: [barrierIssues.documentId],
    references: [regulatoryDocuments.id],
  }),
}));
```

**Step: Verify TypeScript compiles**

```bash
cd frontend/packages/database && npx tsc --noEmit
```

**Step: Commit**

```bash
git add frontend/packages/database/migrations/0044_create_barrier_tables.sql \
  frontend/packages/database/src/schema/barrier-analyses.ts \
  frontend/packages/database/src/schema/barrier-issues.ts \
  frontend/packages/database/src/schema/index.ts \
  frontend/packages/database/src/schema/relations.ts
git commit -m "feat(db): add barrier_analyses and barrier_issues tables"
```

---

### Task 5 (Agent B): Backend config.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/__init__.py` (empty)
- Create: `backend/scripts/barrier_pipeline/config.py`

```python
"""Barrier Pipeline configuration and constants."""
from enum import Enum

PIPELINE_VERSION = "v1"
BATCH_MODEL = "claude-sonnet-4-5-20250929"
DEFAULT_MAX_SECTIONS = 100
TIER2_PROMOTION_CONFIDENCE_THRESHOLD = 0.9

class BarrierCategory(str, Enum):
    REGULATORY_COMPLEXITY = "REGULATORY_COMPLEXITY"
    POLICY_IMPLEMENTATION_SEPARATION = "POLICY_IMPLEMENTATION_SEPARATION"
    CASCADE_OF_RIGIDITY = "CASCADE_OF_RIGIDITY"
    MANDATED_STEPS_NOT_OUTCOMES = "MANDATED_STEPS_NOT_OUTCOMES"
    ADMINISTRATIVE_BURDENS = "ADMINISTRATIVE_BURDENS"
    NO_FEEDBACK_LOOPS = "NO_FEEDBACK_LOOPS"
    PROCESS_WORSHIP_OVERSIGHT = "PROCESS_WORSHIP_OVERSIGHT"
    ZERO_RISK_LANGUAGE = "ZERO_RISK_LANGUAGE"
    FROZEN_TECHNOLOGY = "FROZEN_TECHNOLOGY"
    IMPLEMENTATION_OPPORTUNITY = "IMPLEMENTATION_OPPORTUNITY"
    MISSING_OUTCOMES = "MISSING_OUTCOMES"
    UNCLEAR_DELEGATION = "UNCLEAR_DELEGATION"
    ACCESS_ASSUMPTION_BARRIERS = "ACCESS_ASSUMPTION_BARRIERS"
    INTERAGENCY_FRAGMENTATION = "INTERAGENCY_FRAGMENTATION"

VALID_CATEGORIES = [c.value for c in BarrierCategory]

# Categories that are NOT issues (positive findings)
OPPORTUNITY_CATEGORIES = {BarrierCategory.IMPLEMENTATION_OPPORTUNITY}
```

---

### Task 6 (Agent B): Backend models/processing.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/models/__init__.py` (empty)
- Create: `backend/scripts/barrier_pipeline/models/processing.py`

Follow `research_pipeline/models/matches.py` pattern:

```python
"""Barrier processing unit - the core data structure passed through the pipeline."""
from dataclasses import dataclass, field
from typing import Optional

from scripts.research_pipeline.models.context import ContextCatalog


@dataclass
class BarrierUnit:
    """One regulatory section being analyzed."""
    document_id: int
    citation: str
    title: str
    content: str
    state: str
    summary: Optional[str] = None
    url: Optional[str] = None
    hierarchy_level: Optional[str] = None
    parent_id: Optional[int] = None
    context_catalog: Optional[ContextCatalog] = None
```

---

### Task 7 (Agent B): Backend models/llm_outputs.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/models/llm_outputs.py`

```python
"""Pydantic models for LLM structured outputs."""
from typing import Optional, Literal
from pydantic import BaseModel, Field

from scripts.research_pipeline.models.context import ContextRequest
from ..config import BarrierCategory


class Tier1CategoryFinding(BaseModel):
    """A category identified in Tier 1."""
    category: BarrierCategory
    confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=1, le=10)
    complexity: Literal["HIGH", "MEDIUM", "LOW"]
    reasoning: str
    matched_phrases: list[str] = []


class Tier1Output(BaseModel):
    """Tier 1: Catalog context analysis output."""
    categories_found: list[Tier1CategoryFinding] = []
    classification: Literal["has_issues", "clean", "needs_context"]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    overall_complexity: Literal["HIGH", "MEDIUM", "LOW"]
    context_requests: list[ContextRequest] = []
    reasoning: str


class Tier2CategoryResult(BaseModel):
    """A category result from Tier 2 (confirmed, revised, or new)."""
    category: BarrierCategory
    status: Literal[
        "confirmed", "revised_up", "revised_down",
        "dismissed", "new_discovery"
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    severity: int = Field(ge=1, le=10)
    complexity: Literal["HIGH", "MEDIUM", "LOW"]
    explanation: str
    matched_phrases: list[str] = []
    implementation_approach: Optional[str] = None
    effort_estimate: Optional[str] = None
    text_examples: list[str] = []
    revision_reasoning: Optional[str] = None
    context_used: list[str] = []


class Tier2Output(BaseModel):
    """Tier 2: Full context confirmation output."""
    categories: list[Tier2CategoryResult] = []
    classification: Literal["confirmed", "revised", "dismissed"]
    overall_confidence: float = Field(ge=0.0, le=1.0)
    overall_complexity: Literal["HIGH", "MEDIUM", "LOW"]
    summary: str
    context_audit: list[dict] = []
```

---

### Task 8 (Agent B): Backend state_machine.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/state_machine.py`

Follow `research_pipeline/state_machine.py` (221 lines) but simpler (2 tiers):

```python
"""Barrier pipeline state machine - 2 tier states."""
from dataclasses import dataclass, field
from enum import auto, Enum
from typing import Optional

from .models.processing import BarrierUnit
from .models.llm_outputs import Tier1Output, Tier2Output
from scripts.research_pipeline.context_registry import ContextRegistry


class ProcessingState(Enum):
    PENDING = auto()
    TIER1_COMPLETE = auto()
    DONE_CLEAN = auto()
    TIER2_PENDING = auto()
    TIER2_COMPLETE = auto()
    DONE = auto()
    ERROR = auto()


@dataclass
class TrackedUnit:
    unit: BarrierUnit
    state: ProcessingState = ProcessingState.PENDING
    tier1_output: Optional[Tier1Output] = None
    tier2_output: Optional[Tier2Output] = None
    context_registry: Optional[ContextRegistry] = None
    tier1_batch_id: Optional[str] = None
    tier2_batch_id: Optional[str] = None
    error: Optional[str] = None

    @property
    def is_terminal(self) -> bool:
        return self.state in (
            ProcessingState.DONE_CLEAN,
            ProcessingState.DONE,
            ProcessingState.ERROR,
        )

    @property
    def needs_tier2(self) -> bool:
        return self.state == ProcessingState.TIER2_PENDING


def should_promote_to_tier2(
    tracked: TrackedUnit,
    confidence_threshold: float = 0.9,
) -> bool:
    """Determine if a Tier 1 result should be promoted to Tier 2."""
    if tracked.tier1_output is None:
        return False

    output = tracked.tier1_output

    if output.classification == "clean":
        return False

    if output.classification == "needs_context":
        return True

    # has_issues: promote if context requests or low confidence
    if output.context_requests:
        return True

    for cat in output.categories_found:
        if cat.confidence < confidence_threshold:
            return True

    return False
```

**Step: Commit**

```bash
git add backend/scripts/barrier_pipeline/
git commit -m "feat(barrier): add pipeline models, config, and state machine"
```

---

### Task 9 (Agent B): Backend prompt_loader.py and formatting.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/prompt_loader.py`
- Create: `backend/scripts/barrier_pipeline/formatting.py`

`prompt_loader.py` — loads from `prompts/barriers.yaml`, formats 3-layer prompts:

```python
"""Load and format Barrier prompts from YAML."""
from lib.prompts import load_prompt


def load_barrier_prompts() -> dict:
    """Load all Barrier prompt sections from prompts/barriers.yaml."""
    return {
        'tier1': load_prompt('barriers', 'tier1_analysis'),
        'tier2': load_prompt('barriers', 'tier2_analysis'),
    }
```

`formatting.py` — format context for prompts (sibling catalog, hierarchy, etc.):

```python
"""Format context data for Barrier prompts."""
from scripts.research_pipeline.models.context import ContextCatalog


def format_sibling_catalog(catalog: ContextCatalog) -> str:
    """Format sibling entries for the prompt."""
    if not catalog.siblings:
        return "No sibling sections available."

    lines = []
    for sib in catalog.siblings:
        summary_part = f" — {sib.summary}" if sib.summary else ""
        lines.append(f"  - {sib.citation}: {sib.title}{summary_part}")
    return "\n".join(lines)


def format_ancestor_chain(catalog: ContextCatalog) -> str:
    """Format the hierarchy path."""
    if not catalog.ancestors:
        return "No ancestor hierarchy available."

    lines = []
    for anc in catalog.ancestors:
        summary_part = f" — {anc.summary}" if anc.summary else ""
        lines.append(f"  {anc.hierarchy_level}: {anc.citation} {anc.title}{summary_part}")
    return "\n".join(lines)


def format_definitions(catalog: ContextCatalog) -> str:
    """Format available definition terms."""
    if not catalog.definitions:
        return "No definitions available."

    return ", ".join(d.term for d in catalog.definitions)


def format_crossrefs(catalog: ContextCatalog) -> str:
    """Format cross-reference summaries."""
    if not catalog.crossrefs:
        return "No cross-references found."

    lines = []
    for xref in catalog.crossrefs:
        summary_part = f" — {xref.summary}" if xref.summary else ""
        lines.append(f"  - {xref.citation}: {xref.title}{summary_part}")
    return "\n".join(lines)


def format_tier1_context(catalog: ContextCatalog, section_text: str, **kwargs) -> dict[str, str]:
    """Build the full context dict for Tier 1 prompt formatting."""
    return {
        'section_text': section_text,
        'citation': kwargs.get('citation', ''),
        'title': kwargs.get('title', ''),
        'summary': kwargs.get('summary', ''),
        'sibling_catalog': format_sibling_catalog(catalog),
        'ancestor_chain': format_ancestor_chain(catalog),
        'definition_terms': format_definitions(catalog),
        'cross_references': format_crossrefs(catalog),
    }
```

---

### Task 10 (Agent C): Prompts — prompts/barriers.yaml

**Files:**
- Create: `prompts/barriers.yaml`

This is the most research-intensive task. The prompt author must:

1. Read the existing `prompts/core.yaml` `red_flags_analysis` section for the current 12-category framework
2. Read the design doc taxonomy (14 categories with refined descriptions)
3. Read the 8 false positive examples from the design doc to understand what went wrong
4. Write the 3-layer prompt structure:

**Structure:**

```yaml
# prompts/barriers.yaml
# Barrier Pipeline: Two-Tier Regulatory Implementation Analysis
# Framework: 14-category barrier taxonomy
# See: docs/plans/2026-02-15-barrier-pipeline-design.md

tier1_analysis:
  updated_at: "2026-02-15"
  description: |
    Tier 1: Catalog-level context analysis. Evaluates a regulatory section
    against the 14-category barrier framework using sibling titles/summaries,
    hierarchy path, definitions, and cross-reference summaries.
    Classifies as clean/has_issues/needs_context.

  # Layer 1: Static core (cached globally across all batch requests)
  system: |
    You are an expert regulatory analyst... [14-category framework with
    examples, detection rules, proportionality instructions]...

    CRITICAL INSTRUCTIONS:
    - Safety-critical requirements (fire safety, background checks, caseload
      limits) are NOT automatically burdensome. Evaluate proportionality.
    - Just because a waiver exists doesn't dismiss a flag. Is the waiver
      itself reasonable and accessible?
    - Substantive eligibility criteria are NOT "mandated steps" even if
      procedural in form.
    - IMPLEMENTATION_OPPORTUNITY is a positive finding, not a problem.
    ...

  # Layer 2: Batch context (cached per subchapter)
  batch_context: |
    REGULATORY HIERARCHY:
    {ancestor_chain}

    SIBLING SECTIONS IN THIS SUBCHAPTER:
    {sibling_catalog}

    DEFINITION TERMS AVAILABLE:
    {definition_terms}

  # Layer 3: Document template (unique per section)
  template: |
    Analyze this regulatory section for implementation complexity issues.

    CITATION: {citation}
    TITLE: {title}
    SUMMARY: {summary}

    CROSS-REFERENCES:
    {cross_references}

    SECTION TEXT:
    {section_text}

    Respond with a JSON object matching the Tier1Output schema.

tier2_analysis:
  updated_at: "2026-02-15"
  description: |
    Tier 2: Full context confirmation. Reviews Tier 1 findings with
    fetched full context. Confirms, revises, dismisses, or discovers
    new categories.

  system: |
    You are an expert regulatory analyst performing deep context review...
    [Same 14-category framework]
    [Instructions for confirm/revise/dismiss/discover]
    [Waiver evaluation instructions]

  template: |
    TIER 1 FINDINGS TO REVIEW:
    {tier1_findings}

    ADDITIONAL CONTEXT FETCHED:
    {fetched_context}

    SECTION TEXT:
    {section_text}

    For each Tier 1 finding, confirm, revise, or dismiss with evidence.
    Also check for NEW categories only apparent with this additional context.

    Respond with a JSON object matching the Tier2Output schema.
```

**Key content for the system prompt (Agent C must write the full 14-category framework):**

Each category needs: description, detection signals, RED FLAG EXAMPLE, NOT A RED FLAG example, and severity guidance. Reference `prompts/core.yaml` lines 1-170 for the existing format.

The prompt author should also read `docs/plans/2026-02-15-barrier-pipeline-design.md` for the waiver evaluation principle and false positive analysis.

**Step: Commit**

```bash
git add prompts/barriers.yaml
git commit -m "feat(barrier): add tier 1 and tier 2 prompt templates"
```

---

## Phase 2: Pipeline Logic + Frontend (2 agents, parallel)

> **Dependency:** Phase 1 must be complete. Merge/rebase before starting Phase 2.

### Task 11 (Agent D): Backend db/document_queries.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/db/__init__.py` (empty)
- Create: `backend/scripts/barrier_pipeline/db/document_queries.py`

Fetches regulatory sections for analysis. Import from `lib.db`:

```python
"""Fetch regulatory sections for Barrier analysis."""
from lib.db import get_db_connection


def get_sections_for_analysis(
    state: str,
    title: int | None = None,
    limit: int | None = None,
    exclude_analyzed: bool = True,
) -> list[dict]:
    """Fetch section-level documents for Barrier analysis.

    Args:
        state: State code (ny, nj)
        title: Optional title number to filter by
        limit: Max sections to return
        exclude_analyzed: Skip sections that already have barrier_analyses rows
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            conditions = [
                "rd.state = %s",
                "rd.hierarchy_level = 'section'",
                "rd.content IS NOT NULL",
                "rd.exclude_from_analysis = false",
            ]
            params: list = [state.upper()]

            if title:
                conditions.append("rd.url LIKE %s")
                params.append(f"%/{title}/%")

            if exclude_analyzed:
                conditions.append(
                    "NOT EXISTS (SELECT 1 FROM barrier_analyses ja WHERE ja.document_id = rd.id)"
                )

            where = " AND ".join(conditions)
            limit_clause = f"LIMIT {limit}" if limit else ""

            cur.execute(f"""
                SELECT rd.id, rd.citation, rd.title, rd.content, rd.state,
                       rd.summary, rd.url, rd.hierarchy_level, rd.parent_id
                FROM regulatory_documents rd
                WHERE {where}
                ORDER BY rd.id
                {limit_clause}
            """, params)

            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]
    finally:
        conn.close()
```

---

### Task 12 (Agent D): Backend db/analysis_writer.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/db/analysis_writer.py`

```python
"""Write Barrier analysis results to database."""
from typing import Optional
from lib.db import get_db_connection
from ..state_machine import TrackedUnit, ProcessingState
from ..config import PIPELINE_VERSION, BATCH_MODEL, OPPORTUNITY_CATEGORIES
import json


def save_tier1_results(
    units: list[TrackedUnit],
    batch_id: str,
    run_id: str,
) -> int:
    """Save Tier 1 results. Creates or updates barrier_analyses rows."""
    conn = get_db_connection()
    saved = 0
    try:
        with conn.cursor() as cur:
            for tracked in units:
                if tracked.tier1_output is None:
                    continue

                output = tracked.tier1_output
                categories_json = json.dumps(
                    [c.model_dump() for c in output.categories_found]
                )
                context_requests_json = json.dumps(
                    [r.model_dump() for r in output.context_requests]
                )
                has_issues = any(
                    c.category not in OPPORTUNITY_CATEGORIES
                    for c in output.categories_found
                )

                cur.execute("""
                    INSERT INTO barrier_analyses (
                        document_id, state, run_id,
                        tier1_categories, tier1_has_issues, tier1_classification,
                        tier1_confidence, tier1_context_requests,
                        tier1_batch_id, tier1_completed_at,
                        highest_tier_completed, pipeline_version, model_version
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, NOW(),
                        1, %s, %s
                    )
                    ON CONFLICT (document_id) DO UPDATE SET
                        tier1_categories = EXCLUDED.tier1_categories,
                        tier1_has_issues = EXCLUDED.tier1_has_issues,
                        tier1_classification = EXCLUDED.tier1_classification,
                        tier1_confidence = EXCLUDED.tier1_confidence,
                        tier1_context_requests = EXCLUDED.tier1_context_requests,
                        tier1_batch_id = EXCLUDED.tier1_batch_id,
                        tier1_completed_at = NOW(),
                        highest_tier_completed = GREATEST(
                            barrier_analyses.highest_tier_completed, 1
                        ),
                        run_id = EXCLUDED.run_id,
                        updated_at = NOW()
                    RETURNING id
                """, (
                    tracked.unit.document_id,
                    tracked.unit.state,
                    run_id,
                    categories_json,
                    has_issues,
                    output.classification,
                    output.overall_confidence,
                    context_requests_json,
                    batch_id,
                    PIPELINE_VERSION,
                    BATCH_MODEL,
                ))
                saved += 1

        conn.commit()
    finally:
        conn.close()

    return saved


def save_tier2_results(
    units: list[TrackedUnit],
    batch_id: str,
    run_id: str,
) -> int:
    """Save Tier 2 results. Updates barrier_analyses and inserts barrier_issues."""
    conn = get_db_connection()
    saved = 0
    try:
        with conn.cursor() as cur:
            for tracked in units:
                if tracked.tier2_output is None:
                    continue

                output = tracked.tier2_output
                categories_json = json.dumps(
                    [c.model_dump() for c in output.categories]
                )
                new_discoveries = [
                    c.model_dump() for c in output.categories
                    if c.status == "new_discovery"
                ]
                active_categories = [
                    c for c in output.categories
                    if c.status != "dismissed"
                ]
                has_issues = any(
                    c.category not in OPPORTUNITY_CATEGORIES
                    for c in active_categories
                )
                max_severity = max(
                    (c.severity for c in active_categories), default=None
                )

                # Update analysis row
                cur.execute("""
                    UPDATE barrier_analyses SET
                        tier2_categories = %s,
                        tier2_has_issues = %s,
                        tier2_classification = %s,
                        tier2_confidence = %s,
                        tier2_new_discoveries = %s,
                        tier2_context_used = %s,
                        tier2_batch_id = %s,
                        tier2_completed_at = NOW(),
                        has_implementation_issues = %s,
                        overall_complexity = %s,
                        summary = %s,
                        max_severity = %s,
                        num_categories_found = %s,
                        highest_tier_completed = 2,
                        updated_at = NOW()
                    WHERE document_id = %s
                    RETURNING id
                """, (
                    categories_json,
                    has_issues,
                    output.classification,
                    output.overall_confidence,
                    json.dumps(new_discoveries),
                    json.dumps(output.context_audit),
                    batch_id,
                    has_issues,
                    output.overall_complexity,
                    output.summary,
                    max_severity,
                    len(active_categories),
                    tracked.unit.document_id,
                ))

                row = cur.fetchone()
                if not row:
                    continue
                analysis_id = row[0]

                # Insert issue rows (one per active category)
                for cat in active_categories:
                    cur.execute("""
                        INSERT INTO barrier_issues (
                            analysis_id, document_id, category,
                            explanation, severity, complexity, confidence,
                            matched_phrases, implementation_approach,
                            effort_estimate, text_examples,
                            discovered_in_tier, confirmed_in_tier, tier2_revised
                        ) VALUES (
                            %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s
                        )
                        ON CONFLICT (analysis_id, category) DO UPDATE SET
                            explanation = EXCLUDED.explanation,
                            severity = EXCLUDED.severity,
                            complexity = EXCLUDED.complexity,
                            confidence = EXCLUDED.confidence,
                            matched_phrases = EXCLUDED.matched_phrases,
                            implementation_approach = EXCLUDED.implementation_approach,
                            effort_estimate = EXCLUDED.effort_estimate,
                            text_examples = EXCLUDED.text_examples,
                            confirmed_in_tier = EXCLUDED.confirmed_in_tier,
                            tier2_revised = EXCLUDED.tier2_revised,
                            updated_at = NOW()
                    """, (
                        analysis_id,
                        tracked.unit.document_id,
                        cat.category.value if hasattr(cat.category, 'value') else cat.category,
                        cat.explanation,
                        cat.severity,
                        cat.complexity,
                        cat.confidence,
                        cat.matched_phrases,
                        cat.implementation_approach,
                        cat.effort_estimate,
                        cat.text_examples,
                        1 if cat.status != "new_discovery" else 2,
                        2,
                        cat.status in ("revised_up", "revised_down"),
                    ))

                saved += 1

        conn.commit()
    finally:
        conn.close()

    return saved
```

---

### Task 13 (Agent D): Backend db/analysis_reader.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/db/analysis_reader.py`

```python
"""Read existing Barrier analyses for resume capability."""
from lib.db import get_db_connection


def get_existing_analyses(
    document_ids: list[int],
) -> dict[int, dict]:
    """Get existing analyses keyed by document_id, for resume."""
    if not document_ids:
        return {}

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT document_id, highest_tier_completed,
                       tier1_classification, tier1_categories,
                       tier1_context_requests
                FROM barrier_analyses
                WHERE document_id = ANY(%s)
            """, (document_ids,))
            columns = [desc[0] for desc in cur.description]
            return {
                row[0]: dict(zip(columns, row))
                for row in cur.fetchall()
            }
    finally:
        conn.close()
```

---

### Task 14 (Agent D): Backend tiers/tier1_runner.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/tiers/__init__.py` (empty)
- Create: `backend/scripts/barrier_pipeline/tiers/tier1_runner.py`

Follows `research_pipeline/tiers/tier1_runner.py` pattern. Key imports from research_pipeline:

```python
"""Tier 1: Catalog Context analysis."""
from ..state_machine import TrackedUnit
from ..models.llm_outputs import Tier1Output
from ..prompt_loader import load_barrier_prompts
from ..formatting import format_tier1_context
from ..config import BATCH_MODEL
from scripts.research_pipeline.context import (
    build_context_catalog,
    group_for_cache_efficiency,
)
from lib.batch import format_batch_request


def prepare_tier1_batch(
    units: list[TrackedUnit],
    context_cache: dict | None = None,
) -> tuple[list[dict], dict[int, str]]:
    """Prepare batch requests for Tier 1.

    Returns:
        (batch_requests, custom_id_map) where custom_id_map maps
        custom_id -> document_id for result correlation.
    """
    prompts = load_barrier_prompts()
    tier1_config = prompts['tier1']

    # Build context catalogs for all documents
    doc_ids = [u.unit.document_id for u in units]
    catalogs = build_context_catalog(doc_ids)

    batch_requests = []
    custom_id_map = {}

    for tracked in units:
        doc_id = tracked.unit.document_id
        catalog = catalogs.get(doc_id)
        if catalog is None:
            continue

        tracked.unit.context_catalog = catalog

        # Format context for prompt
        context_vars = format_tier1_context(
            catalog,
            tracked.unit.content,
            citation=tracked.unit.citation,
            title=tracked.unit.title,
            summary=tracked.unit.summary or '',
        )

        # Build batch context (per-subchapter, cached)
        batch_context = tier1_config.get('batch_context', '').format(**context_vars)

        # Build user message (per-section)
        user_message = tier1_config['template'].format(**context_vars)

        custom_id = f"barrier-t1-{doc_id}"
        custom_id_map[custom_id] = doc_id

        request = format_batch_request(
            custom_id=custom_id,
            model=BATCH_MODEL,
            system=tier1_config['system'] + "\n\n" + batch_context,
            user_message=user_message,
            response_format=Tier1Output,
        )
        batch_requests.append(request)

    return batch_requests, custom_id_map
```

---

### Task 15 (Agent D): Backend tiers/tier2_runner.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/tiers/tier2_runner.py`

Similar structure to tier1, but:
- Fetches full context based on Tier 1 context_requests
- Includes Tier 1 findings in the prompt
- Uses `fetch_summaries_for_requests()` and `build_proactive_context()` from research_pipeline

```python
"""Tier 2: Full Context Confirmation."""
import json
from ..state_machine import TrackedUnit
from ..models.llm_outputs import Tier2Output
from ..prompt_loader import load_barrier_prompts
from ..config import BATCH_MODEL
from scripts.research_pipeline.context import (
    fetch_summaries_for_requests,
    build_proactive_context,
)
from lib.batch import format_batch_request


def prepare_tier2_batch(
    units: list[TrackedUnit],
) -> tuple[list[dict], dict[int, str]]:
    """Prepare batch requests for Tier 2."""
    prompts = load_barrier_prompts()
    tier2_config = prompts['tier2']

    batch_requests = []
    custom_id_map = {}

    for tracked in units:
        if tracked.tier1_output is None:
            continue

        doc_id = tracked.unit.document_id

        # Fetch requested context from Tier 1
        fetched_context = ""
        if tracked.tier1_output.context_requests:
            summaries = fetch_summaries_for_requests(
                tracked.tier1_output.context_requests
            )
            fetched_context = "\n".join(
                f"- {s['identifier']}: {s['summary']}"
                for s in summaries
            )

        # Proactive context (waivers, alternatives nearby)
        proactive = build_proactive_context(
            tracked.unit.document_id,
            tracked.unit.context_catalog,
        )
        if proactive:
            fetched_context += "\n\nPROACTIVE CONTEXT:\n" + proactive

        # Format Tier 1 findings
        tier1_findings = json.dumps(
            [c.model_dump() for c in tracked.tier1_output.categories_found],
            indent=2,
        )

        user_message = tier2_config['template'].format(
            tier1_findings=tier1_findings,
            fetched_context=fetched_context or "No additional context fetched.",
            section_text=tracked.unit.content,
            citation=tracked.unit.citation,
            title=tracked.unit.title,
        )

        custom_id = f"barrier-t2-{doc_id}"
        custom_id_map[custom_id] = doc_id

        request = format_batch_request(
            custom_id=custom_id,
            model=BATCH_MODEL,
            system=tier2_config['system'],
            user_message=user_message,
            response_format=Tier2Output,
        )
        batch_requests.append(request)

    return batch_requests, custom_id_map
```

---

### Task 16 (Agent D): Backend pipeline_runner.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/pipeline_runner.py`

Main orchestrator. Follow `research_pipeline/pipeline_runner.py` but simpler (2 tiers):

```python
"""Barrier Pipeline runner - orchestrates two-tier analysis."""
import uuid
from tqdm import tqdm

from .state_machine import TrackedUnit, ProcessingState, should_promote_to_tier2
from .models.processing import BarrierUnit
from .db.document_queries import get_sections_for_analysis
from .db.analysis_writer import save_tier1_results, save_tier2_results
from .db.analysis_reader import get_existing_analyses
from .tiers.tier1_runner import prepare_tier1_batch
from .tiers.tier2_runner import prepare_tier2_batch
from .config import DEFAULT_MAX_SECTIONS
from scripts.research_pipeline.cost_tracker import CostTracker
from lib.batch import BatchManager


def run_pipeline(
    state: str,
    title: int | None = None,
    limit: int | None = DEFAULT_MAX_SECTIONS,
    max_tier: int = 2,
    tier2_only: bool = False,
    dry_run: bool = True,
) -> dict:
    """Run the Barrier two-tier pipeline.

    Returns summary dict with counts and cost.
    """
    run_id = uuid.uuid4().hex[:12]
    cost_tracker = CostTracker()

    # Fetch sections
    sections = get_sections_for_analysis(
        state=state,
        title=title,
        limit=limit,
        exclude_analyzed=not tier2_only,
    )

    if not sections:
        print("No sections found for analysis.")
        return {"sections": 0}

    print(f"\nFound {len(sections)} sections for analysis")
    print(f"Run ID: {run_id}")
    print(f"Max tier: {max_tier}")

    if dry_run:
        print("\n[DRY RUN] Would analyze these sections. Use --execute to run.")
        return {"sections": len(sections), "dry_run": True}

    # Build tracked units
    units = [
        TrackedUnit(unit=BarrierUnit(
            document_id=s['id'],
            citation=s['citation'] or '',
            title=s['title'] or '',
            content=s['content'],
            state=s['state'],
            summary=s.get('summary'),
            url=s.get('url'),
            hierarchy_level=s.get('hierarchy_level'),
            parent_id=s.get('parent_id'),
        ))
        for s in sections
    ]

    # Resume: check existing analyses
    if tier2_only:
        existing = get_existing_analyses([u.unit.document_id for u in units])
        for tracked in units:
            doc_id = tracked.unit.document_id
            if doc_id in existing and existing[doc_id]['highest_tier_completed'] >= 1:
                tracked.state = ProcessingState.TIER2_PENDING
            else:
                tracked.state = ProcessingState.ERROR
                tracked.error = "No Tier 1 results found for tier2-only mode"

    # ═══ TIER 1 ═══
    if not tier2_only:
        print("\n=== TIER 1: Catalog Context ===")
        tier1_units = [u for u in units if u.state == ProcessingState.PENDING]

        if tier1_units:
            batch_requests, id_map = prepare_tier1_batch(tier1_units)
            print(f"Submitting {len(batch_requests)} Tier 1 batch requests...")

            manager = BatchManager()
            results = manager.submit_and_wait(batch_requests)

            # Process results
            doc_id_to_unit = {u.unit.document_id: u for u in tier1_units}
            for custom_id, result in results.items():
                doc_id = id_map.get(custom_id)
                if doc_id and doc_id in doc_id_to_unit:
                    tracked = doc_id_to_unit[doc_id]
                    tracked.tier1_output = result
                    tracked.tier1_batch_id = manager.batch_id
                    tracked.state = ProcessingState.TIER1_COMPLETE

            # Save Tier 1 results
            saved = save_tier1_results(tier1_units, manager.batch_id, run_id)
            print(f"Saved {saved} Tier 1 results")

            # Promote
            for tracked in tier1_units:
                if tracked.state == ProcessingState.TIER1_COMPLETE:
                    if should_promote_to_tier2(tracked):
                        tracked.state = ProcessingState.TIER2_PENDING
                    else:
                        tracked.state = ProcessingState.DONE_CLEAN

            clean = sum(1 for u in tier1_units if u.state == ProcessingState.DONE_CLEAN)
            promoted = sum(1 for u in tier1_units if u.state == ProcessingState.TIER2_PENDING)
            print(f"Clean: {clean}, Promoted to Tier 2: {promoted}")

    if max_tier < 2:
        print("\n[max-tier 1] Stopping after Tier 1.")
        return _build_summary(units, cost_tracker)

    # ═══ TIER 2 ═══
    tier2_units = [u for u in units if u.state == ProcessingState.TIER2_PENDING]
    if not tier2_units:
        print("\nNo sections need Tier 2 analysis.")
        return _build_summary(units, cost_tracker)

    print(f"\n=== TIER 2: Full Context Confirmation ({len(tier2_units)} sections) ===")
    batch_requests, id_map = prepare_tier2_batch(tier2_units)
    print(f"Submitting {len(batch_requests)} Tier 2 batch requests...")

    manager = BatchManager()
    results = manager.submit_and_wait(batch_requests)

    # Process Tier 2 results
    doc_id_to_unit = {u.unit.document_id: u for u in tier2_units}
    for custom_id, result in results.items():
        doc_id = id_map.get(custom_id)
        if doc_id and doc_id in doc_id_to_unit:
            tracked = doc_id_to_unit[doc_id]
            tracked.tier2_output = result
            tracked.tier2_batch_id = manager.batch_id
            tracked.state = ProcessingState.DONE

    # Save Tier 2 results
    saved = save_tier2_results(tier2_units, manager.batch_id, run_id)
    print(f"Saved {saved} Tier 2 results ({sum(1 for u in tier2_units if u.state == ProcessingState.DONE)} completed)")

    return _build_summary(units, cost_tracker)


def _build_summary(units: list[TrackedUnit], cost_tracker: CostTracker) -> dict:
    """Build pipeline run summary."""
    return {
        "total": len(units),
        "clean": sum(1 for u in units if u.state == ProcessingState.DONE_CLEAN),
        "completed": sum(1 for u in units if u.state == ProcessingState.DONE),
        "errors": sum(1 for u in units if u.state == ProcessingState.ERROR),
    }
```

---

### Task 17 (Agent D): Backend cli.py

**Files:**
- Create: `backend/scripts/barrier_pipeline/cli.py`

```python
"""Barrier Pipeline CLI entry point."""
import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / '.env')

from .pipeline_runner import run_pipeline


def main():
    parser = argparse.ArgumentParser(
        description='Barrier: Two-tier regulatory implementation analysis',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run (default)
  python3 -m scripts.barrier_pipeline.cli --state ny --title 18

  # Execute
  python3 -m scripts.barrier_pipeline.cli --state ny --title 18 --execute

  # Tier 1 only
  python3 -m scripts.barrier_pipeline.cli --state ny --execute --max-tier 1

  # Tier 2 on existing
  python3 -m scripts.barrier_pipeline.cli --state ny --title 18 --execute --tier2-only
        """,
    )

    parser.add_argument('--state', '-s', required=True, choices=['ny', 'nj'])
    parser.add_argument('--title', '-t', type=int, help='Title number to filter')
    parser.add_argument('--limit', '-l', type=int, default=100,
                        help='Max sections (default: 100)')
    parser.add_argument('--execute', action='store_true',
                        help='Actually run (default is dry-run)')
    parser.add_argument('--max-tier', type=int, default=2, choices=[1, 2],
                        help='Stop after this tier (default: 2)')
    parser.add_argument('--tier2-only', action='store_true',
                        help='Run Tier 2 on existing Tier 1 results')
    parser.add_argument('--all-sections', action='store_true',
                        help='Include all sections (not just unanalyzed)')

    args = parser.parse_args()

    result = run_pipeline(
        state=args.state,
        title=args.title,
        limit=args.limit,
        max_tier=args.max_tier,
        tier2_only=args.tier2_only,
        dry_run=not args.execute,
    )

    print(f"\n{'=' * 60}")
    print(f"PIPELINE SUMMARY")
    print(f"{'=' * 60}")
    for key, value in result.items():
        print(f"  {key}: {value}")


if __name__ == '__main__':
    main()
```

**Step: Commit all Phase 2 Agent D work**

```bash
git add backend/scripts/barrier_pipeline/db/ backend/scripts/barrier_pipeline/tiers/ \
  backend/scripts/barrier_pipeline/pipeline_runner.py \
  backend/scripts/barrier_pipeline/cli.py
git commit -m "feat(barrier): add pipeline runner, tier runners, DB layer, and CLI"
```

---

### Task 18 (Agent E): Frontend — Constants and types

**Files:**
- Modify: `frontend/apps/web/src/lib/constants/values.ts`
- Modify: `frontend/apps/web/src/types/regulation.ts` (if review type labels are defined there)

Add `'barriers'` to `REVIEW_TYPE_VALUES`:

```typescript
export const REVIEW_TYPE_VALUES = ['flags', 'compliance', 'definitions', 'needs_info', 'barriers'] as const;
```

Update label mapping in `regulation.ts` (wherever `REVIEW_TYPES` maps values to labels):

```typescript
barrier: 'Barrier',
```

---

### Task 19 (Agent E): Frontend — Repository

**Files:**
- Create: `frontend/packages/database/src/repositories/barrier.repository.ts`

Follow the red-flags repository pattern. Key queries:
- `getPaginated()` - Join barrier_issues with barrier_analyses + regulatory_documents
- `getStatusCounts()` - Aggregate by review_status
- `getCategories()` - Distinct categories
- `updateReview()` - Update review fields on barrier_issues

```typescript
import 'server-only';
import { db } from '../client';
import { barrierIssues, barrierAnalyses } from '../schema';
import { regulatoryDocuments } from '../schema';
import { eq, and, sql, count, desc, asc } from 'drizzle-orm';

export class BarrierRepository {
  // Implement following red-flags.repository.ts patterns
  // JOIN: barrier_issues → barrier_analyses → regulatory_documents
}
```

Update `frontend/packages/database/src/repositories/index.ts` to export.

---

### Task 20 (Agent E): Frontend — Server actions

**Files:**
- Create: `frontend/apps/web/src/lib/actions/barrier.ts`

```typescript
'use server';
import 'server-only';
// Server actions following the red-flags.ts pattern
```

---

### Task 21 (Agent E): Frontend — ReviewTypeTabs update

**Files:**
- Modify: `frontend/apps/web/src/components/review/ReviewTypeTabs.tsx`

Add Barrier tab with count badge. The tab component reads from `REVIEW_TYPES` so adding to `values.ts` should auto-populate, but verify the count fetching in the review page.

---

### Task 22 (Agent E): Frontend — Review page routing

**Files:**
- Modify: `frontend/apps/web/src/app/[state]/review/page.tsx`

Add `barrier` case to the review type switch. Fetch Barrier counts in parallel with existing counts.

---

### Task 23 (Agent E): Frontend — Queue + Card components

**Files:**
- Create: `frontend/apps/web/src/components/review/BarrierQueue.tsx`
- Create: `frontend/apps/web/src/components/review/BarrierCard.tsx`

Follow `ComplianceReviewQueue.tsx` and `ReviewCard.tsx` patterns. Barrier-specific additions:
- Category badge with `BARRIER_CATEGORY_LABELS` mapping
- Tier tracking (discovered_in_tier, confirmed_in_tier, tier2_revised)
- Confidence display
- Severity badge

**Step: Verify TypeScript + build**

```bash
cd frontend/packages/database && npx tsc --noEmit
cd frontend && pnpm build
```

**Step: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add Barrier review tab with queue and card components"
```

---

## Phase 3: Integration + Documentation

### Task 24: Integration test — dry run

```bash
cd backend && python3 -m scripts.barrier_pipeline.cli --state ny --title 18
```

Expected: Shows section count and cost estimate, no execution.

### Task 25: Integration test — small Tier 1 run

**IMPORTANT: Ask user permission before running (costs money).**

```bash
cd backend && python3 -m scripts.barrier_pipeline.cli --state ny --title 18 --execute --limit 20 --max-tier 1
```

Verify:
- `./scripts/db-query.sh "SELECT COUNT(*) FROM barrier_analyses WHERE highest_tier_completed >= 1"`
- `./scripts/db-query.sh "SELECT tier1_classification, COUNT(*) FROM barrier_analyses GROUP BY tier1_classification"`

### Task 26: Integration test — full 2-tier run

```bash
cd backend && python3 -m scripts.barrier_pipeline.cli --state ny --title 18 --execute --limit 20
```

Verify:
- `./scripts/db-query.sh "SELECT COUNT(*) FROM barrier_issues"`
- `./scripts/db-query.sh "SELECT category, COUNT(*) FROM barrier_issues GROUP BY category ORDER BY count DESC"`

### Task 27: Quality check — compare with legacy

```sql
-- Compare Barrier vs legacy red flags for same documents
SELECT ja.document_id, rd.title,
       ja.num_categories_found as barrier_count,
       a.num_flags as legacy_count,
       ja.overall_complexity, a.overall_complexity as legacy_complexity
FROM barrier_analyses ja
JOIN regulatory_documents rd ON ja.document_id = rd.id
LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
ORDER BY ja.num_categories_found DESC
LIMIT 20;
```

### Task 28: Frontend smoke test

```bash
cd frontend/apps/web && pnpm test:e2e
```

Visit `/ny/review?type=barrier` and verify the tab renders with issue cards.

### Task 29: Documentation updates

**Files:**
- Modify: `docs/OPERATIONS.md` — Add Barrier pipeline commands
- Modify: `.claude/skills/database/schema.md` — Add barrier_analyses and barrier_issues tables
- Modify: `.claude/skills/pipeline/SKILL.md` — Add Barrier pipeline reference
- Create: `.claude/skills/barrier-pipeline/SKILL.md` — Barrier pipeline skill file
- Modify: `frontend/apps/web/STYLE_GUIDE.md` — Add Barrier card/queue patterns if new components added

**Step: Final commit**

```bash
git add docs/ .claude/skills/ frontend/apps/web/STYLE_GUIDE.md
git commit -m "docs: add Barrier pipeline documentation and skill files"
```

---

## Execution Approach

Two options for implementing this plan:

**1. Subagent-Driven (same session)** — Leader dispatches fresh agents per task, reviews between tasks, fast iteration. Best when you want tight oversight and can stay in the session.

**2. Parallel Session (separate)** — Open a new session with `executing-plans` skill, batch execution with review checkpoints. Best for longer unattended runs.

---

## Verification Checklist

- [ ] Migration applied: `./scripts/db-query.sh describe barrier_analyses`
- [ ] Migration applied: `./scripts/db-query.sh describe barrier_issues`
- [ ] TypeScript: `cd frontend/packages/database && npx tsc --noEmit`
- [ ] Build: `cd frontend && pnpm build`
- [ ] Dry run: `python3 -m scripts.barrier_pipeline.cli --state ny --title 18`
- [ ] Tier 1 run: 20 sections with results in DB
- [ ] Tier 2 run: promoted sections with issues in DB
- [ ] Frontend: `/ny/review?type=barrier` renders
- [ ] Smoke tests: `cd frontend/apps/web && pnpm test:e2e`
- [ ] Docs updated: OPERATIONS.md, schema.md, pipeline skill, barrier skill
