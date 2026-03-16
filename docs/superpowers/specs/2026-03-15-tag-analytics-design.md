# Tag Analytics & Cross-Domain Tag Exploration

## Overview

A unified tag analytics system that surfaces the tagging landscape across all domains (regulations, guidance, fines, compliance issues, JenAI findings), enables cross-domain correlation and exploration, and makes every tag in the application clickable for instant context.

### Goals

1. **Analyst exploration** (primary): Let regulatory analysts understand how tags cluster, correlate, and connect across domains
2. **Executive dashboard** (secondary): High-level summary of tag distributions and cross-domain patterns
3. **In-context discovery**: Clickable tags on every detail page open a drawer showing cross-domain connections
4. **Data quality surfacing**: Highlight free-text tags needing normalization via fuzzy-match indicators

### Non-Goals

- Full tag normalization pipelines (deferred — the analytics page itself identifies where normalization adds value)
- Readability metrics for regulations (guidance-only, using existing 12-column system)
- Exposing the `document_tags` table (scan scoping tags) or severity/complexity scores in this feature
- Manual tag editing or tag management UI

---

## Tag Scope

Four tag types are in scope, spanning 6 database domains:

### Structured Enum Tags (fixed vocabularies)

| Field | Domain | Values | Table |
|-------|--------|--------|-------|
| `section_type` | Regulations, Guidance | 15 types (definitions, requirements, procedures...) | `regulatory_documents`, `guidance_documents` |
| `penalty_type` | Fines | 6 types (fine, fee, penalty, surcharge, forfeiture, other) | `fines_fees_penalties` |
| `policy_category` | Guidance | 8 values (policy_directive, legal_interpretation...) | `guidance_documents` |
| `who_pays_normalized` | Fines | 15 categories (licensed_or_permitted, applicant...) | `fines_fees_penalties` |
| `activity_category` | Fines | 17 domains (healthcare_facility, childcare_provider...) | `fines_fees_penalties` |
| `target_audience` | Guidance | 13 audience tags (families, small_businesses...) | `guidance_documents` |
| `audience_direction` | Guidance | 3 values (public, government, both) | `guidance_documents` |
| `audience_expertise` | Guidance | 3 values (lay, specialized, mixed) | `guidance_documents` |
| `estimated_annual_payers` | Fines | 5 volume buckets (tens → hundred_thousands) | `fines_fees_penalties` |
| `jurisdiction_level` | Fines | 5 values (federal, state, county, local, other) | `fines_fees_penalties` |

### Free-Text Array Tags (LLM-generated, no controlled vocabulary)

| Field | Domain | Storage | Table |
|-------|--------|---------|-------|
| `keywords[]` | Regulations, Guidance | text[] (3-5 terms per doc) | `regulatory_documents`, `guidance_documents` |
| `applies_to[]` | Regulations, Guidance | text[] (entities that must comply) | `regulatory_documents`, `guidance_documents` |
| `tags[]` | JenAI | text[] (2-3 kebab-case labels per finding) | `jenai_issues` |

### Issue Type Taxonomies (classification tags on findings)

| Field | Domain | Values | Table |
|-------|--------|--------|-------|
| `issue_type` | Compliance | 49 types grouped by category | `compliance_issues` |
| `category` | JenAI | 18 Pahlka categories | `jenai_issues` |
| Tier classifications | Compliance | burdensome / justified / unrelated | `compliance_issue_analyses` |

### Boolean Flags

| Field | Domain | Table |
|-------|--------|-------|
| `has_form` | Regulations, Guidance | `regulatory_documents`, `guidance_documents` |
| `has_ibr` | Regulations, Guidance | `regulatory_documents`, `guidance_documents` |
| `is_attachment` | Guidance | `guidance_documents` |

---

## Architecture

### Data Layer

#### Tag Abstraction

```typescript
type TagDomain = 'regulation' | 'guidance' | 'fines' | 'compliance' | 'jenai';
type TagType = 'structured' | 'free_text' | 'issue_type' | 'boolean';

interface TagValue {
  domain: TagDomain;
  field: string;          // e.g. "section_type", "keywords", "penalty_type"
  value: string;          // e.g. "procedures", "childcare", "fine"
  type: TagType;
  count: number;          // how many documents/records have this tag
  normalizedValue?: string; // lowercase/trimmed version for grouping
}
```

#### Repository: `tags.repository.ts`

Seven core query methods:

