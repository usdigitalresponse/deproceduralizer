# Tag Analytics & Cross-Domain Exploration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified Tag Analytics page (`/[state]/tags`) with cross-domain tag visualizations, a shared TagDrawer for in-context tag exploration, and clickable tags across every detail page in the application.

**Architecture:** A `TagsRepository` queries across 5 database domains (regulations, guidance, fines, compliance, JenAI) using UNION ALL and cross-domain JOINs. Server actions cache results. The frontend is a new `/[state]/tags` page with 4 sub-tabs (Overview, Connections, Correlations, Readability). A `TagDrawer` component provides quick-peek tag details from any page. Existing tag displays are wrapped with `ClickableTag` for interactivity.

**Tech Stack:** Next.js 15, Drizzle ORM, PostgreSQL (pg_trgm), nuqs (URL state), @nivo/chord, @nivo/sankey, react-force-graph-2d, @visx/hierarchy, D3

**Spec:** `docs/superpowers/specs/2026-03-15-tag-analytics-design.md`

---

## Chunk 1: Shared Contracts

These files define the interfaces all workstreams build against. Must be merged to main before parallel work begins.

### Task 1: Tag Constants & Type Definitions

**Files:**
- Create: `frontend/apps/web/src/lib/constants/tags.ts`

- [ ] **Step 1: Create tag constants file**

```typescript
// frontend/apps/web/src/lib/constants/tags.ts

// --- Tag Domains ---
export const TAG_DOMAINS = ['regulation', 'guidance', 'fines', 'compliance', 'jenai'] as const;
export type TagDomain = (typeof TAG_DOMAINS)[number];

export const TAG_DOMAIN_LABELS: Record<TagDomain, string> = {
  regulation: 'Regulations',
  guidance: 'Guidance',
  fines: 'Fines & Fees',
  compliance: 'Compliance Issues',
  jenai: 'JenAI Findings',
};

export const TAG_DOMAIN_COLORS: Record<TagDomain, string> = {
  regulation: 'bg-indigo-100 text-indigo-800',
  guidance: 'bg-amber-100 text-amber-800',
  fines: 'bg-rose-100 text-rose-800',
  compliance: 'bg-emerald-100 text-emerald-800',
  jenai: 'bg-violet-100 text-violet-800',
};

// --- Tag Types ---
export const TAG_TYPES = ['structured', 'free_text', 'issue_type', 'boolean'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const TAG_TYPE_LABELS: Record<TagType, string> = {
  structured: 'Structured',
  free_text: 'Free Text',
  issue_type: 'Issue Type',
  boolean: 'Boolean',
};

// --- Tag Field Registry ---
// Central registry of all tag fields. Each workstream imports from here.
export interface TagFieldMeta {
  field: string;
  label: string;
  domain: TagDomain;
  type: TagType;
  table: string;          // DB table name
  column: string;         // DB column name
  isArray: boolean;       // text[] vs scalar
  values?: readonly string[];  // known enum values (undefined = free-text)
}

export const TAG_FIELDS: TagFieldMeta[] = [
  // Structured enums — Regulations
  { field: 'reg_section_type', label: 'Section Type (Reg)', domain: 'regulation', type: 'structured', table: 'regulatory_documents', column: 'section_type', isArray: false, values: ['definitions','requirements','procedures','prohibitions','standards','eligibility','penalties','fees','forms','reporting','purpose','scope','exemptions','reserved','other'] },
  // Structured enums — Guidance
  { field: 'guid_section_type', label: 'Section Type (Guidance)', domain: 'guidance', type: 'structured', table: 'guidance_documents', column: 'section_type', isArray: false, values: ['definitions','requirements','procedures','prohibitions','standards','eligibility','penalties','fees','forms','reporting','purpose','scope','exemptions','reserved','other'] },
  { field: 'policy_category', label: 'Policy Category', domain: 'guidance', type: 'structured', table: 'guidance_documents', column: 'policy_category', isArray: false, values: ['policy_directive','legal_interpretation','tax_guidance','informational','reference_material','non_policy','data_dump','unclassified'] },
  { field: 'target_audience', label: 'Target Audience', domain: 'guidance', type: 'structured', table: 'guidance_documents', column: 'target_audience', isArray: true, values: ['families','prospective_providers','existing_providers','government_internal','local_district_staff','general_public','healthcare_providers','childcare_providers','legal_practitioners','licensed_professionals','small_businesses','nonprofits','educators'] },
  { field: 'audience_direction', label: 'Audience Direction', domain: 'guidance', type: 'structured', table: 'guidance_documents', column: 'audience_direction', isArray: false, values: ['public','government','both'] },
  { field: 'audience_expertise', label: 'Audience Expertise', domain: 'guidance', type: 'structured', table: 'guidance_documents', column: 'audience_expertise', isArray: false, values: ['lay','specialized','mixed'] },
  // Structured enums — Fines
  { field: 'penalty_type', label: 'Penalty Type', domain: 'fines', type: 'structured', table: 'fines_fees_penalties', column: 'penalty_type', isArray: false, values: ['fine','fee','penalty','surcharge','forfeiture','other'] },
  { field: 'who_pays_normalized', label: 'Who Pays', domain: 'fines', type: 'structured', table: 'fines_fees_penalties', column: 'who_pays_normalized', isArray: false, values: ['licensed_or_permitted','applicant','individual_or_household','vehicle_or_vessel_operator','business_or_corporation','insurance_or_financial','service_provider_or_operator','healthcare_or_care_facility','violator_or_respondent','property_owner','government_entity','employer_or_employee','student_or_educational','taxpayer','other'] },
  { field: 'activity_category', label: 'Activity Category', domain: 'fines', type: 'structured', table: 'fines_fees_penalties', column: 'activity_category', isArray: false, values: ['hunting_fishing_wildlife','business_licensing','manufacturing_industrial','healthcare_facility','childcare_provider','professional_licensing','environmental_permit','construction_building','food_service','transportation','cannabis_alcohol','real_estate_housing','education','financial_services','social_services','utilities_telecom','other'] },
  { field: 'estimated_annual_payers', label: 'Est. Annual Payers', domain: 'fines', type: 'structured', table: 'fines_fees_penalties', column: 'estimated_annual_payers', isArray: false, values: ['tens','hundreds','thousands','ten_thousands','hundred_thousands'] },
  { field: 'jurisdiction_level', label: 'Jurisdiction Level', domain: 'fines', type: 'structured', table: 'fines_fees_penalties', column: 'jurisdiction_level', isArray: false, values: ['federal','state','county','local','other'] },
  // Free-text arrays
  { field: 'reg_keywords', label: 'Keywords (Reg)', domain: 'regulation', type: 'free_text', table: 'regulatory_documents', column: 'keywords', isArray: true },
  { field: 'reg_applies_to', label: 'Applies To (Reg)', domain: 'regulation', type: 'free_text', table: 'regulatory_documents', column: 'applies_to', isArray: true },
  { field: 'guid_keywords', label: 'Keywords (Guidance)', domain: 'guidance', type: 'free_text', table: 'guidance_documents', column: 'keywords', isArray: true },
  { field: 'guid_applies_to', label: 'Applies To (Guidance)', domain: 'guidance', type: 'free_text', table: 'guidance_documents', column: 'applies_to', isArray: true },
  { field: 'jenai_tags', label: 'JenAI Tags', domain: 'jenai', type: 'free_text', table: 'jenai_issues', column: 'tags', isArray: true },
  // Issue type taxonomies
  { field: 'issue_type', label: 'Compliance Issue Type', domain: 'compliance', type: 'issue_type', table: 'compliance_issues', column: 'issue_type', isArray: false },
  { field: 'jenai_category', label: 'JenAI Category', domain: 'jenai', type: 'issue_type', table: 'jenai_issues', column: 'category', isArray: false },
  { field: 'tier_classification', label: 'Tier Classification', domain: 'compliance', type: 'issue_type', table: 'compliance_issue_analyses', column: 'tier2_classification', isArray: false, values: ['burdensome','justified','unrelated','needs_full_context','all_false_positives','needs_research'] },
  // Boolean flags
  { field: 'reg_has_form', label: 'Has Form (Reg)', domain: 'regulation', type: 'boolean', table: 'regulatory_documents', column: 'has_form', isArray: false },
  { field: 'reg_has_ibr', label: 'Has IBR (Reg)', domain: 'regulation', type: 'boolean', table: 'regulatory_documents', column: 'has_ibr', isArray: false },
  { field: 'guid_has_form', label: 'Has Form (Guidance)', domain: 'guidance', type: 'boolean', table: 'guidance_documents', column: 'has_form', isArray: false },
  { field: 'guid_has_ibr', label: 'Has IBR (Guidance)', domain: 'guidance', type: 'boolean', table: 'guidance_documents', column: 'has_ibr', isArray: false },
  { field: 'is_attachment', label: 'Is Attachment', domain: 'guidance', type: 'boolean', table: 'guidance_documents', column: 'is_attachment', isArray: false },
];

// Helper: get fields for a domain
export function getFieldsForDomain(domain: TagDomain): TagFieldMeta[] {
  return TAG_FIELDS.filter(f => f.domain === domain);
}

// Helper: get field metadata by field key
export function getFieldMeta(field: string): TagFieldMeta | undefined {
  return TAG_FIELDS.find(f => f.field === field);
}

// Helper: generate multiselect options from field registry
export function getFieldMultiselectOptions(domains?: TagDomain[]): Array<{ value: string; label: string }> {
  const fields = domains ? TAG_FIELDS.filter(f => domains.includes(f.domain)) : TAG_FIELDS;
  return fields.map(f => ({ value: f.field, label: f.label }));
}

// --- Tags Page Tab Values ---
export const TAGS_TAB_VALUES = ['overview', 'connections', 'correlations', 'readability'] as const;
export type TagsTabValue = (typeof TAGS_TAB_VALUES)[number];

export const TAGS_TAB_LABELS: Record<TagsTabValue, string> = {
  overview: 'Overview',
  connections: 'Connections',
  correlations: 'Correlations',
  readability: 'Readability',
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/lib/constants/tags.ts
git commit -m "feat(tags): add tag constants, field registry, and type definitions"
```

