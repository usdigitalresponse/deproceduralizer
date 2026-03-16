# Visual Improvement Agent Tasks

> Execution plan derived from `docs/VISUAL_IMPROVEMENTS.md` — 75 improvements across 11 pages,
> 7 conflicts identified, 10 shared patterns extracted.

---

## Conflict Resolutions

Before any agent begins work, these conflicts from the cross-cutting analysis must be resolved:

### Resolution 1: Cards vs Tables (Conflict #1)
**Decision**: Keep the existing pattern — pages that already have view toggles (Regulations) keep them. List pages (Guidance, IBR Browse, Fines Browse) stay as tables with enhanced styling. Bookmarks stays as tabs with type-appropriate layouts (cards for rich Analyses, tables for Documents/Guidance/Fines). Do NOT force everything into cards.
**Rationale**: Tables are better for data-dense scannable content (fines, guidance lists). Cards are better for rich, multi-field items (analyses with badges). The toggle pattern on Regulations already handles user preference.

### Resolution 2: Left Border Color Semantics (Conflict #2)
**Decision**: Standardize on **entity-type colors** as the canonical left-border meaning everywhere. Use `entity-types.ts` as the single source of truth: regulation = navy, statute = info blue, guidance = success green, analysis = warning amber, definition = sky blue. Depth-aware colors (Browse tree) and scope-level colors (Definitions) use **indentation + icons** instead of border colors.
**Rationale**: Entity type is the only semantic that's consistent across all pages. Other semantics (depth, scope, severity) should use different visual channels (indentation, icons, dot indicators).

### Resolution 3: Sticky Element Stacking (Conflict #3)
**Decision**: Max ONE sticky element per scroll container. Coordinate via a shared `--sticky-offset` CSS variable that cascades. Page header is always sticky at `top: 0`. Sub-page sticky elements use `top: var(--sticky-offset)`. On mobile, sticky elements collapse into the header.
**Rationale**: Multiple sticky elements eat viewport space. One per container is the constraint.