1. **`getTagOverview(jurisdiction)`** — All tag values across all domains with counts. Uses UNION ALL across tables. Powers treemap and overview stats.

2. **`getTagCooccurrence(jurisdiction, domainA, fieldA, domainB, fieldB)`** — Co-occurrence matrix between any two tag dimensions. Joins through document relationships. Powers heatmap.

3. **`getTagNetwork(jurisdiction, options?)`** — Nodes (tag values) and edges (weighted co-occurrence). Configurable domain inclusion and minimum edge weight threshold. Powers force-directed graph and chord diagram.

4. **`getTagFlow(jurisdiction, stages[])`** — Sankey flow data: how documents move through a sequence of tag dimensions. E.g., `[section_type, keywords, issue_type, classification]`.

5. **`getTagDetail(jurisdiction, field, value, contextDocumentId?)`** — Everything about one tag value: cross-domain counts, sample documents per domain, related tags (co-occurring), readability stats (for guidance tags). Optional contextDocumentId enables the "also on N sibling sections" context line. Powers the drawer.

6. **`getTagReadabilityCrosscuts(jurisdiction, field)`** — Readability metrics grouped by tag values for a given field. E.g., average Flesch Reading Ease per policy_category.

7. **`getSimilarTags(jurisdiction, field, value)`** — Fuzzy matching for free-text tags. Returns similar values with edit distance / shared prefix. Powers the "similar tags" indicator.

#### Query-Time Normalization

For free-text fields (`keywords`, `applies_to`, JenAI `tags`), all queries apply `LOWER(TRIM(value))` before grouping. This collapses trivial variants ("Childcare Providers" / "childcare providers") without requiring a pipeline change.

#### Server Actions: `tags.ts`

Thin wrappers with `unstable_cache` (120s TTL, tagged `'tags'`), one per repository method. Same pattern as existing action files.

---

### Tags Page: `/[state]/tags`

#### Page Structure

```
/[state]/tags
├── page.tsx              (server component — data fetching)
├── loading.tsx           (skeleton)
└── TagsClient.tsx        (tab routing + global filter bar)
    ├── TagsOverviewTab
    ├── TagsConnectionsTab
    ├── TagsCorrelationsTab
    └── TagsReadabilityTab
```

#### Global Filter Bar

Persistent across all sub-tabs. All state managed via `nuqs` parsers:

- **Domain filter** (multi-select): Regulation, Guidance, Fines, Compliance, JenAI
- **Tag field filter** (multi-select, dynamic based on selected domains): section_type, keywords, penalty_type, activity_category, target_audience, etc.
- **Search** (text): Filter tag values by substring
- **Tag type** (multi-select): Structured, Free-text, Issue Type, Boolean

#### Overview Sub-tab

**Top row**: 4 stat cards — Total unique tag values, most common tag, domain with most tags, free-text tags needing normalization (fuzzy cluster count).

**Main area**: Interactive treemap (d3-hierarchy via @visx)
- Outer level: Tag domain (regulation/guidance/fines/compliance/jenai)
- Inner level: Tag field (section_type/keywords/penalty_type/etc.)
- Leaf level: Individual tag values, sized by document count
- Click a leaf → opens tag drawer

**Bottom**: Top 20 tags table across all domains, sortable by count, with domain badge and tag type indicator.

#### Connections Sub-tab

**Left panel**: Chord diagram (@nivo/chord)
- Arcs = tag domains (or tag fields, user-toggleable)
- Chords = co-occurrence strength between domains/fields
- Hover = highlight specific connection with count tooltip
- Click chord → filters the network graph to that relationship

**Right panel**: Force-directed network (react-force-graph-2d)
- Nodes = tag values, colored by domain, sized by count
- Edges = co-occurrence, weighted by frequency
- Controls: min edge weight slider, domain toggles, zoom
- Click node → opens tag drawer

#### Correlations Sub-tab

**Top**: Heatmap (existing `HeatmapGrid` component extended)
- User picks X-axis tag field and Y-axis tag field from dropdowns
- Cell color = co-occurrence count
- Click cell → shows documents with both tags
- Default: `activity_category` × JenAI `category`

**Bottom**: Sankey diagram (@nivo/sankey — new dependency)
- User configures 2-4 "stages" from dropdowns
- Flow width = document count through that path
- Click flow segment → shows those documents
- Preset configurations: "Regulation Journey", "Fines Flow", "Compliance Path"

#### Readability Sub-tab

Scoped to guidance documents (only domain with readability metrics).

