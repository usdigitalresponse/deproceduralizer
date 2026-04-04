# UX Improvements: Terminology, Bulk Actions & Filter System

> **Status: PROPOSED**
> This document describes a proposed design that has NOT been implemented.

## Context

After reviewing 8 recent commits (PRs #301-#316), we identified three areas where the UX can be more intuitive:

1. **Terminology confusion** — "Mark", "Label", "Bookmark", and "Marker" are used interchangeably across the UI for two distinct concepts (flagging items vs. categorizing them)
2. **Bulk action bar clarity** — the bar uses warning amber for affirmative actions, ambiguous button labels, and provides no completion feedback
3. **Filter system inconsistency** — 24 views have filtering, but use at least 5 different patterns (tiered, flat, inline, faceted, custom). Guidance shows 13 filters at once with no tiers

## Design Decisions

### Terminology: "Save" + "Label"

| Concept | Term | Verb | Adjective | Icon |
|---------|------|------|-----------|------|
| Flagging/bookmarking an item | **Save** | Save / Unsave | Saved | `Bookmark` (lucide) |
| Categorizing a saved item | **Label** | Add Label / Remove Label | Labeled | `Tag` (lucide) |

- The DB schema remains `bookmarks` / `bookmark_markers` — no migration needed
- Internal code keeps `marker` / `MarkerGroup` names — these are infrastructure, not user-facing
- The nav item becomes "Saved Items" (the page is about viewing what you saved)
- The URL stays `/markers` (breaking URLs is worse than a slight mismatch)

### Bulk Action Bar

- **"Save All"** replaces "Mark All" — uses `--color-primary` (blue) instead of `--color-warning` (amber)
- **"Unsave All"** replaces "Unmark All" — keeps `--color-danger` (red), uses `BookmarkX` icon
- **"Add Label"** stays unchanged — uses `Tag` icon, neutral gray
- **Toast notifications** after every bulk operation via Sonner (already configured in layout):
  - Success: `"Saved 5 items"`, `"Label applied to 5 items"`
  - Failure: `"3 items could not be saved"`

### Filter System: TieredFilterBar

A new composite component that enforces a consistent 3-tier layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: Primary Filters (always visible)         [Clear] [Sort]│
├─────────────────────────────────────────────────────────────────┤
│ Tier 2: Quick Toggles   [Saved] [Easy Fix] [Labels▾]          │
│                                        [⚙ More Filters (3) ▾] │
├─────────────────────────────────────────────────────────────────┤
│ Tier 3: Advanced Filters (AnimatedCollapse)     [Clear Adv]    │
│ [Filter] [Filter] [Filter] [Filter]                            │
└─────────────────────────────────────────────────────────────────┘
```

**Component API (composition, not configuration):**
```typescript
<TieredFilterBar
  primaryFilters={<>...</>}      // ReactNode: always visible FilterFields
  advancedFilters={<>...</>}     // ReactNode: collapsible FilterFields
  quickToggles={<>...</>}        // ReactNode: toggle buttons row
  advancedLabel="More Filters"   // or "Tier 3 Filters" for pipeline
  advancedCount={3}              // badge count on toggle
  {...filterBarProps}            // sort, clear, variant forwarded
/>
```

**Sub-components:**
- `AdvancedFilterToggle` — replaces the primitive `▶ Tier 3 Filters` text link with a proper button using `SlidersHorizontal` icon, badge count, and chevron rotation
- `ActiveFilterSummary` — compact sticky bar that appears when the full filter bar scrolls out of view, showing active filter count + chips + "Clear all" + "Show filters" scroll-back button

**Per-page filter tier mapping:**

| Page | Primary (always visible) | Quick Toggles | Advanced (collapsed) |
|------|--------------------------|---------------|----------------------|
| **Pipeline** | Tier, Classification, Issue Type, Severity, Federal Mandate, Pipeline | Saved, Easy Fix, Labels | 9 Tier 3 filters (unchanged) |
| **Guidance** | Agency, Type, Category, Status, Search | Saved, Labels | Direction, Section Type, Readability, Expertise, Target Audience, Has Form, Has IBR, Year |
| **Fines** | Type, Source, Severity, Agency, Search | Saved, Labels | Level, Who Pays, Per Unit, Est. Impact, Amount range |
| **Markers** (fine tab) | Type, Agency | Category chips | Who Pays, By, Date — migrated to URL state |

**Markers URL persistence:** Expand `markersParsers` in `parsers.ts` to include fine-tab filters (`mFineType`, `mFineAgency`, `mFineWhoPays`, `mFineBy`, `mFineDate`, `mCategory`, `mFineSortBy`, `mFineSortOrder`) replacing 8 `useState` calls with URL state.

### MarkersContent Decomposition

Split the 1,300-line monolith:

| New File | Extracted From | Lines |
|----------|---------------|-------|
| `markers/AnalysisBookmarkCard.tsx` | MarkersContent lines 778-1011 | ~233 |
| `markers/DocumentBookmarkRow.tsx` | MarkersContent lines 1013-1111 | ~98 |
| `markers/GuidanceBookmarkRow.tsx` | MarkersContent lines 1113-1215 | ~102 |
| `markers/FineBookmarkRow.tsx` | MarkersContent lines 1217-1334 | ~117 |
| `hooks/useFineFilters.ts` | Fine sort/filter state + memo | ~60 |
| `hooks/useMarkerMutations.ts` | 9 bookmark/marker handlers | ~120 |

Result: `MarkersContent.tsx` shrinks to ~200 lines (tab state + delegation).

### MarkerGroupManager Improvements

- **Search input** when `groups.length >= 8` — filters groups by name
- **Show item counts for all groups** including zero (helps identify unused labels)
- **Terminology update:** "Unmark all items" → "Unsave all items"

---

## Phased Execution Plan

### Phase 1: Terminology Unification

**Scope:** All text/aria/label changes across all files. One focused PR.
**Goal:** Eliminate user-facing confusion immediately.

- [ ] `components/ui/BookmarkButton.tsx` — "Mark"→"Save", "Unmark"→"Unsave", "Marked"→"Saved"
- [ ] `components/ui/BulkActionBar.tsx` — "Mark All"→"Save All", "Unmark All"→"Unsave All", `--color-warning`→`--color-primary`
- [ ] `components/analysis/AnalysisTableFilters.tsx` — "Marked" toggle → "Saved"
- [ ] `components/guidance/GuidanceBrowseTab.tsx` — "Marked" toggle → "Saved"
- [ ] `components/fines/FinesBrowseTab.tsx` — "Marked" toggle → "Saved"
- [ ] `components/markers/MarkersContent.tsx` — page titles, empty states, sort labels ("Date Marked"→"Date Saved", "Marked By"→"Saved By")
- [ ] `components/markers/MarkerBadge.tsx` — aria-label "marker" → "label"
- [ ] `components/markers/MarkerNotesEditor.tsx` — placeholder text
- [ ] `components/markers/MarkerGroupManager.tsx` — "Unmark all items" → "Unsave all items"
- [ ] `lib/constants/navigation.ts` — `label: 'Labels'` → `label: 'Saved Items'`
- [ ] `lib/constants/entity-types.ts` — bookmark label → "Saved Item"
- [ ] `app/[state]/markers/page.tsx` — page title
- [ ] Grep sweep: verify no remaining user-facing "Mark All" / "Unmark" / "Marked" text
- [ ] Update `STYLE_GUIDE.md` terminology section
- [ ] Run `pnpm test:e2e` — verify no regressions
- [ ] Manual spot-check: nav label, bulk bar, toggle buttons, empty states

---

### Phase 2: Bulk Action Feedback (Toasts)

**Scope:** Add toast notifications via Sonner after bulk operations. Small PR.

- [ ] `components/analysis/AnalysisTable.tsx` — add `toast()` calls after `Promise.allSettled` in bulk handlers
- [ ] `components/fines/FinesTable.tsx` — same toast pattern
- [ ] `components/markers/MarkersContent.tsx` — same toast pattern for marker mutations
- [ ] Verify Sonner `<Toaster>` already in layout (it is — `position="bottom-right"`)
- [ ] Manual test: bulk save → toast "Saved 5 items"; bulk unsave → toast; bulk label → toast
- [ ] Verify toast position doesn't overlap sticky bulk bar

**Toast pattern:**
```typescript
const results = await Promise.allSettled(items.map(item => serverAction(item)));
const succeeded = results.filter(r => r.status === 'fulfilled').length;
const failed = results.filter(r => r.status === 'rejected').length;
if (succeeded > 0) toast.success(`Saved ${succeeded} item${succeeded !== 1 ? 's' : ''}`);
if (failed > 0) toast.error(`${failed} item${failed !== 1 ? 's' : ''} could not be saved`);
```

---

### Phase 3: TieredFilterBar Component + Pipeline Adoption

**Scope:** Build the shared component, refactor Pipeline as first adopter.

- [ ] Create `components/ui/FilterBar/AdvancedFilterToggle.tsx` — `SlidersHorizontal` icon, badge count, chevron rotation
- [ ] Create `components/ui/FilterBar/TieredFilterBar.tsx` — composes FilterBar + quick toggles + AnimatedCollapse
- [ ] Create `hooks/useActiveFilterCount.ts` — standardized count replacing per-page boolean arrays
- [ ] Refactor `components/analysis/AnalysisTableFilters.tsx` — adopt TieredFilterBar
- [ ] Export new components from `components/ui/FilterBar/index.ts`
- [ ] Add `TieredFilterBar` pattern to `STYLE_GUIDE.md` with tier assignment rules
- [ ] Run `pnpm test:e2e` — pipeline smoke tests
- [ ] Manual: primary visible, advanced collapsed, toggle works, badge count updates, clear works
- [ ] Test `AnimatedCollapse` animation is smooth
- [ ] Test mobile: filters wrap gracefully

---

### Phase 4: Guidance + Fines Filter Tiering

**Scope:** Refactor Guidance and Fines browse tabs to use TieredFilterBar.

**Guidance** (13 flat → 5 primary + 8 advanced):
- [ ] `components/guidance/GuidanceBrowseTab.tsx` — adopt TieredFilterBar
- [ ] Primary: Agency, Type, Category, Status, Search
- [ ] Quick toggles: Saved, Labels
- [ ] Advanced: Direction, Section Type, Readability, Expertise, Target Audience, Has Form, Has IBR, Year
- [ ] Verify filter counts still populate in advanced section
- [ ] Verify grouped mode works with tiered filters

**Fines** (similar tiering):
- [ ] `components/fines/FinesBrowseTab.tsx` — adopt TieredFilterBar
- [ ] Primary: Type, Source, Severity, Agency, Search
- [ ] Quick toggles: Saved, Labels
- [ ] Advanced: Level, Who Pays, Per Unit, Est. Impact, Amount range
- [ ] Run `pnpm test:e2e`
- [ ] Test URL state round-trips (set filters → refresh → filters persist)

---

### Phase 5: Markers Decomposition + URL Persistence

**Scope:** Break up MarkersContent.tsx monolith, migrate fine-tab filters to URL state.

**Extract components:**
- [ ] `components/markers/AnalysisBookmarkCard.tsx` (from lines ~778-1011)
- [ ] `components/markers/DocumentBookmarkRow.tsx` (from lines ~1013-1111)
- [ ] `components/markers/GuidanceBookmarkRow.tsx` (from lines ~1113-1215)
- [ ] `components/markers/FineBookmarkRow.tsx` (from lines ~1217-1334)

**Extract hooks:**
- [ ] `hooks/useFineFilters.ts` — fine sort/filter state + sorted memo
- [ ] `hooks/useMarkerMutations.ts` — 9 bookmark/marker mutation handlers

**URL persistence:**
- [ ] Expand `markersParsers` in `lib/url/parsers.ts` with fine-tab params (`mFineType`, `mFineAgency`, etc.)
- [ ] Replace 8 `useState` calls in MarkersContent with `useQueryStates`

**Integration:**
- [ ] Fine tab adopts TieredFilterBar
- [ ] `MarkersContent.tsx` shrinks to ~200 lines (tab state + delegation)
- [ ] Update `components/markers/index.ts` barrel exports
- [ ] Run `pnpm test:e2e` — markers smoke test
- [ ] Verify each tab renders correctly after decomposition
- [ ] Verify fine-tab filters persist on page refresh
- [ ] Verify drag-and-drop reorder still works in MarkerGroupManager

---

### Phase 6: MarkerGroupManager + ActiveFilterSummary

**Scope:** Polish improvements — search in label manager, sticky filter summary.

**MarkerGroupManager:**
- [ ] Add search input (conditional on `groups.length >= 8`)
- [ ] Show item counts for all groups including zero
- [ ] Final terminology sweep

**ActiveFilterSummary:**
- [ ] Create `components/ui/FilterBar/ActiveFilterSummary.tsx` — compact sticky bar
- [ ] Integrate into TieredFilterBar with IntersectionObserver
- [ ] Shows filter count + chips + "Clear all" + "Show filters" scroll-back
- [ ] Mobile: condensed "N filters" display

**Testing & docs:**
- [ ] Manual: create 10+ labels, verify search works
- [ ] Scroll down with active filters, verify sticky summary appears
- [ ] "Show filters" scrolls back to filter bar
- [ ] Update `STYLE_GUIDE.md` with ActiveFilterSummary pattern

---

### Phase 7: Review Queues Standardization

**Scope:** Bring review pages into the TieredFilterBar pattern.

**Compliance Review** (9 filters):
- [ ] Audit `components/review/` for filter components
- [ ] Determine primary vs. advanced split
- [ ] Refactor to use TieredFilterBar
- [ ] Run `pnpm test:e2e`

**JenAI Review** (11 filters with source-dependent sub-filters):
- [ ] Audit current filter pattern (source-dependent cascading)
- [ ] Determine primary vs. advanced split (preserve source-dependent behavior)
- [ ] Refactor to use TieredFilterBar
- [ ] Run `pnpm test:e2e`

**Definitions Review:**
- [ ] Audit and align to same pattern
- [ ] Run `pnpm test:e2e`

---

### Phase 8: Remaining Browse Views Standardization

**Scope:** Migrate non-FilterBar views to FilterBar, evaluate remaining flat views.

**Browse Regulations** (3 inline filters, no FilterBar):
- [ ] `components/browse/BrowseFilters.tsx` — migrate to FilterBar + FilterField
- [ ] Run `pnpm test:e2e`

**Statutes Browse** (3 inline filters, no FilterBar):
- [ ] `components/statutes/StatuteBrowseFilters.tsx` — migrate to FilterBar + FilterField
- [ ] Run `pnpm test:e2e`

**Glossary/Definitions** (7 filters, custom GlossaryFilters component):
- [ ] `components/definitions/GlossaryFilters.tsx` — migrate to FilterBar + FilterField
- [ ] Preserve alphabetical letter browsing as a quick-toggle row
- [ ] Run `pnpm test:e2e`

**Burden Analysis** (7 filters, flat panel):
- [ ] Evaluate if 7 filters need tiering (borderline — may stay flat)
- [ ] If yes, adopt TieredFilterBar with 4 primary + 3 advanced
- [ ] Run `pnpm test:e2e`

**Search Results** (8 filters, already tiered):
- [ ] Align toggle button style to match AdvancedFilterToggle
- [ ] Run `pnpm test:e2e`

**Regulations Detail** (7 sidebar facets, custom FacetedFilters):
- [ ] No change — sidebar faceted pattern is appropriate for detail views
- [ ] Document as intentional exception in STYLE_GUIDE.md

---

### Phase 9: Saved Filter Presets (Future)

**Scope:** Let analysts save and recall filter combinations.

- [ ] Create `hooks/useFilterPresets.ts` — CRUD on localStorage, keyed by page + jurisdiction
- [ ] Create `components/ui/FilterBar/FilterPresetBar.tsx` — dropdown + save button + chip display
- [ ] Integrate as optional slot in TieredFilterBar
- [ ] Manual test: save preset → reload page → load preset → filters applied
- [ ] Test cross-jurisdiction isolation (NY presets don't appear on NJ)

---

### Phase 10: Filter State Persistence (localStorage)

**Scope:** Remember the user's filter UI preferences and last-used filter values across sessions so they don't start from scratch every visit.

**Two distinct concerns:**

**A) UI state persistence** — remember whether advanced filters were expanded/collapsed:
- [ ] Create `hooks/useFilterUIState.ts` — reads/writes localStorage keyed by page slug
- [ ] Store: `{ advancedOpen: boolean }` per page (e.g., `filterUI:pipeline`, `filterUI:guidance`)
- [ ] Integrate into `TieredFilterBar` — on mount, read saved state; on toggle, write it
- [ ] Default to collapsed if no saved state exists
- [ ] Test: expand advanced on Pipeline → navigate away → return → still expanded

**B) Last-used filter values** — restore the previous filter combination on page load:
- [ ] Create `hooks/useFilterMemory.ts` — saves current URL query params to localStorage on change
- [ ] Keyed by page + jurisdiction (e.g., `filters:pipeline:ny`, `filters:guidance:ny`)
- [ ] On page load with no URL params, offer to restore: show a subtle banner "Restore previous filters?" with [Restore] [Dismiss] buttons
- [ ] Do NOT auto-apply — the URL is the source of truth, and a clean URL should mean clean filters. The banner is opt-in.
- [ ] Alternatively: auto-apply silently if the user arrived via nav click (no query string), but not if they pasted/shared a URL (has query string). This avoids the banner UX but requires detecting "clean entry" vs "URL with params".
- [ ] Store a timestamp — expire saved filters after 7 days to avoid stale state
- [ ] Test: set filters on Pipeline → close tab → reopen Pipeline → banner offers restore → click Restore → filters applied
- [ ] Test: share a filtered URL → recipient opens it → their saved filters are NOT applied (URL wins)
- [ ] Test: switch jurisdictions → saved filters are jurisdiction-specific

**Visual reference component:**
- [ ] Create `components/ui/FilterBar/FilterRestoreBanner.tsx` — compact inline banner
- [ ] Appears below TieredFilterBar when saved filters exist and current URL has no params
- [ ] Shows: "You had filters active last time: Classification: Burdensome, Severity: High... [Restore] [×]"
- [ ] Dismiss writes a `dismissed` flag so it doesn't re-appear until filters change again
- [ ] Animate in/out with `AnimatedCollapse`

**Integration with TieredFilterBar:**
- [ ] `TieredFilterBar` accepts optional `filterMemoryKey` prop — enables both UI state and filter memory
- [ ] When provided, the component handles localStorage reads/writes internally
- [ ] Pages opt in by passing the key: `filterMemoryKey="pipeline"` or `filterMemoryKey="guidance"`

**Testing & docs:**
- [ ] Manual: set filters → refresh → banner appears → Restore works
- [ ] Manual: dismiss banner → refresh → banner doesn't reappear
- [ ] Manual: advanced open state persists across navigation
- [ ] Verify localStorage keys don't collide across pages/jurisdictions
- [ ] Update `STYLE_GUIDE.md` with filter persistence pattern

---

### Phase 11: Pipeline "Viewed" Tracking

**Scope:** Track which pipeline analysis rows the user has opened (detail drawer or detail page) and visually distinguish viewed vs. unviewed items in the table. Purely client-side via localStorage — no DB changes.

**Concept:** Like read/unread in an email client. Unviewed rows have a visual indicator (blue dot + slightly bolder text). Once you open the drawer or navigate to the detail page, the dot disappears and the row adopts a "read" style. This helps analysts track their review progress across sessions without needing to formally "save" items.

**Hook:**
- [ ] Create `hooks/useViewedItems.ts` — manages a `Set<string>` of viewed item keys in localStorage
  - Key format: `"viewed:pipeline:{jurisdiction}"` → stores `Set` of `"{documentId}-{issueType}"` strings
  - Methods: `markViewed(key)`, `isViewed(key)`, `markAllViewed(keys[])`, `clearViewed()`, `viewedCount`, `unviewedCount`
  - Debounced writes to localStorage (batch rapid views, e.g., scrolling through drawer)
  - Max stored items: cap at 5,000 entries per jurisdiction
  - Eviction policy: when at cap, evict lowest-severity items first, then oldest-viewed as tiebreaker (severity-aware LRU). Store entries as `{ key, severity, viewedAt }` to support this.
  - No expiry — viewed state should persist indefinitely (unlike filter memory)

**Visual treatment in AnalysisTable:**
- [ ] **Unviewed row:** Small blue dot (6px, `--color-info`) in the first column before the title, row text uses `font-medium`
- [ ] **Viewed row:** No dot, row text uses normal `font-normal`, slightly muted via `text-[var(--color-text-secondary)]`
- [ ] The transition from unviewed → viewed happens instantly when the drawer opens or detail page navigates
- [ ] Animate the dot disappearing with a brief fade-out (150ms opacity transition)

**Trigger points — mark as viewed when:**
- [ ] `AnalysisDetailDrawer` opens (the `onOpen` or `useEffect` on the selected row)
- [ ] User navigates to `/[state]/pipeline/[documentId]/[issueType]` detail page (mark in page component `useEffect`)

**Quick filter integration:**
- [ ] Add an "Unviewed" quick toggle button in the pipeline quick-toggles row (alongside Saved, Easy Fix)
- [ ] Icon: `Eye` / `EyeOff` from lucide
- [ ] When active, filters the table to only show rows NOT in the viewed set
- [ ] Badge count on the toggle showing unviewed count: `"Unviewed (47)"`
- [ ] This is client-side filtering (no server round-trip) — apply filter on the already-fetched data

**Bulk actions:**
- [ ] Add "Mark All as Viewed" to the bulk action bar when items are selected
- [ ] Add "Mark Page as Viewed" as a subtle link/button near pagination (marks all visible rows)

**Summary stat:**
- [ ] Show "Viewed X of Y" progress indicator near the top of the pipeline page or in the filter summary area
- [ ] Optional: small progress bar showing review coverage

**Files to create/modify:**
- [ ] `hooks/useViewedItems.ts` — new hook
- [ ] `components/analysis/AnalysisTable.tsx` — integrate viewed state into row rendering
- [ ] `components/analysis/AnalysisDetailDrawer.tsx` — call `markViewed()` on open
- [ ] `components/analysis/AnalysisTableFilters.tsx` — add Unviewed quick toggle
- [ ] `app/[state]/pipeline/[documentId]/[issueType]/page.tsx` — call `markViewed()` on mount
- [ ] `components/ui/BulkActionBar.tsx` — add "Mark Viewed" action (optional, pipeline-only)

**Extensibility:**
- [ ] Design the hook generically so it can later be used on Fines, Guidance, and Review pages too
- [ ] The hook takes a `storageKey` param, not hardcoded to pipeline

**Testing:**
- [ ] Manual: open drawer → row dot disappears → refresh → still viewed
- [ ] Manual: navigate to detail page → return → row shows as viewed
- [ ] Manual: toggle "Unviewed" filter → only unviewed rows shown
- [ ] Manual: "Mark Page as Viewed" → all visible rows update
- [ ] Verify localStorage doesn't grow unbounded (check 5,000 cap + severity-aware eviction)
- [ ] Verify viewed state is jurisdiction-specific
- [ ] Run `pnpm test:e2e` — verify no regressions in pipeline table

**Documentation:**
- [ ] Update `STYLE_GUIDE.md` with viewed/unviewed visual pattern
- [ ] Document the localStorage key format and eviction policy

---

### Final Documentation Sweep

- [ ] `STYLE_GUIDE.md` — TieredFilterBar pattern, tier assignment rules, ActiveFilterSummary
- [ ] `STYLE_GUIDE.md` — terminology guide ("Save" + "Label" vocabulary)
- [ ] `STYLE_GUIDE.md` — document which views intentionally don't use TieredFilterBar and why
- [ ] `STYLE_GUIDE.md` — viewed/unviewed pattern, localStorage key conventions
- [ ] Audit all page empty states for consistent "Save" / "Saved" language

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `components/ui/FilterBar/FilterBar.tsx` | Core FilterBar component |
| `components/ui/FilterBar/ClearFiltersButton.tsx` | Clear button (enhance with count) |
| `components/ui/AnimatedCollapse.tsx` | Smooth expand/collapse |
| `components/ui/StickyContainer.tsx` | IntersectionObserver-based sticky |
| `components/analysis/AnalysisTableFilters.tsx` | Pipeline filters (Phase 3 template) |
| `components/guidance/GuidanceBrowseTab.tsx` | Guidance filters (Phase 4, biggest impact) |
| `components/fines/FinesBrowseTab.tsx` | Fines filters (Phase 4) |
| `components/markers/MarkersContent.tsx` | Markers page (Phase 5 decomposition) |
| `components/markers/MarkerGroupManager.tsx` | Label manager (Phase 6) |
| `components/ui/BulkActionBar.tsx` | Bulk actions (Phase 1-2) |
| `components/ui/BookmarkButton.tsx` | Save button (Phase 1) |
| `lib/url/parsers.ts` | All URL filter state definitions |
| `lib/constants/navigation.ts` | Nav config (Phase 1) |
| `STYLE_GUIDE.md` | Design documentation |

## Verification Plan

After all phases:
1. `pnpm test:e2e` passes with no new failures
2. Grep for "Mark All", "Unmark", "Marked" — only internal code references remain
3. Every filter view with 8+ filters uses TieredFilterBar
4. Every filter is URL-persisted (no useState for filter state)
5. Bulk operations show toast feedback
6. STYLE_GUIDE.md documents the TieredFilterBar pattern with tier assignment rules