### Resolution 4: Animation Consistency (Conflict #4)
**Decision**: All expand/collapse animations use the shared `<AnimatedCollapse>` component (Similarity #1): `200ms ease-out` for height, `150ms ease-in` for opacity. No per-page custom timings.
**Rationale**: Consistency > customization for micro-interactions.

### Resolution 5: Chart Click-to-Filter (Conflict #5)
**Decision**: Implement a shared `useChartNavigation(targetPath, paramMap)` hook (Similarity #5). Each chart component calls this hook. The hook constructs the target URL with query params and uses `router.push()`.
**Rationale**: Shared hook prevents 4 independent implementations with different behaviors.

### Resolution 6: Export Controls (Conflict #6)
**Decision**: Standardize on a **dropdown pattern** everywhere. Single "Export" button with a dropdown menu listing available formats/scopes. Fines consolidation (#11.3) becomes the template.
**Rationale**: Dropdown scales to N export options without layout changes.

### Resolution 7: Radar Chart vs Pills (Conflict #7)
**Decision**: Keep pills as the default inline view. Add radar chart as a **popover** triggered by clicking a "View distribution" link on the burden card. Radar does NOT replace pills.
**Rationale**: Pills are scannable in a list. Radar adds depth for interested users without increasing card height.

---

## Execution Plan: 12-Part Multi-Agent Team

### Architecture

```
                    ┌─────────────────────┐
                    │   ORCHESTRATOR (A0)  │
                    │  Coordinates all     │
                    │  agents, resolves    │
                    │  blockers, tracks    │
                    │  progress            │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
    │ SHARED (A1)  │ │ INDIVIDUAL   │ │ VERIFICATION     │
    │ Common       │ │ A2-A12       │ │ AGENTS           │
    │ components   │ │ Per-page     │ │ A13: Correctness │
    │ (runs first) │ │ improvements │ │ A14: Devil's Adv │
    └──────┬───────┘ │ (parallel)   │ │ A15: Final Review│
           │         └──────────────┘ └──────────────────┘
           │                │                │
           ▼                ▼                ▼
      Shared utils     Page changes     Quality gates
      must complete     depend on A1     run sequentially
      before A2-A12                     after all impl done
```

### Agent Definitions

---

#### A0: Orchestrator Agent
**Role**: Coordinates execution, tracks progress, resolves blockers between agents.
**Responsibilities**:
- Launch A1 (shared components) first and wait for completion
- Launch A2-A12 (individual page agents) in parallel after A1 completes
- Monitor for conflicts between agents touching shared files
- After all implementation agents finish, launch A13, then A14, then A15 sequentially
- Maintain a progress dashboard (checklist of completed agents)

**Does NOT write code** — only coordinates and communicates.

---

#### A1: Shared Components Agent (runs first, blocks all others)
**Scope**: Create/extend shared UI utilities used by all 11 page agents.
**Tasks**:

1. **`<AnimatedCollapse>`** component (Similarity #1)
   - Location: `components/ui/AnimatedCollapse.tsx`
   - Props: `isOpen: boolean`, `duration?: number` (default 200ms)
   - Uses CSS `max-height` transition with `ease-out`
   - Used by: Browse tree, Definitions grouped view, Regulations sidebar, Statutes tree, Burden explanation text

2. **`<ColorStripe>`** component (Similarity #2, Resolution #2)
   - Location: `components/ui/ColorStripe.tsx`
   - Props: `entityType: EntityType`, `position?: 'left' | 'top'`
   - Sources colors from `entity-types.ts` canonical mapping
   - 3px border, integrated into Card component as optional prop

3. **`<StickyContainer>`** component (Similarity #3, Resolution #3)
   - Location: `components/ui/StickyContainer.tsx`
   - Props: `offset?: string` (CSS value), `blur?: boolean`
   - `position: sticky`, `backdrop-filter: blur(8px)`, `z-index: var(--z-sticky)`
   - Used by: Browse breadcrumb, Definitions letter bar, Analytics tabs, Search sidebar

4. **Extend `<EmptyState>`** component (Similarity #4)
   - Add `suggestion?: string` prop for "Did you mean..." text
   - Add `actionSecondary?: { label, onClick }` for secondary CTA
   - Ensure all 11 pages use it consistently

5. **`useChartNavigation`** hook (Similarity #5, Resolution #5)
   - Location: `hooks/useChartNavigation.ts`
   - Signature: `(targetPath: string, paramMap: Record<string, string>) => void`
   - Used by: IBR overview, Analytics charts, Burden stats, Fines overview

6. **`<ProportionalBar>`** component (Similarity #6)
   - Location: `components/ui/ProportionalBar.tsx`
   - Props: `value: number`, `max: number`, `colorStops?: [number, string][]`
   - Small inline horizontal bar with color gradient
   - Used by: Definitions quality, Burden scores, Fine amounts

7. **`<EntityTypeBadge>`** component (Similarity #7)
   - Location: `components/ui/EntityTypeBadge.tsx`
   - Extends `entity-types.ts` with canonical colors
   - Icon + label + color, used for Search results, Bookmarks, etc.

8. **Shared table styling utilities** (Similarity #8)
   - Location: `components/ui/table-styles.ts`
   - Exports: `zebraRowClass`, `hoverRowClass`, `tableHeaderClass`
   - Standardizes `even:bg-[var(--color-neutral-50)]`, `hover:bg-[var(--color-primary-faint)]`

9. **`<InfoTooltip>`** component (Similarity #9)
   - Location: `components/ui/InfoTooltip.tsx`
   - Small `(i)` icon that shows tooltip on hover
   - Wraps Radix tooltip primitive

10. **Skeleton loading variants** (Similarity #10)
    - Location: `components/ui/skeletons/`
    - `StatCardSkeleton`, `TableSkeleton`, `ChartSkeleton`, `CardListSkeleton`
    - Shared shimmer animation keyframe

**Estimated scope**: ~10 new/modified component files.
**Must complete before**: A2-A12 can begin.

---

#### A2: Browse Regulations Agent
**Scope**: Section #1 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #1.1: Tree depth guide lines (CSS border-left per depth level, NOT color — use indentation per Resolution #2)
- [ ] #1.2: Sticky breadcrumb in DetailPanel using `<StickyContainer>` from A1
- [ ] #1.3: Cross-reference highlight legend (floating card)
- [ ] #1.4: Tree expand/collapse using `<AnimatedCollapse>` from A1
- [ ] #1.5: Empty state for DetailPanel using enhanced `<EmptyState>` from A1
- [ ] #1.6: Filter chips with active count badges
- [ ] #1.7: ResizableDivider grab handle affordance

**Files touched**: `BrowseClient.tsx`, `HierarchyTree.tsx`, `TreeNode.tsx`, `DetailPanel/DetailPanel.tsx`, `DetailPanel/Header.tsx`, `BrowseFilters.tsx`, `ResizableDivider.tsx`

---

#### A3: Definitions Agent
**Scope**: Section #2 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #2.1: Sticky alphabetical strip using `<StickyContainer>` from A1
- [ ] #2.2: Enhanced term typography (larger, bolder, primary-colored terms)
- [ ] #2.3: Grouped view expansion using `<AnimatedCollapse>` from A1
- [ ] #2.4: Source document chip/badge on DefinitionCard
- [ ] #2.5: Quality score visual using `<ProportionalBar>` from A1
- [ ] #2.6: View toggle crossfade animation
- [ ] #2.7: Scope level indentation/icons (NOT left border — per Resolution #2)

**Files touched**: `GlossaryClient.tsx`, `GlossarySearch.tsx`, `DefinitionCard.tsx`, `AggregatedTermCard.tsx`

---

#### A4: Guidance Agent
**Scope**: Section #3 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #3.1: Document status timeline/stepper on detail page
- [ ] #3.2: Readability metrics visual gauges (SVG progress rings)
- [ ] #3.3: Citation cross-reference inline chips
- [ ] #3.4: Table row styling using shared table utilities from A1
- [ ] #3.5: Lineage viewer as connected-node vertical graph
- [ ] #3.6: Filter state persistence indicator badge
- [ ] #3.7: Agency color-coded avatar in table rows

**Files touched**: `GuidanceBrowseTab.tsx`, `GuidanceTable.tsx`, `GuidanceDetailContent.tsx`, `ReadabilityMetricsCard.tsx`, `DocumentLineageViewer.tsx`

---

#### A5: IBR Agent
**Scope**: Section #4 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #4.1: Chart click-to-filter using `useChartNavigation` from A1
- [ ] #4.2: Drawer section dividers with better spacing
- [ ] #4.3: Sortable column headers on Most Referenced Standards table
- [ ] #4.4: Version badge monospace styling
- [ ] #4.5: Contextual empty state for organization filter
- [ ] #4.6: Stat card trend indicators (optional)

**Files touched**: `IbrOverviewTab.tsx`, `IbrBrowseTab.tsx`, `IbrDetailDrawer.tsx`, `IbrTable.tsx`

---

#### A6: Regulations Agent
**Scope**: Section #5 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #5.1: Card view top color stripe using `<ColorStripe>` from A1 (section-type based)
- [ ] #5.2: Inline highlight legend (sticky, toggleable)
- [ ] #5.3: Sidebar collapsible sections with counts using `<AnimatedCollapse>` from A1
- [ ] #5.4: DataTable column visibility toggle
- [ ] #5.5: DetailModal keyboard prev/next navigation
- [ ] #5.6: Faceted filter active state chips
- [ ] #5.7: Document notes yellow-accent styling

**Files touched**: `RegulationsClient.tsx`, `DataTable.tsx`, `RegulationCardGrid.tsx`, `RegulationDetailClient.tsx`, `RegulationDetailSidebar.tsx`, `DetailModal.tsx`

---

#### A7: Search Agent
**Scope**: Section #6 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #6.1: Result type color strips using `<ColorStripe>` + `<EntityTypeBadge>` from A1
- [ ] #6.2: Query term highlighting in result snippets (`<mark>` tags)
- [ ] #6.3: Commentary sidebar sticky using `<StickyContainer>` from A1
- [ ] #6.4: Conditional filter reveal animation
- [ ] #6.5: Recent searches in localStorage (below empty search input)
- [ ] #6.6: Result count by type breakdown
- [ ] #6.7: No-results suggestions from definitions

**Files touched**: `SearchResultsClient.tsx`, `SearchResultCard.tsx`, `SearchFilters.tsx`, `CommentarySidebar.tsx`

---

#### A8: Statutes Agent
**Scope**: Section #7 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #7.1: Statute type icons in tree nodes
- [ ] #7.2: Linked regulations section in detail sidebar
- [ ] #7.3: Ancestor breadcrumb navigation above content
- [ ] #7.4: Search highlight persistence + scroll-to
- [ ] #7.5: Child statutes content preview
- [ ] #7.6: Search results count badge

**Files touched**: `StatuteBrowseClient.tsx`, `StatuteHierarchyTree.tsx`, `StatuteDetailPanel.tsx`, `StatuteDetailSidebar.tsx`, `StatuteDetailContent.tsx`

---

#### A9: Analytics Agent
**Scope**: Section #8 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #8.1: Tab navigation scroll indicators (gradient masks or arrows)
- [ ] #8.2: Chart interactivity using `useChartNavigation` from A1
- [ ] #8.3: Stat card sparklines (inline SVG)
- [ ] #8.4: Guidance readability comparison chart
- [ ] #8.5: Pipeline tab visual status stepper
- [ ] #8.6: Cross-references network visualization (D3 or simple SVG)
- [ ] #8.7: Tab content loading skeletons from A1

**Files touched**: `AnalyticsTabs.tsx`, `OverviewTab.tsx`, `IssuesTab.tsx`, `KeywordsTab.tsx`, `GuidanceAnalyticsTab.tsx`, `PipelineTab.tsx`, `CrossReferencesTab.tsx`

---

#### A10: Bookmarks Agent
**Scope**: Section #9 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #9.1: Keep type-appropriate layouts (per Resolution #1) but standardize padding, actions, notes placement
- [ ] #9.2: Drag-and-drop reordering (lightweight library)
- [ ] #9.3: Bulk actions toolbar with checkbox selection
- [ ] #9.4: Notes editor markdown support
- [ ] #9.5: Tab count badges with semantic colors
- [ ] #9.6: Export All using dropdown pattern (per Resolution #6)
- [ ] #9.7: Distinct empty tab illustrations

**Files touched**: `BookmarksContent.tsx`, `BookmarkNotesEditor.tsx`

---

#### A11: Burden Index Agent
**Scope**: Section #10 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #10.1: Burden score visual bar using `<ProportionalBar>` from A1
- [ ] #10.2: Radar chart as popover (per Resolution #7), NOT inline
- [ ] #10.3: Top 3 podium header section
- [ ] #10.4: Source toggle stats refresh with transition
- [ ] #10.5: Explanation text line-clamp with expand toggle
- [ ] #10.6: Cluster category tooltips using `<InfoTooltip>` from A1

**Files touched**: `BurdenClient.tsx`

---

#### A12: Fines & Fees Agent
**Scope**: Section #11 improvements
**Dependencies**: A1 complete
**Tasks**:
- [ ] #11.1: Overview tab treemap/bubble visualization
- [ ] #11.2: Fine amount proportional bar using `<ProportionalBar>` from A1
- [ ] #11.3: Export controls consolidated dropdown (becomes the template per Resolution #6)
- [ ] #11.4: Penalty type icon in detail drawer
- [ ] #11.5: Bookmark star toggle animation
- [ ] #11.6: Amount range dual slider
- [ ] #11.7: Who Pays tooltips using `<InfoTooltip>` from A1

**Files touched**: `FinesClient.tsx`, `FinesOverviewTab.tsx`, `FinesBrowseTab.tsx`, `FinesTable.tsx`, `FinesDetailDrawer.tsx`, `FineDetailContent.tsx`

---

#### A13: Correctness Checker Agent
**Role**: Verifies all implementations after A2-A12 complete.
**Runs**: Sequentially after all implementation agents.
**Checks**:
- [ ] TypeScript compiles without errors (`cd frontend && pnpm build`)
- [ ] All shared components from A1 are actually used (no orphaned code)
- [ ] No duplicate component implementations across pages
- [ ] CSS variable references are valid (no typos, no undefined tokens)
- [ ] Accessibility: all new interactive elements have `aria-*` attributes, focus states, keyboard support
- [ ] Responsive: all changes work on mobile viewports (check drawer behavior, sticky elements)
- [ ] URL state: any new query params use `nuqs` parsers (not raw `useSearchParams`)
- [ ] Import hygiene: server-only modules not imported in client components
- [ ] Style guide compliance: new components follow `STYLE_GUIDE.md` patterns

**Output**: List of issues found with file paths and line numbers.

---

#### A14: Devil's Advocate Agent
**Role**: Challenges every implementation decision. Looks for over-engineering, unnecessary complexity, and violations of "clarity over decoration".
**Runs**: Sequentially after A13.
**Challenges**:
- [ ] Are any improvements adding visual noise without information value?
- [ ] Do radar charts, sparklines, and network graphs justify their complexity for this user base (policy analysts, not data scientists)?
- [ ] Does the drag-and-drop reordering (Bookmarks #9.2) add real value for a list of <50 items?
- [ ] Are animations distracting or delightful? Would users prefer instant transitions?
- [ ] Is the treemap (Fines #11.1) overkill when a simple sorted bar chart communicates the same information?
- [ ] Do inline citation chips (Guidance #3.3) interfere with reading flow?
- [ ] Are we breaking the "clarity over decoration" principle anywhere?
- [ ] Which improvements should be CUT to keep scope manageable?

**Output**: Ordered list of items to cut or simplify, with reasoning.

---

#### A15: Final Review Agent
**Role**: Last gate before merge. Holistic review of all changes.
**Runs**: After A14's cuts are applied.
**Reviews**:
- [ ] Visual consistency: Do all 11 pages feel like they belong to the same app?
- [ ] Design system compliance: Are all new components documented in `STYLE_GUIDE.md`?
- [ ] Performance: No unnecessary re-renders from new state, no layout thrashing from sticky elements
- [ ] Conflict resolutions: Were all 7 resolutions actually followed?
- [ ] Shared components: Are they generic enough to reuse vs too tightly coupled to one page?
- [ ] Run smoke tests: `cd frontend/apps/web && pnpm test:e2e`
- [ ] Browser verification: Check key pages in Playwright across desktop + mobile viewports
- [ ] Commit message: Prepare conventional commit summarizing all changes

**Output**: Final go/no-go decision with any last fixes needed.

---

## Execution Order Summary

```
Phase 1: A0 (Orchestrator) launches A1 (Shared Components)
Phase 2: A1 completes → A0 launches A2-A12 in parallel (11 page agents)
Phase 3: A2-A12 complete → A0 launches A13 (Correctness Checker)
Phase 4: A13 completes, fixes applied → A0 launches A14 (Devil's Advocate)
Phase 5: A14 completes, cuts applied → A0 launches A15 (Final Review)
Phase 6: A15 approves → Commit and PR
```

**Total agents**: 16 (A0 orchestrator + A1 shared + A2-A12 individual + A13-A15 verification)
**Parallelism**: A2-A12 run concurrently (max 11 parallel agents)
**Sequential gates**: A1 → A2-A12 → A13 → A14 → A15