**Top**: Bar chart — average Flesch Reading Ease by tag value
- Dropdown to pick tag field (policy_category, target_audience, section_type, keywords)
- Bars colored by readability tier (Easy/Standard/Difficult/Very Difficult)

**Middle**: Scatter plot — tag count vs. average readability (built with D3 + SVG, consistent with existing custom chart components)
- Each dot = a tag value, X = doc count, Y = avg reading ease
- Hover = tag name + metrics
- Outliers highlight where common tags have poor readability

**Bottom**: Cross-cut table
- Rows = tag values, columns = avg Flesch, avg grade level, avg word count, doc count
- Sortable by any column

---

### Tag Drawer: `TagDrawer`

#### Trigger

Any tag displayed anywhere in the app is clickable. A shared `useTagDrawer()` hook returns `{ openTag(field, value, contextDocumentId?) }` that any component can call.

#### Layout

```
┌─────────────────────────────────┐
│ ✕  "childcare"                  │
│     keyword · Free-text tag     │
├─────────────────────────────────┤
│ ℹ Also on 3 sibling sections   │  ← Context line (only when relevant)
│   in this subchapter            │
├─────────────────────────────────┤
│ Found across:                   │
│                                 │
│  Regulations             84     │  ← Each row expandable: shows 3
│  Guidance Documents      23     │     sample titles with links
│  Fines & Fees            12     │
│  Compliance Issues        7     │
│  JenAI Findings           4     │
├─────────────────────────────────┤
│ Similar tags:                   │  ← Only for free-text tags with
│   "child care" (19 docs)        │     fuzzy matches
│   "childcare providers" (31)    │
├─────────────────────────────────┤
│ [ Explore in Tags Analytics → ] │  ← Links to /tags?field=keywords
│                                 │     &value=childcare
└─────────────────────────────────┘
```

#### Data Fetching

Single server action: `getTagDetail(jurisdiction, field, value, contextDocumentId?)`. The optional `contextDocumentId` enables the context line.

---

### Clickable Tags: Making Existing Tags Interactive

#### New Shared Components

**`ClickableTag`** — Thin wrapper that adds click handler + hover cursor + subtle hover highlight to any existing tag display. Accepts `field` and `value` props, calls `useTagDrawer().openTag(field, value)`.

**`TagBadge`** — New general-purpose tag pill for fields not currently displayed (target_audience, applies_to, audience_direction, audience_expertise). Domain-colored left border.

#### Existing Component Modifications

| Component | Field(s) | Change |
|-----------|----------|--------|
| `KeywordTags` | `keywords` | Each keyword pill wrapped with `ClickableTag` |
| `SectionTypeBadge` | `section_type` | Wrapped with `ClickableTag` |
| `PolicyCategoryBadge` | `policy_category` | Wrapped with `ClickableTag` |
| `MetadataIndicators` | `has_form`, `has_ibr` | Wrapped with `ClickableTag` |
| `ReadabilityBadge` | `reading_grade_level` | Wrapped, links to readability sub-tab |
| JenAI category display | `category` | Wrapped with `ClickableTag` |
| `FinesTable` cells | `penalty_type`, `activity_category`, `who_pays_normalized` | Cell content wrapped with `ClickableTag` |

#### Surfacing Hidden Guidance Fields

`GuidanceDetailSidebar` currently doesn't show keywords, applies_to, target_audience, audience_direction, audience_expertise, summary, or section_type. Changes:

1. Extend `getById()` in `GuidanceDocumentsRepository` to select these fields
2. Extend `GuidanceDocumentDetail` type to include them
3. Add tag sections to `GuidanceDetailSidebar` using `ClickableTag` / `TagBadge`

---

## File Plan

### New Files

```
frontend/packages/database/src/repositories/
  └── tags.repository.ts                    # Cross-domain tag queries

frontend/apps/web/src/
  ├── lib/
  │   ├── actions/tags.ts                   # Server actions with caching
  │   └── constants/tags.ts                 # Tag field metadata, labels, colors
  │
  ├── app/[state]/tags/
  │   ├── page.tsx                          # Server component, data fetching
  │   └── loading.tsx                       # Skeleton loader
  │
  └── components/tags/
      ├── TagsClient.tsx                    # Tab routing + global filter bar
      ├── TagsOverviewTab.tsx               # Treemap + summary stats
      ├── TagsConnectionsTab.tsx            # Chord diagram + network graph
      ├── TagsCorrelationsTab.tsx           # Heatmap + Sankey
      ├── TagsReadabilityTab.tsx            # Readability × tag cross-cuts
      ├── TagDrawer.tsx                     # Shared tag detail drawer
      ├── ClickableTag.tsx                  # Wrapper for click behavior
      ├── TagBadge.tsx                      # General-purpose tag pill
      └── useTagDrawer.tsx                  # Hook for drawer state management
```