### Task 2: Shared Data Types for Repository & Actions

**Files:**
- Create: `frontend/packages/database/src/repositories/tags.types.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// frontend/packages/database/src/repositories/tags.types.ts
import type { JurisdictionCode } from '../schema/constants';

// --- Core tag value returned by overview queries ---
export interface TagValue {
  domain: string;       // 'regulation' | 'guidance' | 'fines' | 'compliance' | 'jenai'
  field: string;        // tag field key from TAG_FIELDS registry
  value: string;        // the actual tag value
  count: number;        // number of documents/records with this tag
  normalizedValue: string; // LOWER(TRIM(value))
}

// --- Co-occurrence matrix for heatmap ---
export interface TagCooccurrence {
  valueA: string;
  valueB: string;
  count: number;
}

export interface TagCooccurrenceResult {
  fieldA: string;
  fieldB: string;
  matrix: TagCooccurrence[];
  valuesA: string[];   // unique values for axis A
  valuesB: string[];   // unique values for axis B
}

// --- Network graph data ---
export interface TagNode {
  id: string;           // unique: `${field}:${value}`
  field: string;
  value: string;
  domain: string;
  count: number;
}

export interface TagEdge {
  source: string;       // node id
  target: string;       // node id
  weight: number;       // co-occurrence count
}

export interface TagNetworkResult {
  nodes: TagNode[];
  edges: TagEdge[];
}

export interface TagNetworkOptions {
  domains?: string[];
  fields?: string[];
  minEdgeWeight?: number;
  maxNodes?: number;
}

// --- Sankey flow data ---
export interface TagFlowLink {
  source: string;       // stage_index:value
  target: string;       // stage_index:value
  value: number;        // document count
}

export interface TagFlowResult {
  stages: string[];     // field keys for each stage
  nodes: Array<{ id: string; field: string; value: string }>;
  links: TagFlowLink[];
}

// --- Tag detail (for drawer) ---
export interface TagDomainCount {
  domain: string;
  count: number;
  samples: Array<{
    id: number;
    title: string;
    url?: string | null;
  }>;
}

export interface SimilarTag {
  value: string;
  count: number;
  similarity: number;   // 0.0–1.0 from pg_trgm
}

export interface TagDetailResult {
  field: string;
  value: string;
  totalCount: number;
  domainCounts: TagDomainCount[];
  relatedTags: TagValue[];        // top co-occurring tags
  similarTags: SimilarTag[];      // fuzzy matches (free-text only)
  contextCount?: number;          // sibling docs with same tag (when contextDocumentId provided)
}

// --- Readability cross-cuts ---
export interface TagReadabilityRow {
  value: string;
  count: number;
  avgFleschEase: number | null;
  avgGradeLevel: number | null;
  avgWordCount: number | null;
  avgSentenceCount: number | null;
}

export interface TagReadabilityCrosscuts {
  field: string;
  rows: TagReadabilityRow[];
}

// --- Overview stats ---
export interface TagOverviewStats {
  totalUniqueValues: number;
  mostCommonTag: { field: string; value: string; count: number } | null;
  domainWithMostTags: { domain: string; count: number } | null;
  fuzzyClusterCount: number;       // free-text tags with similar matches
  tagsByDomain: Array<{ domain: string; count: number }>;
  tagValues: TagValue[];           // all tag values for treemap
}
```

- [ ] **Step 2: Export from repositories barrel**

Add to `frontend/packages/database/src/repositories/index.ts` (the repositories barrel file — NOT `src/index.ts` directly, since the main barrel re-exports via `export * from './repositories'`):
```typescript
export type * from './tags.types';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/packages/database/src/repositories/tags.types.ts frontend/packages/database/src/repositories/index.ts
git commit -m "feat(tags): add shared tag data types for repository and actions"
```

### Task 3: Repository Stub

**Files:**
- Create: `frontend/packages/database/src/repositories/tags.repository.ts`

- [ ] **Step 1: Create repository with method signatures and stub implementations**

```typescript
// frontend/packages/database/src/repositories/tags.repository.ts
import { BaseRepository } from './base.repository';
import type { JurisdictionCode } from '../schema/constants';
import type {
  TagValue,
  TagCooccurrenceResult,
  TagNetworkResult,
  TagNetworkOptions,
  TagFlowResult,
  TagDetailResult,
  TagReadabilityCrosscuts,
  TagOverviewStats,
  SimilarTag,
} from './tags.types';

export class TagsRepository extends BaseRepository {
  async getTagOverview(jurisdiction: JurisdictionCode): Promise<TagOverviewStats> {
    // TODO: Workstream A implements
    return { totalUniqueValues: 0, mostCommonTag: null, domainWithMostTags: null, fuzzyClusterCount: 0, tagsByDomain: [], tagValues: [] };
  }

  async getTagCooccurrence(
    jurisdiction: JurisdictionCode,
    fieldA: string,
    fieldB: string,
  ): Promise<TagCooccurrenceResult> {
    // TODO: Workstream A implements
    return { fieldA, fieldB, matrix: [], valuesA: [], valuesB: [] };
  }

  async getTagNetwork(
    jurisdiction: JurisdictionCode,
    options?: TagNetworkOptions,
  ): Promise<TagNetworkResult> {
    // TODO: Workstream A implements
    return { nodes: [], edges: [] };
  }

  async getTagFlow(
    jurisdiction: JurisdictionCode,
    stages: string[],
  ): Promise<TagFlowResult> {
    // TODO: Workstream A implements
    return { stages, nodes: [], links: [] };
  }

  async getTagDetail(
    jurisdiction: JurisdictionCode,
    field: string,
    value: string,
    contextDocumentId?: number,
  ): Promise<TagDetailResult> {
    // TODO: Workstream A implements
    return { field, value, totalCount: 0, domainCounts: [], relatedTags: [], similarTags: [] };
  }

  async getTagReadabilityCrosscuts(
    jurisdiction: JurisdictionCode,
    field: string,
  ): Promise<TagReadabilityCrosscuts> {
    // TODO: Workstream A implements
    return { field, rows: [] };
  }

  async getSimilarTags(
    jurisdiction: JurisdictionCode,
    field: string,
    value: string,
  ): Promise<SimilarTag[]> {
    // TODO: Workstream A implements
    return [];
  }
}
```

- [ ] **Step 2: Export from repositories barrel**

Add to `frontend/packages/database/src/repositories/index.ts`:
```typescript
export { TagsRepository } from './tags.repository';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/index.ts
git commit -m "feat(tags): add TagsRepository stub with method signatures"
```