### Modified Files

```
frontend/packages/database/src/repositories/
  └── guidance-documents.repository.ts      # Extend getById with tag fields

frontend/apps/web/src/
  ├── components/ui/
  │   ├── KeywordTags.tsx                   # Add ClickableTag wrapper
  │   ├── SectionTypeBadge.tsx              # Add ClickableTag wrapper
  │   └── MetadataIndicators.tsx            # Add ClickableTag wrapper
  │
  ├── components/guidance/
  │   ├── GuidanceDetailSidebar.tsx         # Surface hidden tag fields
  │   ├── PolicyCategoryBadge.tsx           # Add ClickableTag wrapper
  │   └── ReadabilityBadge.tsx              # Add ClickableTag wrapper (links to readability sub-tab)
  │
  ├── components/fines/
  │   └── FinesTable.tsx                    # Add ClickableTag to cells
  │
  ├── components/review/
  │   └── JenAICard/JenAICard.tsx           # Add ClickableTag to category
  │
  ├── lib/url/parsers.ts                    # Add tags page URL state parsers
  └── lib/constants/values.ts               # Add tags tab values
```

### New Dependencies

- `@nivo/sankey` — Sankey/alluvial flow diagrams (only new package)

### Navigation

Add "Tags" entry to the main navigation sidebar in the `metrics` group (alongside Analytics, Fines, Bookmarks). Icon: `Tag` from lucide-react.

---

## Normalization Strategy

### Phase 1 (this feature)

- **Query-time cleanup**: Apply `LOWER(TRIM(value))` to all free-text tag queries
- **Similar tags indicator**: `getSimilarTags()` uses PostgreSQL's `pg_trgm` extension (`similarity()` function) to surface fuzzy matches in the drawer and overview table — consistent with existing trigram indexes on `regulatory_documents.citation` and `definitions`
- **Visual indicator**: Free-text tags with fuzzy matches show a subtle "~" badge indicating similar values exist

### Phase 2 (future, informed by Phase 1)

- Add `keywords_normalized` / `applies_to_normalized` columns where analytics reveals high noise
- Follow existing `who_pays` → `who_pays_normalized` enrichment runner pattern
- The Tags overview tab's "tags needing normalization" stat card identifies candidates

---

## Cross-Domain Join Strategy

Tags live in different tables. Cross-domain queries join through document relationships:

```
regulatory_documents (document_id)
  ├── compliance_issues.document_id
  ├── compliance_issue_analyses (via compliance_issues.analysis_id)
  ├── jenai_issues.document_id
  ├── fines_fees_penalties.document_id
  └── document_tags.document_id

guidance_documents (guidance_document_id)
  ├── compliance_issues.guidance_document_id
  ├── jenai_issues.guidance_document_id
  └── fines_fees_penalties.guidance_document_id
```

For co-occurrence between tags on the same document, join through shared `document_id` or `guidance_document_id`. For co-occurrence between tags on different document types, aggregate at the tag value level (count docs where tag A appears AND tag B appears on a related document).

### Performance Considerations

Cross-domain UNION ALL + JOIN queries can be expensive on large datasets. Mitigations:
- `unstable_cache` with 120s TTL on all server actions reduces repeated computation
- Consider longer TTLs (300-600s) for expensive aggregation queries (network, co-occurrence) since tag data changes infrequently
- If specific queries exceed acceptable latency, introduce materialized views refreshed on a schedule

---

## Multi-Agent Execution Strategy

This feature is designed for parallel implementation by a team of agents working in isolated git worktrees. The key principle: **shared contracts are defined first**, then independent workstreams build against those contracts without stepping on each other.

### Shared Contracts (must be committed to main before parallel work begins)

These files define the interfaces that all agents build against. A single agent (or the lead) creates these first:

```
frontend/packages/database/src/repositories/tags.repository.ts   # Type exports + method signatures (can start with stubs)
frontend/apps/web/src/lib/actions/tags.ts                        # Server action signatures (can start with stubs)
frontend/apps/web/src/lib/constants/tags.ts                      # TagDomain, TagType, TagValue, field metadata, labels, colors
frontend/apps/web/src/lib/url/parsers.ts                         # New nuqs parsers for tags page URL state
frontend/apps/web/src/lib/constants/values.ts                    # TagsTabValue additions
frontend/apps/web/src/components/tags/useTagDrawer.tsx           # Hook interface: { openTag(field, value, contextDocumentId?) }
```

**Why stubs work:** Each agent's worktree has the type signatures to import from. The repository/action implementations get filled in by the agent that owns that workstream. When branches merge, the stubs get replaced by real implementations.

### Parallel Workstreams

After shared contracts are committed, these workstreams can run **simultaneously** in separate worktrees:

#### Workstream A: Data Layer (1 agent)
**Owns:** `tags.repository.ts`, `tags.ts` server actions
**Touches:** Database queries only — no frontend components
**Deliverables:**
- All 7 repository methods with real SQL (getTagOverview, getTagCooccurrence, getTagNetwork, getTagFlow, getTagDetail, getTagReadabilityCrosscuts, getSimilarTags)
- Server action wrappers with caching
- Query-time normalization (LOWER/TRIM) on all free-text fields
- pg_trgm fuzzy matching for getSimilarTags

**No conflicts with other workstreams** — this agent only writes to `tags.repository.ts` and `lib/actions/tags.ts`.

#### Workstream B: Tag Drawer + Clickable Tags (1 agent)
**Owns:** `TagDrawer.tsx`, `ClickableTag.tsx`, `TagBadge.tsx`
**Touches:** Existing UI components (wrapping with ClickableTag), guidance sidebar
**Deliverables:**
- `TagDrawer` component with drawer layout
- `ClickableTag` wrapper component
- `TagBadge` general-purpose pill component
- Wrap existing components: `KeywordTags`, `SectionTypeBadge`, `PolicyCategoryBadge`, `MetadataIndicators`, `ReadabilityBadge`, JenAI category display, `FinesTable` cells
- Extend `GuidanceDocumentsRepository.getById()` to select hidden tag fields
- Extend `GuidanceDocumentDetail` type
- Update `GuidanceDetailSidebar` to surface hidden fields

**Potential conflicts:** This agent modifies existing components across multiple directories. To minimize merge conflicts:
- Modifications are **additive only** (wrapping existing JSX, not rewriting it)
- The `useTagDrawer` hook is defined in shared contracts, so this agent only imports it
- The drawer calls `getTagDetail()` from server actions — the implementation comes from Workstream A, but the type signature is in shared contracts

#### Workstream C: Overview Tab + Page Shell (1 agent)
**Owns:** `page.tsx`, `loading.tsx`, `TagsClient.tsx`, `TagsOverviewTab.tsx`
**Touches:** Navigation config (adding Tags entry)
**Deliverables:**
- Tags page server component with data fetching
- Skeleton loader
- `TagsClient` with tab routing + global filter bar
- Overview sub-tab: treemap (d3-hierarchy/@visx), stat cards, top-20 tags table
- Navigation entry in metrics group
- Placeholder/skeleton content for other tabs (so the page works before other tabs are ready)

**No conflicts with Workstreams A or B** — this agent creates new files only (except navigation config). Uses shared contract types for data fetching. The overview tab calls `getTagOverview()` — implementation comes from Workstream A.

#### Workstream D: Connections Tab (1 agent)
**Owns:** `TagsConnectionsTab.tsx`
**Touches:** No existing files
**Deliverables:**
- Chord diagram (@nivo/chord)
- Force-directed network graph (react-force-graph-2d)
- Domain toggles, edge weight slider, zoom controls
- Click-to-drawer integration via `useTagDrawer`

**No conflicts** — creates a single new file. Calls `getTagNetwork()` and `getTagCooccurrence()` from shared contract types.

#### Workstream E: Correlations Tab (1 agent)
**Owns:** `TagsCorrelationsTab.tsx`
**Touches:** `package.json` (adding @nivo/sankey)
**Deliverables:**
- Extended `HeatmapGrid` for tag × tag correlation (or new wrapper component)
- Sankey diagram (@nivo/sankey)
- Axis picker dropdowns, preset configurations
- Click-to-document-list integration

**Minimal conflicts** — creates a new file + adds a dependency. The `package.json` change is a single line addition. Calls `getTagCooccurrence()` and `getTagFlow()` from shared contract types.