### Task 4: Server Actions Stub

**Files:**
- Create: `frontend/apps/web/src/lib/actions/tags.ts`

- [ ] **Step 1: Create server actions with stub wiring**

```typescript
// frontend/apps/web/src/lib/actions/tags.ts
'use server';

import 'server-only';
import { db, TagsRepository } from '@deproceduralizer/database';
import type {
  TagOverviewStats,
  TagCooccurrenceResult,
  TagNetworkResult,
  TagNetworkOptions,
  TagFlowResult,
  TagDetailResult,
  TagReadabilityCrosscuts,
  SimilarTag,
} from '@deproceduralizer/database';
import { type ActionResult, runCachedAction, runAction } from './types';
import type { JurisdictionCode } from '@deproceduralizer/database';

const tagsRepo = new TagsRepository(db);

export async function getTagOverview(
  state: JurisdictionCode,
): Promise<ActionResult<TagOverviewStats>> {
  return runCachedAction(
    'getTagOverview',
    () => tagsRepo.getTagOverview(state),
    [`tag-overview-${state}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getTagCooccurrence(
  state: JurisdictionCode,
  fieldA: string,
  fieldB: string,
): Promise<ActionResult<TagCooccurrenceResult>> {
  return runCachedAction(
    'getTagCooccurrence',
    () => tagsRepo.getTagCooccurrence(state, fieldA, fieldB),
    [`tag-cooccurrence-${state}-${fieldA}-${fieldB}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getTagNetwork(
  state: JurisdictionCode,
  options?: TagNetworkOptions,
): Promise<ActionResult<TagNetworkResult>> {
  const key = `tag-network-${state}-${JSON.stringify(options ?? {})}`;
  return runCachedAction(
    'getTagNetwork',
    () => tagsRepo.getTagNetwork(state, options),
    [key],
    { revalidate: 600, tags: ['tags'] },
  );
}

export async function getTagFlow(
  state: JurisdictionCode,
  stages: string[],
): Promise<ActionResult<TagFlowResult>> {
  const key = `tag-flow-${state}-${stages.join(',')}`;
  return runCachedAction(
    'getTagFlow',
    () => tagsRepo.getTagFlow(state, stages),
    [key],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getTagDetail(
  state: JurisdictionCode,
  field: string,
  value: string,
  contextDocumentId?: number,
): Promise<ActionResult<TagDetailResult>> {
  return runAction('getTagDetail', () =>
    tagsRepo.getTagDetail(state, field, value, contextDocumentId),
  );
}

export async function getTagReadabilityCrosscuts(
  state: JurisdictionCode,
  field: string,
): Promise<ActionResult<TagReadabilityCrosscuts>> {
  return runCachedAction(
    'getTagReadabilityCrosscuts',
    () => tagsRepo.getTagReadabilityCrosscuts(state, field),
    [`tag-readability-${state}-${field}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getTagSimilar(
  state: JurisdictionCode,
  field: string,
  value: string,
): Promise<ActionResult<SimilarTag[]>> {
  return runCachedAction(
    'getTagSimilar',
    () => tagsRepo.getSimilarTags(state, field, value),
    [`tag-similar-${state}-${field}-${value}`],
    { revalidate: 600, tags: ['tags'] },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/lib/actions/tags.ts
git commit -m "feat(tags): add server actions stub for tag analytics"
```

### Task 5: URL Parsers + useTagDrawer Hook

**Files:**
- Modify: `frontend/apps/web/src/lib/url/parsers.ts`
- Create: `frontend/apps/web/src/components/tags/useTagDrawer.tsx`

- [ ] **Step 1: Add tags parsers to parsers.ts**

Add these at the end of the parsers file, following the existing pattern:

```typescript
// --- Tags page parsers ---
import { TAGS_TAB_VALUES } from '@/lib/constants/tags';

export const tagsTabParser = parseAsStringEnum([...TAGS_TAB_VALUES]).withDefault('overview');
export const tagDomainParser = parseAsString;    // comma-separated domains
export const tagFieldParser = parseAsString;     // comma-separated fields
export const tagTypeParser = parseAsString;      // comma-separated tag types
export const tagSearchParser = parseAsString;
export const tagFieldAParser = parseAsString;    // heatmap/sankey axis selectors
export const tagFieldBParser = parseAsString;
export const readabilityFieldParser = parseAsString; // readability tab field picker

export const tagsParsers = {
  tab: tagsTabParser,
  domains: tagDomainParser,
  fields: tagFieldParser,
  types: tagTypeParser,
  search: tagSearchParser,
  fieldA: tagFieldAParser,
  fieldB: tagFieldBParser,
  readField: readabilityFieldParser,
};
```

- [ ] **Step 2: Create useTagDrawer hook**

```typescript
// frontend/apps/web/src/components/tags/useTagDrawer.tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface TagDrawerState {
  isOpen: boolean;
  field: string | null;
  value: string | null;
  contextDocumentId?: number;
}

interface TagDrawerContextValue {
  state: TagDrawerState;
  openTag: (field: string, value: string, contextDocumentId?: number) => void;
  close: () => void;
}

const TagDrawerContext = createContext<TagDrawerContextValue | null>(null);

export function TagDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TagDrawerState>({
    isOpen: false,
    field: null,
    value: null,
  });

  const openTag = useCallback((field: string, value: string, contextDocumentId?: number) => {
    setState({ isOpen: true, field, value, contextDocumentId });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <TagDrawerContext.Provider value={{ state, openTag, close }}>
      {children}
    </TagDrawerContext.Provider>
  );
}

export function useTagDrawer(): TagDrawerContextValue {
  const ctx = useContext(TagDrawerContext);
  if (!ctx) {
    throw new Error('useTagDrawer must be used within a TagDrawerProvider');
  }
  return ctx;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/web/src/lib/url/parsers.ts frontend/apps/web/src/components/tags/useTagDrawer.tsx
git commit -m "feat(tags): add URL parsers and useTagDrawer hook"
```

### Task 6: Add Navigation Entry

**Files:**
- Modify: `frontend/apps/web/src/lib/constants/navigation.ts`

- [ ] **Step 1: Add Tags nav item**

Read the file to find the `metrics` group items in `NAV_ITEMS`. Add Tags at the end of the `metrics` group (after the last item with `groupId: 'metrics'`):

```typescript
{
  key: 'tags',
  label: 'Tags',
  icon: Tag,
  isStateSpecific: true,
  pathSuffix: '/tags',
  groupId: 'metrics',
},
```

Also add `Tag` to the lucide-react import at the top of the file.

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/lib/constants/navigation.ts
git commit -m "feat(tags): add Tags navigation entry in metrics group"
```

### Task 7: Verify shared contracts compile

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend/packages/database
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run frontend build check**

```bash
cd frontend
pnpm build
```

Expected: Build succeeds. The stubs return empty data but types are correct.

- [ ] **Step 3: Commit any fixes, then push shared contracts branch**

```bash
git push -u origin worktree-cryptic-weaving-bear
```

---

## Chunk 2: Workstream A — Data Layer

This workstream implements the real SQL queries in `TagsRepository`. It replaces the stubs from Task 3.

**Agent instructions:** Work in an isolated worktree branched from the shared contracts commit. Only modify `tags.repository.ts` and `lib/actions/tags.ts`.

### Task 8: Implement getTagOverview

**Files:**
- Modify: `frontend/packages/database/src/repositories/tags.repository.ts`

- [ ] **Step 1: Write test for getTagOverview**

Create `frontend/packages/database/src/repositories/tags.repository.test.ts`. Use vitest. Test that the method returns the expected shape. Since this hits a real DB, check the test infrastructure used by existing repo tests (look at `search-filters.test.ts` pattern).

```typescript
import { describe, it, expect } from 'vitest';
import { db } from '..';
import { TagsRepository } from './tags.repository';

const repo = new TagsRepository(db);

describe('TagsRepository.getTagOverview', () => {
  it('returns overview stats with correct shape', async () => {
    const result = await repo.getTagOverview('ny');
    expect(result).toHaveProperty('totalUniqueValues');
    expect(result).toHaveProperty('tagsByDomain');
    expect(result).toHaveProperty('tagValues');
    expect(Array.isArray(result.tagsByDomain)).toBe(true);
    expect(Array.isArray(result.tagValues)).toBe(true);
  });

  it('applies LOWER/TRIM normalization to free-text tags', async () => {
    const result = await repo.getTagOverview('ny');
    const freeTextTags = result.tagValues.filter(t => t.normalizedValue);
    for (const tag of freeTextTags) {
      expect(tag.normalizedValue).toBe(tag.normalizedValue.toLowerCase().trim());
    }
  });
});
```

- [ ] **Step 2: Implement getTagOverview**

Replace the stub in `tags.repository.ts`. The query uses UNION ALL across all tag tables, applying `LOWER(TRIM(value))` for free-text fields. Use raw SQL via `this.db.execute(sql\`...\`)` for the complex UNION ALL query since Drizzle ORM doesn't natively support UNION ALL across different table shapes.

The query structure:

```sql
WITH all_tags AS (
  -- Structured: section_type from regulatory_documents
  SELECT 'regulation' AS domain, 'reg_section_type' AS field, section_type AS value,
         section_type AS normalized_value
  FROM regulatory_documents WHERE jurisdiction = $1 AND section_type IS NOT NULL
  UNION ALL
  -- Structured: policy_category from guidance_documents
  SELECT 'guidance', 'policy_category', policy_category, policy_category
  FROM guidance_documents WHERE jurisdiction = $1 AND policy_category IS NOT NULL
  UNION ALL
  -- Free-text: keywords from regulatory_documents (unnest array)
  SELECT 'regulation', 'reg_keywords', unnest(keywords), LOWER(TRIM(unnest(keywords)))
  FROM regulatory_documents WHERE jurisdiction = $1 AND array_length(keywords, 1) > 0
  UNION ALL
  -- ... continue for all TAG_FIELDS entries
  -- Boolean: has_form from regulatory_documents
  SELECT 'regulation', 'reg_has_form', CASE WHEN has_form THEN 'true' ELSE 'false' END,
         CASE WHEN has_form THEN 'true' ELSE 'false' END
  FROM regulatory_documents WHERE jurisdiction = $1 AND has_form IS NOT NULL
  -- ... etc
)
SELECT domain, field, normalized_value AS value, normalized_value, COUNT(*) AS count
FROM all_tags
GROUP BY domain, field, normalized_value
ORDER BY count DESC
```

For compliance issues and JenAI issues, join through `document_id` to get the jurisdiction filter (since those tables use `jurisdiction` or join to `regulatory_documents.jurisdiction`).

- [ ] **Step 3: Run test**

```bash
cd frontend/packages/database
npx vitest run src/repositories/tags.repository.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getTagOverview with UNION ALL cross-domain query"
```

### Task 9: Implement getTagDetail

**Files:**
- Modify: `frontend/packages/database/src/repositories/tags.repository.ts`

- [ ] **Step 1: Write test**

```typescript
describe('TagsRepository.getTagDetail', () => {
  it('returns cross-domain counts for a known tag', async () => {
    const result = await repo.getTagDetail('ny', 'reg_section_type', 'requirements');
    expect(result.field).toBe('reg_section_type');
    expect(result.value).toBe('requirements');
    expect(result.totalCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.domainCounts)).toBe(true);
    expect(Array.isArray(result.similarTags)).toBe(true);
  });

  it('returns similar tags for free-text fields', async () => {
    const result = await repo.getTagDetail('ny', 'reg_keywords', 'childcare');
    // similarTags should be populated for free-text fields
    expect(Array.isArray(result.similarTags)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement getTagDetail**

This method:
1. Counts occurrences of the tag value in its own domain
2. Searches for the same value across other domains (by matching `LOWER(TRIM(value))`)
3. Returns 3 sample documents per domain (with id, title, url)
4. Calls `getSimilarTags()` for free-text fields
5. If `contextDocumentId` provided, counts sibling documents with the same tag

- [ ] **Step 3: Run test, commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getTagDetail for drawer data"
```

### Task 10: Implement getSimilarTags

**Files:**
- Modify: `frontend/packages/database/src/repositories/tags.repository.ts`

- [ ] **Step 1: Implement using pg_trgm**

```sql
SELECT value, count, similarity(LOWER(TRIM(value)), LOWER(TRIM($2))) AS sim
FROM (
  -- subquery: distinct values with counts for this field
  SELECT LOWER(TRIM(unnest(keywords))) AS value, COUNT(*) AS count
  FROM regulatory_documents
  WHERE jurisdiction = $1
  GROUP BY LOWER(TRIM(unnest(keywords)))
) sub
WHERE similarity(value, LOWER(TRIM($2))) > 0.3
  AND value != LOWER(TRIM($2))
ORDER BY sim DESC
LIMIT 10
```

The specific subquery depends on which field is being queried. Use the `TAG_FIELDS` registry to determine the table and column.

- [ ] **Step 2: Test and commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getSimilarTags with pg_trgm fuzzy matching"
```

### Task 11: Implement getTagCooccurrence

**Files:**
- Modify: `frontend/packages/database/src/repositories/tags.repository.ts`

- [ ] **Step 1: Implement co-occurrence matrix**

Given two tag fields (e.g., `activity_category` on fines and `jenai_category` on JenAI issues), find documents that have both and count the combinations.

**Same-table case** (both fields on same table):
```sql
SELECT a.activity_category AS value_a, a.penalty_type AS value_b, COUNT(*) AS count
FROM fines_fees_penalties a
WHERE a.jurisdiction = $1 AND a.activity_category IS NOT NULL AND a.penalty_type IS NOT NULL
GROUP BY a.activity_category, a.penalty_type
```

**Cross-table case** (fields on different tables, joined via document_id):
```sql
SELECT f.activity_category AS value_a, j.category AS value_b, COUNT(DISTINCT f.document_id) AS count
FROM fines_fees_penalties f
JOIN jenai_issues j ON j.document_id = f.document_id
WHERE f.jurisdiction = $1
  AND f.activity_category IS NOT NULL
  AND j.category IS NOT NULL
  AND f.document_id IS NOT NULL
GROUP BY f.activity_category, j.category
```

**For array fields**, use `unnest()`:
```sql
SELECT LOWER(TRIM(unnest(rd.keywords))) AS value_a, ci.issue_type AS value_b, COUNT(*) AS count
FROM regulatory_documents rd
JOIN compliance_issues ci ON ci.document_id = rd.id
WHERE rd.jurisdiction = $1 AND array_length(rd.keywords, 1) > 0
GROUP BY LOWER(TRIM(unnest(rd.keywords))), ci.issue_type
```

Use the `TAG_FIELDS` registry to determine which table/column each field maps to, whether it's an array (needs unnest), and how to join tables (via `document_id` for regulations, `guidance_document_id` for guidance). Build the query dynamically based on the two field metadata entries.

- [ ] **Step 2: Test and commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getTagCooccurrence for heatmap data"
```

### Task 12: Implement getTagNetwork

- [ ] **Step 1: Implement network graph query**

Build nodes from `getTagOverview` results (top N by count, filtered by `options.domains` and `options.fields`). Build edges by computing co-occurrence between all pairs of tag values that share documents. Filter edges by `options.minEdgeWeight`.

**Algorithm:**
1. Call `getTagOverview()` to get all tag values with counts
2. Filter to `options.maxNodes` (default 100) top values
3. For each pair of remaining values that could co-occur (on same document), run a co-occurrence count query
4. Build edge list, filter by `minEdgeWeight` (default 2)

**Optimization:** Instead of N^2 pair queries, use a single query per table that returns all co-occurring pairs:

```sql
-- For regulatory_documents: find all pairs of tag values that co-occur on same document
WITH doc_tags AS (
  SELECT id AS doc_id, section_type AS value, 'reg_section_type' AS field FROM regulatory_documents WHERE jurisdiction = $1 AND section_type IS NOT NULL
  UNION ALL
  SELECT id, LOWER(TRIM(unnest(keywords))), 'reg_keywords' FROM regulatory_documents WHERE jurisdiction = $1 AND array_length(keywords, 1) > 0
)
SELECT a.field || ':' || a.value AS source, b.field || ':' || b.value AS target, COUNT(DISTINCT a.doc_id) AS weight
FROM doc_tags a
JOIN doc_tags b ON a.doc_id = b.doc_id AND (a.field || ':' || a.value) < (b.field || ':' || b.value)
GROUP BY source, target
HAVING COUNT(DISTINCT a.doc_id) >= $2  -- minEdgeWeight
```

Run similar queries for `guidance_documents`, `fines_fees_penalties`, then UNION ALL the edge results. Also add cross-table edges via document_id JOINs (e.g., regulation tags co-occurring with compliance issue tags).

- [ ] **Step 2: Test and commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getTagNetwork for force-directed graph"
```

### Task 13: Implement getTagFlow

- [ ] **Step 1: Implement Sankey flow query**

Given an ordered list of tag fields (stages), compute how documents flow through the values at each stage.

**Example:** stages = `['reg_section_type', 'reg_keywords', 'issue_type']`

```sql
WITH stage0 AS (
  SELECT id AS doc_id, section_type AS s0_value
  FROM regulatory_documents WHERE jurisdiction = $1 AND section_type IS NOT NULL
),
stage1 AS (
  SELECT rd.id AS doc_id, LOWER(TRIM(unnest(rd.keywords))) AS s1_value
  FROM regulatory_documents rd WHERE rd.jurisdiction = $1 AND array_length(rd.keywords, 1) > 0
),
stage2 AS (
  SELECT ci.document_id AS doc_id, ci.issue_type AS s2_value
  FROM compliance_issues ci
  JOIN regulatory_documents rd ON rd.id = ci.document_id
  WHERE rd.jurisdiction = $1
)
-- Link stage 0→1
SELECT '0:' || s0.s0_value AS source, '1:' || s1.s1_value AS target, COUNT(DISTINCT s0.doc_id) AS value
FROM stage0 s0 JOIN stage1 s1 ON s0.doc_id = s1.doc_id
GROUP BY s0.s0_value, s1.s1_value
UNION ALL
-- Link stage 1→2
SELECT '1:' || s1.s1_value AS source, '2:' || s2.s2_value AS target, COUNT(DISTINCT s1.doc_id) AS value
FROM stage1 s1 JOIN stage2 s2 ON s1.doc_id = s2.doc_id
GROUP BY s1.s1_value, s2.s2_value
```

Build the CTEs dynamically from the `TAG_FIELDS` registry for each stage. Each CTE extracts `(doc_id, value)` for that stage's field. Then generate the link queries between consecutive stages. Limit to top 10 values per stage to keep the Sankey readable.

- [ ] **Step 2: Test and commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getTagFlow for Sankey diagram"
```

### Task 14: Implement getTagReadabilityCrosscuts

- [ ] **Step 1: Implement readability aggregation**

For a given tag field, group guidance documents by their tag value and compute average readability metrics.

```sql
SELECT LOWER(TRIM(unnest(keywords))) AS value,
       COUNT(*) AS count,
       AVG(flesch_reading_ease) AS avg_flesch_ease,
       AVG(flesch_kincaid_grade) AS avg_grade_level,
       AVG(word_count) AS avg_word_count,
       AVG(sentence_count) AS avg_sentence_count
FROM guidance_documents
WHERE jurisdiction = $1 AND flesch_reading_ease IS NOT NULL
GROUP BY LOWER(TRIM(unnest(keywords)))
HAVING COUNT(*) >= 3
ORDER BY count DESC
```

Adapt the query based on whether the field is an array (unnest) or scalar (direct GROUP BY).

- [ ] **Step 2: Test and commit**

```bash
git add frontend/packages/database/src/repositories/tags.repository.ts frontend/packages/database/src/repositories/tags.repository.test.ts
git commit -m "feat(tags): implement getTagReadabilityCrosscuts"
```

### Task 15: Run full test suite

- [ ] **Step 1: Run all repository tests**

```bash
cd frontend/packages/database
npx vitest run
```

- [ ] **Step 2: Run build check**

```bash
cd frontend
pnpm build
```

- [ ] **Step 3: Commit any fixes**

---

## Chunk 3: Workstream B — Tag Drawer + Clickable Tags

This workstream creates the drawer UI and makes existing tags clickable. Works in its own worktree.

**Agent instructions:** Only modify the files listed in the File Ownership table under Workstream B. Import `useTagDrawer` from shared contracts. Call `getTagDetail` from server actions (the stub returns empty data until Workstream A merges — that's fine, the UI handles empty state).

### Task 16: Create ClickableTag Component

**Files:**
- Create: `frontend/apps/web/src/components/tags/ClickableTag.tsx`

- [ ] **Step 1: Create the wrapper component**

```typescript
// frontend/apps/web/src/components/tags/ClickableTag.tsx
'use client';

import { type ReactNode, type MouseEvent } from 'react';
import { useTagDrawer } from './useTagDrawer';

interface ClickableTagProps {
  field: string;
  value: string;
  contextDocumentId?: number;
  children: ReactNode;
  className?: string;
}

export function ClickableTag({
  field,
  value,
  contextDocumentId,
  children,
  className = '',
}: ClickableTagProps) {
  const { openTag } = useTagDrawer();

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    openTag(field, value, contextDocumentId);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`cursor-pointer hover:ring-2 hover:ring-[var(--color-primary)]/30 rounded transition-shadow ${className}`}
      title={`Explore "${value}" across all domains`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/components/tags/ClickableTag.tsx
git commit -m "feat(tags): add ClickableTag wrapper component"
```

### Task 17: Create TagBadge Component

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagBadge.tsx`

- [ ] **Step 1: Create tag badge for previously hidden fields**

```typescript
// frontend/apps/web/src/components/tags/TagBadge.tsx
import { TAG_DOMAIN_COLORS, type TagDomain } from '@/lib/constants/tags';

interface TagBadgeProps {
  value: string;
  domain?: TagDomain;
  className?: string;
}

export function TagBadge({ value, domain, className = '' }: TagBadgeProps) {
  const colorClass = domain ? TAG_DOMAIN_COLORS[domain] : 'bg-gray-100 text-gray-700';
  const label = value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagBadge.tsx
git commit -m "feat(tags): add TagBadge component for hidden guidance fields"
```

### Task 18: Create TagDrawer Component

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagDrawer.tsx`

- [ ] **Step 1: Create the drawer**

Build the drawer following the `FinesDetailDrawer` pattern:
- Uses `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle` from UI components
- Fetches data via `getTagDetail()` server action on open (use `useEffect` + `useState`)
- Shows: tag name + field label header, context line (if contextCount > 0), domain counts with expandable samples, similar tags section (if any), "Explore in Tags Analytics" link
- Handle loading and empty states

```typescript
// frontend/apps/web/src/components/tags/TagDrawer.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer';
import { useTagDrawer } from './useTagDrawer';
import { TagBadge } from './TagBadge';
import { getTagDetail } from '@/lib/actions/tags';
import { getFieldMeta, TAG_DOMAIN_LABELS, TAG_TYPE_LABELS } from '@/lib/constants/tags';
import type { TagDetailResult, JurisdictionCode } from '@deproceduralizer/database';

export function TagDrawer() {
  const { state: drawerState, close, openTag } = useTagDrawer();
  const params = useParams();
  const stateCode = params.state as string;
  const [data, setData] = useState<TagDetailResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!drawerState.isOpen || !drawerState.field || !drawerState.value) return;
    setLoading(true);
    getTagDetail(stateCode as JurisdictionCode, drawerState.field, drawerState.value, drawerState.contextDocumentId)
      .then(result => {
        if (result.success) setData(result.data);
      })
      .finally(() => setLoading(false));
  }, [drawerState.isOpen, drawerState.field, drawerState.value, drawerState.contextDocumentId, stateCode]);

  const fieldMeta = drawerState.field ? getFieldMeta(drawerState.field) : null;

  return (
    <Drawer open={drawerState.isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DrawerContent side="right" size="lg">
        <DrawerHeader>
          <DrawerTitle>&ldquo;{drawerState.value}&rdquo;</DrawerTitle>
          {fieldMeta && (
            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-muted)]">
              <span>{fieldMeta.label}</span>
              <span>&middot;</span>
              <span>{TAG_TYPE_LABELS[fieldMeta.type]} tag</span>
            </div>
          )}
        </DrawerHeader>

        <div className="p-4 space-y-4 overflow-y-auto">
          {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>}

          {data && !loading && (
            <>
              {/* Context line */}
              {data.contextCount != null && data.contextCount > 0 && (
                <div className="text-xs text-[var(--color-info)] bg-[var(--color-info-bg)] px-3 py-2 rounded">
                  Also on {data.contextCount} sibling section{data.contextCount !== 1 ? 's' : ''} in this subchapter
                </div>
              )}

              {/* Cross-domain counts */}
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Found across:</h4>
                <div className="space-y-1">
                  {data.domainCounts.map(dc => (
                    <details key={dc.domain} className="group">
                      <summary className="flex justify-between items-center cursor-pointer py-1.5 px-2 rounded hover:bg-[var(--color-neutral-50)]">
                        <span className="text-sm">{TAG_DOMAIN_LABELS[dc.domain as keyof typeof TAG_DOMAIN_LABELS] ?? dc.domain}</span>
                        <span className="text-sm font-medium tabular-nums">{dc.count}</span>
                      </summary>
                      <ul className="pl-4 pb-2 space-y-1">
                        {dc.samples.map(s => (
                          <li key={s.id} className="text-xs text-[var(--color-text-secondary)] truncate">
                            {s.url ? (
                              <Link href={s.url} className="hover:underline">{s.title}</Link>
                            ) : (
                              s.title
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>

              {/* Similar tags */}
              {data.similarTags.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Similar tags:</h4>
                  <div className="flex flex-wrap gap-1">
                    {data.similarTags.map(st => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() => {
                          close();
                          // Re-open with the new value after drawer closes
                          setTimeout(() => openTag(drawerState.field!, st.value), 100);
                        }}
                        className="text-xs px-2 py-1 bg-[var(--color-neutral-50)] rounded hover:bg-[var(--color-neutral-100)]"
                      >
                        &ldquo;{st.value}&rdquo; ({st.count})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Explore link */}
              <Link
                href={`/${stateCode}/tags?tab=overview&search=${encodeURIComponent(drawerState.value ?? '')}`}
                className="block w-full text-center text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary-bg)] py-2 rounded hover:bg-[var(--color-primary)]/10 transition-colors"
              >
                Explore in Tags Analytics &rarr;
              </Link>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagDrawer.tsx
git commit -m "feat(tags): add TagDrawer component with cross-domain counts and similar tags"
```

### Task 19: Add TagDrawerProvider to App Layout

**Files:**
- Modify: `frontend/apps/web/src/app/[state]/layout.tsx` (or wherever the state-level layout wraps children)

- [ ] **Step 1: Find the state layout file and wrap children with TagDrawerProvider + TagDrawer**

Read the layout file first. Then wrap the children:

```typescript
import { TagDrawerProvider } from '@/components/tags/useTagDrawer';
import { TagDrawer } from '@/components/tags/TagDrawer';

// Inside the layout's return:
<TagDrawerProvider>
  {children}
  <TagDrawer />
</TagDrawerProvider>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/app/[state]/layout.tsx
git commit -m "feat(tags): mount TagDrawerProvider and TagDrawer in state layout"
```

### Task 20: Wrap Existing Components with ClickableTag

**Files:**
- Modify: `frontend/apps/web/src/components/ui/KeywordTags.tsx`
- Modify: `frontend/apps/web/src/components/ui/SectionTypeBadge.tsx`
- Modify: `frontend/apps/web/src/components/ui/MetadataIndicators.tsx`
- Modify: `frontend/apps/web/src/components/guidance/PolicyCategoryBadge.tsx`
- Modify: `frontend/apps/web/src/components/guidance/ReadabilityBadge.tsx`

- [ ] **Step 1: Modify KeywordTags**

Read the file. Add an optional `clickable` prop (default `false` to avoid breaking existing usage). When `clickable`, wrap each keyword `<span>` with `<ClickableTag field={fieldName} value={keyword}>`. The `fieldName` should be passed as a prop (`tagField`) since keywords appear on both regulations (`reg_keywords`) and guidance (`guid_keywords`).

```typescript
interface KeywordTagsProps extends HTMLAttributes<HTMLDivElement> {
  keywords: string[] | null | undefined;
  maxDisplay?: number;
  size?: 'sm' | 'md';
  tagField?: string;  // NEW: e.g. 'reg_keywords' or 'guid_keywords'
}
```

When `tagField` is provided, wrap each keyword span with `<ClickableTag field={tagField} value={keyword}>`.

- [ ] **Step 2: Modify SectionTypeBadge**

Add optional `tagField?: string` prop. When provided, wrap the badge span with `<ClickableTag field={tagField} value={type}>`.

- [ ] **Step 3: Modify MetadataIndicators**

Add optional `tagFieldPrefix?: string` prop (e.g., `'reg'` or `'guid'`). When provided, wrap has_form icon with `<ClickableTag field={`${prefix}_has_form`} value="true">` and has_ibr similarly.

- [ ] **Step 4: Modify PolicyCategoryBadge**

Add optional `clickable?: boolean` prop. When true, wrap with `<ClickableTag field="policy_category" value={category}>`.

- [ ] **Step 5: Modify ReadabilityBadge**

Add optional `clickable?: boolean` prop. When true, wrap with a link to `/[state]/tags?tab=readability` instead of ClickableTag (since readability is a sub-tab, not a tag field).

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/web/src/components/ui/KeywordTags.tsx frontend/apps/web/src/components/ui/SectionTypeBadge.tsx frontend/apps/web/src/components/ui/MetadataIndicators.tsx frontend/apps/web/src/components/guidance/PolicyCategoryBadge.tsx frontend/apps/web/src/components/guidance/ReadabilityBadge.tsx
git commit -m "feat(tags): make KeywordTags, SectionTypeBadge, MetadataIndicators, PolicyCategoryBadge, ReadabilityBadge clickable"
```

### Task 21: Wrap Fines and JenAI Components

**Files:**
- Modify: `frontend/apps/web/src/components/fines/FinesTable.tsx`
- Modify: `frontend/apps/web/src/components/review/JenAICard/JenAICard.tsx`

- [ ] **Step 1: Read both files**

Understand the current rendering of penalty_type, activity_category, who_pays_normalized in FinesTable, and category in JenAICard.

- [ ] **Step 2: Wrap FinesTable tag cells**

For each tag-like cell (penalty_type, activity_category, who_pays_normalized), wrap the display content with `<ClickableTag field="penalty_type" value={fine.penaltyType}>`.

- [ ] **Step 3: Wrap JenAICard category**

Wrap the category badge/display with `<ClickableTag field="jenai_category" value={issue.category}>`.

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/web/src/components/fines/FinesTable.tsx frontend/apps/web/src/components/review/JenAICard/JenAICard.tsx
git commit -m "feat(tags): make fines table cells and JenAI category clickable"
```

### Task 22: Surface Hidden Guidance Fields

**Files:**
- Modify: `frontend/packages/database/src/repositories/guidance-documents.repository.ts`
- Modify: `frontend/apps/web/src/components/guidance/GuidanceDetailSidebar.tsx`

- [ ] **Step 1: Extend GuidanceDocumentDetail interface**

Read the repository file. Add missing fields to the `GuidanceDocumentDetail` interface:

```typescript
// Add to GuidanceDocumentDetail
keywords: string[] | null;
appliesTo: string[] | null;
summary: string | null;
sectionType: string | null;
targetAudience: string[] | null;
audienceDirection: string | null;
audienceExpertise: string | null;
audienceExplanation: string | null;
hasForm: boolean | null;
hasIbr: boolean | null;
```

- [ ] **Step 2: Extend the getById select clause**

Add the corresponding columns to the SELECT in `getById()`:

```typescript
keywords: guidanceDocuments.keywords,
appliesTo: guidanceDocuments.appliesTo,
summary: guidanceDocuments.summary,
sectionType: guidanceDocuments.sectionType,
targetAudience: guidanceDocuments.targetAudience,
audienceDirection: guidanceDocuments.audienceDirection,
audienceExpertise: guidanceDocuments.audienceExpertise,
audienceExplanation: guidanceDocuments.audienceExplanation,
hasForm: guidanceDocuments.hasForm,
hasIbr: guidanceDocuments.hasIbr,
```

- [ ] **Step 3: Update GuidanceDetailSidebar**

Read the sidebar component. Add new sections using existing `MetadataRow` and `ListSection` sub-components, plus `ClickableTag`, `TagBadge`, `KeywordTags`, and `SectionTypeBadge`:

After the existing "Programs" section, add:

```tsx
{/* Summary */}
{doc.summary && (
  <MetadataRow label="AI Summary">
    <span className="text-left">{doc.summary}</span>
  </MetadataRow>
)}

{/* Section Type */}
{doc.sectionType && (
  <MetadataRow label="Section Type">
    <ClickableTag field="guid_section_type" value={doc.sectionType}>
      <SectionTypeBadge type={doc.sectionType} />
    </ClickableTag>
  </MetadataRow>
)}

{/* Keywords */}
{doc.keywords && doc.keywords.length > 0 && (
  <div className="py-2 border-b border-[var(--color-neutral-100)]">
    <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Keywords</span>
    <KeywordTags keywords={doc.keywords} maxDisplay={5} tagField="guid_keywords" />
  </div>
)}

{/* Applies To */}
<ListSection label="Applies To" items={doc.appliesTo} />

{/* Target Audience */}
{doc.targetAudience && doc.targetAudience.length > 0 && (
  <div className="py-2 border-b border-[var(--color-neutral-100)]">
    <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Target Audience</span>
    <div className="flex flex-wrap gap-1">
      {doc.targetAudience.map(aud => (
        <ClickableTag key={aud} field="target_audience" value={aud}>
          <TagBadge value={aud} domain="guidance" />
        </ClickableTag>
      ))}
    </div>
  </div>
)}

{/* Audience Direction + Expertise */}
{doc.audienceDirection && (
  <MetadataRow label="Audience Direction">
    <ClickableTag field="audience_direction" value={doc.audienceDirection}>
      <TagBadge value={doc.audienceDirection} domain="guidance" />
    </ClickableTag>
  </MetadataRow>
)}
{doc.audienceExpertise && (
  <MetadataRow label="Expertise Level">
    <ClickableTag field="audience_expertise" value={doc.audienceExpertise}>
      <TagBadge value={doc.audienceExpertise} domain="guidance" />
    </ClickableTag>
  </MetadataRow>
)}

{/* Metadata Indicators */}
{(doc.hasForm || doc.hasIbr) && (
  <MetadataRow label="Indicators">
    <MetadataIndicators hasForm={doc.hasForm} hasIbr={doc.hasIbr} tagFieldPrefix="guid" />
  </MetadataRow>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/packages/database/src/repositories/guidance-documents.repository.ts frontend/apps/web/src/components/guidance/GuidanceDetailSidebar.tsx
git commit -m "feat(tags): surface hidden guidance tag fields in detail sidebar"
```

### Task 23: Build check

- [ ] **Step 1: Run TypeScript check + build**

```bash
cd frontend
pnpm build
```

- [ ] **Step 2: Fix any type errors, commit fixes**

---

## Chunk 4: Workstream C — Overview Tab + Page Shell

Creates the tags page, tab routing, and Overview sub-tab with treemap visualization.

**Agent instructions:** Work in own worktree. Only create files in `app/[state]/tags/` and `components/tags/`. Import types from shared contracts.

### Task 24: Create Tags Page Server Component

**Files:**
- Create: `frontend/apps/web/src/app/[state]/tags/page.tsx`
- Create: `frontend/apps/web/src/app/[state]/tags/loading.tsx`

- [ ] **Step 1: Create loading skeleton**

```typescript
// frontend/apps/web/src/app/[state]/tags/loading.tsx
export default function TagsLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen animate-pulse">
      <div className="h-24 bg-[var(--color-neutral-50)]" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="h-10 w-64 bg-[var(--color-neutral-100)] rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-[var(--color-neutral-100)] rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-[var(--color-neutral-100)] rounded-lg" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create page server component**

Follow the `fines/page.tsx` pattern exactly:

```typescript
// frontend/apps/web/src/app/[state]/tags/page.tsx
import { notFound } from 'next/navigation';
import { isValidJurisdiction, JURISDICTION_CONFIG } from '@/types/state';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { TagsClient } from '@/components/tags/TagsClient';
import { getTagOverview } from '@/lib/actions/tags';

interface TagsPageProps {
  params: Promise<{ state: string }>;
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  const overviewResult = await getTagOverview(stateCode);
  const overview = overviewResult.success ? overviewResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig?.name ?? state.toUpperCase()} Tag Analytics`}
        description="Explore tags, categories, and classifications across all regulatory domains"
      />
      <Container size="2xl" className="py-6">
        <TagsClient jurisdiction={stateCode} overview={overview} />
      </Container>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/web/src/app/[state]/tags/page.tsx frontend/apps/web/src/app/[state]/tags/loading.tsx
git commit -m "feat(tags): add tags page server component with loading skeleton"
```

### Task 25: Create TagsClient with Tab Routing

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagsClient.tsx`

- [ ] **Step 1: Create client component**

Follow the `FinesClient` pattern — `useQueryStates` for URL sync, `SegmentedControl` for tabs, conditional rendering by current tab. Render placeholder content for tabs not yet implemented (Connections, Correlations, Readability).

```typescript
// frontend/apps/web/src/components/tags/TagsClient.tsx
'use client';

import { useQueryStates } from 'nuqs';
import { tagsParsers } from '@/lib/url/parsers';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TAGS_TAB_LABELS, type TagsTabValue } from '@/lib/constants/tags';
import { TagsOverviewTab } from './TagsOverviewTab';
import type { TagOverviewStats, JurisdictionCode } from '@deproceduralizer/database';

const TAB_OPTIONS = Object.entries(TAGS_TAB_LABELS).map(([value, label]) => ({ value, label }));

interface TagsClientProps {
  jurisdiction: JurisdictionCode;
  overview: TagOverviewStats | null;
}

export function TagsClient({ jurisdiction, overview }: TagsClientProps) {
  const [params, setParams] = useQueryStates(tagsParsers, { shallow: true });
  const currentTab = (params.tab ?? 'overview') as TagsTabValue;

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={currentTab}
        onChange={(tab) => setParams({ tab: tab as TagsTabValue })}
      />

      <div className="mt-6">
        {currentTab === 'overview' && (
          <TagsOverviewTab overview={overview} jurisdiction={jurisdiction} />
        )}
        {currentTab === 'connections' && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            Connections tab — coming soon
          </div>
        )}
        {currentTab === 'correlations' && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            Correlations tab — coming soon
          </div>
        )}
        {currentTab === 'readability' && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            Readability tab — coming soon
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagsClient.tsx
git commit -m "feat(tags): add TagsClient with tab routing and placeholders"
```

### Task 26: Create TagsOverviewTab with Treemap

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagsOverviewTab.tsx`

- [ ] **Step 1: Create overview tab**

This is the most complex component in the page shell. It has:
1. **4 stat cards** at the top (total unique values, most common tag, domain with most tags, normalization candidates)
2. **Treemap** in the middle (using @visx/hierarchy's Treemap + d3-hierarchy)
3. **Top 20 tags table** at the bottom

For the treemap, follow existing @visx patterns in the codebase. Structure the hierarchy data as:

```typescript
const hierarchyData = {
  name: 'tags',
  children: TAG_DOMAINS.map(domain => ({
    name: TAG_DOMAIN_LABELS[domain],
    children: tagValues
      .filter(t => t.domain === domain)
      .map(t => ({
        name: t.value,
        size: t.count,
        field: t.field,
        domain: t.domain,
      })),
  })).filter(d => d.children.length > 0),
};
```

Use `ChartContainer` for responsive sizing. The treemap renders colored rectangles with text labels. Click a rectangle → call `openTag(field, value)` from `useTagDrawer`.

For the table, use a simple `<table>` with columns: Rank, Tag Value, Field, Domain, Count, Type. Make each row's tag value a `<ClickableTag>`.

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagsOverviewTab.tsx
git commit -m "feat(tags): add TagsOverviewTab with treemap and stats"
```

### Task 27: Build check and smoke test

- [ ] **Step 1: Build**

```bash
cd frontend
pnpm build
```

- [ ] **Step 2: Start dev server and verify the page renders**

```bash
lsof -i :3000,3010,3011,3012
# Pick available port
cd frontend/apps/web
pnpm dev --port 3011
```

Navigate to `http://localhost:3011/ny/tags` — should see the page with overview tab, stat cards (showing zeros from stubs), empty treemap, and empty table.

- [ ] **Step 3: Run smoke tests**

```bash
cd frontend/apps/web
pnpm test:e2e
```

- [ ] **Step 4: Commit any fixes**

---

## Chunk 5: Workstreams D, E, F — Visualization Tabs

These three workstreams are fully independent. Each creates a single new component file.

### Task 28: Workstream D — TagsConnectionsTab (Chord + Network)

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagsConnectionsTab.tsx`

**Agent instructions:** Create a component that renders:
1. A chord diagram (left panel) using `@nivo/chord` — the `ResponsiveChord` component
2. A force-directed network graph (right panel) using `react-force-graph-2d`

Both fetch data via `getTagNetwork()` and `getTagCooccurrence()` server actions. Use `useEffect` + `useState` for client-side data fetching since this tab loads lazily.

- [ ] **Step 1: Implement the chord diagram panel**

The chord diagram shows co-occurrence between tag domains. Use `@nivo/chord`'s `ResponsiveChord` with:
- `keys`: domain names
- `matrix`: co-occurrence counts between domains (NxN matrix)
- Color by domain using `TAG_DOMAIN_COLORS`

- [ ] **Step 2: Implement the network graph panel**

Follow the existing cross-references network graph pattern (`react-force-graph-2d`):
- Nodes colored by domain, sized by count
- Edges weighted by co-occurrence
- Controls: min edge weight slider, domain toggles
- Click node → `openTag(field, value)`

- [ ] **Step 3: Wire both panels in a split layout**

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <ChartContainer title="Domain Connections" aspectRatio={1} minHeight={400}>
    {({ width, height }) => <ChordDiagram ... />}
  </ChartContainer>
  <ChartContainer title="Tag Network" aspectRatio={1} minHeight={400}>
    {({ width, height }) => <NetworkGraph ... />}
  </ChartContainer>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagsConnectionsTab.tsx
git commit -m "feat(tags): add TagsConnectionsTab with chord diagram and network graph"
```

### Task 29: Workstream E — TagsCorrelationsTab (Heatmap + Sankey)

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagsCorrelationsTab.tsx`

**Agent instructions:**

- [ ] **Step 1: Install @nivo/sankey**

```bash
cd frontend/apps/web
pnpm add @nivo/sankey
```

- [ ] **Step 2: Implement heatmap section**

Use existing `HeatmapGrid` component. Add two dropdown selectors for X-axis and Y-axis tag fields (populated from `TAG_FIELDS` registry). Fetch data via `getTagCooccurrence(state, fieldA, fieldB)`. Default: `activity_category` × `jenai_category`.

- [ ] **Step 3: Implement Sankey section**

Use `@nivo/sankey`'s `ResponsiveSankey`. Add stage configuration dropdowns (2-4 stages). Fetch data via `getTagFlow(state, stages)`. Include preset buttons: "Regulation Journey" (`[reg_section_type, reg_keywords, issue_type, tier_classification]`), "Fines Flow" (`[activity_category, penalty_type, who_pays_normalized, jurisdiction_level]`).

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagsCorrelationsTab.tsx frontend/apps/web/package.json frontend/pnpm-lock.yaml
git commit -m "feat(tags): add TagsCorrelationsTab with heatmap and Sankey diagram"
```

### Task 30: Workstream F — TagsReadabilityTab

**Files:**
- Create: `frontend/apps/web/src/components/tags/TagsReadabilityTab.tsx`

**Agent instructions:**

- [ ] **Step 1: Implement bar chart section**

Use existing `HorizontalBarChart`. Add a dropdown to pick which tag field to group by (from guidance domain fields only: `policy_category`, `target_audience`, `guid_section_type`, `guid_keywords`). Fetch via `getTagReadabilityCrosscuts(state, field)`. Color bars by readability tier using existing `ReadabilityBadge` thresholds.

- [ ] **Step 2: Implement scatter plot**

Build a custom D3+SVG scatter plot (consistent with existing chart components). X-axis = document count, Y-axis = average Flesch Reading Ease. Each dot = one tag value. Use `ChartContainer` for responsive sizing. Add hover tooltip showing tag name, count, and avg readability.

- [ ] **Step 3: Implement cross-cut table**

Simple `<table>` with columns: Tag Value, Doc Count, Avg Flesch Ease, Avg Grade Level, Avg Word Count. Sortable by any column (use local state for sort).

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagsReadabilityTab.tsx
git commit -m "feat(tags): add TagsReadabilityTab with bar chart, scatter plot, and cross-cut table"
```

---

## Chunk 6: Integration + Wire-Up

After all workstreams merge, wire the real tab components into TagsClient and run final verification.

### Task 31: Replace Placeholder Tabs in TagsClient

**Files:**
- Modify: `frontend/apps/web/src/components/tags/TagsClient.tsx`

- [ ] **Step 1: Import and render real tab components**

Replace the placeholder divs with:

```typescript
import { TagsConnectionsTab } from './TagsConnectionsTab';
import { TagsCorrelationsTab } from './TagsCorrelationsTab';
import { TagsReadabilityTab } from './TagsReadabilityTab';

// In the render:
{currentTab === 'connections' && (
  <TagsConnectionsTab jurisdiction={jurisdiction} />
)}
{currentTab === 'correlations' && (
  <TagsCorrelationsTab jurisdiction={jurisdiction} />
)}
{currentTab === 'readability' && (
  <TagsReadabilityTab jurisdiction={jurisdiction} />
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/apps/web/src/components/tags/TagsClient.tsx
git commit -m "feat(tags): wire all tab components into TagsClient"
```

### Task 32: Final Build + Smoke Tests

- [ ] **Step 1: Full build**

```bash
cd frontend
pnpm build
```

- [ ] **Step 2: Run unit tests**

```bash
cd frontend/packages/database
npx vitest run
```

- [ ] **Step 3: Run E2E smoke tests**

```bash
cd frontend/apps/web
pnpm test:e2e
```

- [ ] **Step 4: Manual verification**

Start dev server, navigate to:

**Tags page — Overview tab:**
1. `/ny/tags` — page loads without errors, no "2MB cache" warnings in console
2. Stat cards show meaningful values (most common tag is NOT "false" or "true")
3. Treemap renders with colored rectangles grouped by domain
4. Top tags table shows values sortable by count
5. Click a treemap rectangle or table row → tag drawer opens

**Tags page — Connections tab:**
6. `/ny/tags?tab=connections` — chord diagram renders with domain arcs
7. Network graph shows clustered nodes (same-domain nodes group together)
8. Nodes have text labels visible when zoomed in
9. Edge weight slider filters connections
10. Click a node → tag drawer opens

**Tags page — Correlations tab:**
11. `/ny/tags?tab=correlations` — heatmap renders with default axes (activity_category × jenai_category)
12. Changing axis dropdowns refetches data and updates heatmap
13. Sankey diagram renders with preset buttons ("Regulation Journey", "Fines Flow")
14. Stage dropdowns are configurable

**Tags page — Readability tab:**
15. `/ny/tags?tab=readability` — bar chart of avg Flesch reading ease by tag
16. Scatter plot shows dots colored by readability tier
17. Cross-cut table is sortable by any column
18. Field picker dropdown changes the grouping

**Tag Drawer (from detail pages):**
19. `/ny/guidance/[id]` — sidebar shows new tag fields: keywords, target audience, audience direction, expertise, section type, summary
20. Click any tag in the guidance sidebar → drawer opens with cross-domain counts
21. Drawer shows expandable domain rows with sample document links
22. "Explore in Tags Analytics" link navigates to `/ny/tags?tab=overview&search=...`
23. `/ny/regulations/[id]` — click a keyword or section type → drawer opens
24. `/ny/fines` — click penalty type cell → drawer opens
25. Review page — click JenAI category badge → drawer opens

**Cross-jurisdiction:**
26. `/nj/tags` — page loads and shows NJ-specific data
27. `/nyc/tags` — page loads and shows NYC-specific data

**Regression checks:**
28. Existing guidance detail pages still render correctly (new sidebar fields don't break layout)
29. Existing fines table still works (ClickableTag wrapping doesn't break row interactions)
30. Existing analytics page still works (no import/routing conflicts)

- [x] **Step 5: Update STYLE_GUIDE.md** — Done (Workstream B updated it)

- [ ] **Step 6: Commit any final fixes**

```bash
git add frontend/
git commit -m "fix(tags): integration fixes from manual verification"
```