#### Workstream F: Readability Tab (1 agent)
**Owns:** `TagsReadabilityTab.tsx`
**Touches:** No existing files
**Deliverables:**
- Bar chart: avg Flesch Reading Ease by tag value (reuse `HorizontalBarChart`)
- Scatter plot: tag count vs. readability (new D3+SVG component)
- Cross-cut table: sortable tag × readability metrics
- Tag field picker dropdown

**No conflicts** — creates a single new file. Calls `getTagReadabilityCrosscuts()` from shared contract types.

### Dependency Graph

```
Shared Contracts (lead agent)
  │
  ├── Workstream A: Data Layer ──────────────────────┐
  │                                                   │
  ├── Workstream B: Drawer + Clickable Tags ──┐      │
  │                                            │      │
  ├── Workstream C: Overview Tab + Shell ──┐   │      │
  │                                        │   │      │
  ├── Workstream D: Connections Tab ───┐   │   │      │
  │                                    │   │   │      │
  ├── Workstream E: Correlations Tab ──┤   │   │      │
  │                                    │   │   │      │
  └── Workstream F: Readability Tab ───┤   │   │      │
                                       │   │   │      │
                                       └───┴───┴──────┘
                                              │
                                        Integration merge
                                        (all branches → main)
```

All workstreams depend only on Shared Contracts. No workstream depends on another workstream. This means all 6 can run in parallel after contracts are committed.

### File Ownership (Conflict Prevention)

| File | Owner | Other agents may... |
|------|-------|---------------------|
| `tags.repository.ts` | Workstream A | Import types only |
| `lib/actions/tags.ts` | Workstream A | Import function signatures only |
| `lib/constants/tags.ts` | Shared Contracts | Read only (all agents import) |
| `useTagDrawer.tsx` | Shared Contracts | Read only (all agents import) |
| `TagDrawer.tsx` | Workstream B | Not touch |
| `ClickableTag.tsx`, `TagBadge.tsx` | Workstream B | Not touch |
| `KeywordTags.tsx`, `SectionTypeBadge.tsx`, etc. | Workstream B | Not touch |
| `GuidanceDetailSidebar.tsx` | Workstream B | Not touch |
| `guidance-documents.repository.ts` | Workstream B | Not touch |
| `page.tsx`, `TagsClient.tsx` | Workstream C | Not touch |
| `TagsOverviewTab.tsx` | Workstream C | Not touch |
| `TagsConnectionsTab.tsx` | Workstream D | Not touch |
| `TagsCorrelationsTab.tsx` | Workstream E | Not touch |
| `TagsReadabilityTab.tsx` | Workstream F | Not touch |
| `package.json` | Workstream E | Workstream C may also touch (nav config) — coordinate |

### Integration Order

When merging branches back to main:

1. **Workstream A first** (data layer) — replaces stubs with real implementations
2. **Workstream C second** (page shell) — establishes the page and tab structure
3. **Workstream B third** (drawer + clickable tags) — modifies existing components, needs manual merge review for any conflicts
4. **Workstreams D, E, F in any order** (individual tabs) — each adds a single new file, no conflicts

### Smoke Test After Integration

After all branches are merged:
1. Navigate to `/[state]/tags` — all 4 sub-tabs should render
2. Click a tag on any detail page — drawer should open with cross-domain counts
3. Click "Explore in Tags Analytics" in drawer — should navigate to tags page filtered to that tag
4. Run `pnpm build` — no TypeScript errors
5. Run `pnpm test:e2e` — existing smoke tests still pass

---

## Phasing Recommendation

The multi-agent workstreams above can also be executed sequentially as phases if running with fewer agents:

### Phase 1: Foundation + Overview (Shared Contracts + Workstreams A, B, C)
- Shared contracts (types, constants, hook interface)
- `tags.repository.ts` (getTagOverview, getTagDetail, getSimilarTags)
- `tags.ts` server actions
- Tags page with Overview sub-tab (treemap + stats + table)
- TagDrawer + ClickableTag + useTagDrawer
- Make existing tags clickable across the app
- Surface hidden guidance tag fields
- Navigation entry

### Phase 2: Connections (Workstream D)
- `getTagNetwork`, `getTagCooccurrence` repository methods
- Connections sub-tab (chord + network graph)

### Phase 3: Correlations (Workstream E)
- `getTagFlow` repository method
- Install `@nivo/sankey`
- Correlations sub-tab (heatmap + Sankey)

### Phase 4: Readability (Workstream F)
- `getTagReadabilityCrosscuts` repository method
- Readability sub-tab (bar chart + scatter + cross-cut table)
