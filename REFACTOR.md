# Post-Merge Refactoring Plan: Deproceduralizer Codebase Cleanup

## Executive Summary

After merging the research-pipeline into the main deproceduralizer, a comprehensive analysis identified **3 critical issues** (all now fixed ✅), **15 high-priority improvements**, and numerous code quality enhancements across frontend, backend, and database layers.

---

## CRITICAL ISSUES (Must Fix Before Production)

### 1. ✅ FIXED: Backend: Tuple Unpacking Runtime Error
**Files:**
- `backend/scripts/research_pipeline/tier_orchestrator.py:970`
- `backend/scripts/research_pipeline/tiers/tier2_runner.py:679`

**Status:** Fixed - `call_llm_parse_async()` now returns `(result, usage)` tuple as expected.

---

### 2. ✅ FIXED: Database: Duplicate Migration File Numbers
**Problem:** Multiple migrations shared the same number.

**Status:** Fixed - Renamed with suffixes (0007a, 0007b, 0008a, 0008b, 0009a, 0009b, 0009c, 0014a, 0014b).

---

### 3. ✅ FIXED: Backend: Duplicate Database Connection Function
**File:** `backend/scripts/estimate_compliance_run.py`

**Status:** Fixed - Now imports `get_db_connection` from `shared_utils` (line 22).

---

## HIGH PRIORITY REFACTORING

### Frontend: Large Component Decomposition

| Component | Lines | Split Into |
|-----------|-------|------------|
| `DeveloperCard.tsx` | 723 | `ReviewSummary.tsx`, `DeveloperFormSection.tsx`, `DeveloperItemContent.tsx` |
| `DefinitionReviewCard.tsx` | 711 | `DefinitionAnalysis.tsx`, `DefinitionForm.tsx` |
| `ComplianceIssueCard.tsx` | 537 | `IssueAnalysisSection.tsx`, `EvidenceSection.tsx`, `IssueFormSection.tsx` |
| `DetailPanel.tsx` | 401 | `MetadataSection.tsx`, `RedFlagsSection.tsx`, `ComplianceIssuesSection.tsx` |

### Frontend: Duplicate Highlight Functions (Consolidate)

| File | Function | Action |
|------|----------|--------|
| `lib/utils/highlight.tsx` | `highlightTerm()`, `highlightContext()` | KEEP (canonical) |
| `analysis/RegexMatchesSection.tsx:134-176` | `highlightMatch()` | DELETE, use lib |
| `browse/TreeNode.tsx:44-62` | `highlightMatch()` | DELETE, use lib |

### Frontend: Old Column Fallback Cleanup

5 files have `?? matchedPattern` / `?? matchedContext` fallbacks:
- `DetailPanel.tsx:293-298`
- `ComplianceIssueDisplayCard.tsx:244, 268-269`
- `RegexMatchesSection.tsx:123`
- `ComplianceIssuesList.tsx`
- `review/NeedMoreInfoCard.tsx:119, 135`

**Action:** After verifying database migration complete, remove fallbacks to old column names.

### Backend: Bare Exception Handlers (7 instances)

| File | Line | Fix |
|------|------|-----|
| `refine_patterns.py` | 698 | `except (ValueError, KeyError):` |
| `red_flags.py` | 486, 1202 | `except APIError as e:` + logging |
| `ny_regulations_scraper.py` | 856, 859 | `except RequestException as e:` |
| `nj_regulations_scraper.py` | 881, 884 | `except RequestException as e:` |

### Backend: Missing Observability Integration

Files that make LLM calls but lack trace_context:
- `batch_definitions.py` - Add trace_context parameter
- `red_flags.py` - Add trace_context parameter
- `shared/base_searcher.py` - Add trace_context parameter

### Database: Repository Consolidation

**compliance-issues.repository.ts (2,399 lines)**

1. **Extract shared count helper:**
```typescript
private async getCountsByField(field: any, filters?: Condition[]): Promise<Record<string, number>>
```
Consolidates: `getCountsByStatus()`, `getCountsByType()`, `getDeveloperStatusCounts()`, `getAnalysisTierCounts()`

2. **Extract pagination builder:**
```typescript
private _buildPaginatedQuery(options: PaginationOptions, filters: FilterConditions)
```
Removes 90% duplication between `getAllPaginated()` and `getReviewedPaginated()`.

3. **Fix bookmarks.getCount():**
Change from `array.length` to SQL `COUNT(*)` (100x faster).

### Database: Missing Composite Indexes

Create `0028_add_composite_indexes.sql`:
```sql
CREATE INDEX idx_ci_state_review_severity ON compliance_issues(state, review_status, severity);
CREATE INDEX idx_ci_state_issue_severity ON compliance_issues(state, issue_type, severity);
CREATE INDEX idx_cia_doc_issue ON compliance_issue_analyses(document_id, issue_type);
CREATE INDEX idx_cia_state_tier2 ON compliance_issue_analyses(state, tier2_classification);
```

---

## MEDIUM PRIORITY IMPROVEMENTS

### Frontend Performance: Add Memoization
- Wrap `ReviewSummary` in `React.memo()` (DeveloperCard.tsx)
- Add `React.memo()` to TreeNode.tsx
- Add `useCallback()` to handler props passed down

### Frontend Dead Code: Remove Unused Interface Fields
- `ComplianceIssueDisplayCard.tsx:44` - `requirementText` (unused)
- `ComplianceIssueDisplayCard.tsx:45` - `impactAssessment` (unused)

### Backend: Centralize Configuration
Extend `research_pipeline/config.py` to include:
- MAX_CHARS_PER_REQUEST (from batch_definitions.py)
- Pricing constants (from estimate_compliance_run.py)
- Common error retry policies

### Backend: Move Test Scripts
- `scripts/test_observability.py` → `tests/scripts/test_observability.py`
- `scripts/test_compliance_searcher.py` → `tests/scripts/test_compliance_searcher.py`

### Database: Type Consolidation
Create `src/schema/shared-types.ts`:
- Extract `RegulationContext` interface
- Consolidate `StatusCounts` types
- Create `TierAnalysisBase<T>` generic

### Database: Add Missing Relations
Add to `relations.ts`:
```typescript
export const complianceIssuesRelations = relations(complianceIssues, ({ one }) => ({
  document: one(regulatoryDocuments, {...}),
  analysis: one(complianceIssueAnalyses, {
    fields: [complianceIssues.documentId, complianceIssues.issueType],
    references: [complianceIssueAnalyses.documentId, complianceIssueAnalyses.issueType]
  }),
}));
```

---

## LOW PRIORITY (Future)

### Schema Deprecation Timeline
Legacy columns have been dropped (migration 0031):
- ~~`matched_pattern`~~ → `regex_match_pattern`
- ~~`matched_context`~~ → `regex_match_context` (now NOT NULL)
- ~~`requirement_text`~~ → `verbatim_supporting_text`
- ~~`impact_assessment`~~ → `decision_rationale`

Duplicate analysis columns moved to `compliance_issue_analyses` and dropped (migrations 0032-0033):
- ~~`requirement_found`~~ → `compliance_issue_analyses.requirement_found`
- ~~`is_verbatim`~~ → `compliance_issue_analyses.is_verbatim`
- ~~`required_by_statute`~~ → `compliance_issue_analyses.cites_federal_statute`
- ~~`statute_citation`~~ → `compliance_issue_analyses.federal_citation`
- ~~`verbatim_supporting_text`~~ → `compliance_issue_analyses.verbatim_requirements`
- ~~`decision_rationale`~~ → `compliance_issue_analyses.tier1_reasoning`

Still on `compliance_issues` (move to analyses in PR 6.3):
- `severity` → `compliance_issue_analyses.final_severity`
- `original_severity` → new column on analyses

### Analysis Table Normalization
Consider creating `compliance_issue_analysis_metadata` table for:
- Easy cleanup detection fields
- V5 re-run tracking fields
- Archive Tier 4 columns (V4 legacy)

---

## IMPLEMENTATION ORDER

### Phase 1: Critical Fixes (Day 1) - ~2 hours
1. Fix tuple unpacking in tier_orchestrator.py and tier2_runner.py
2. Rename duplicate migration files
3. Remove duplicate get_db_connection() from estimate_compliance_run.py

### Phase 2: High Priority (Week 1) - ~8-12 hours
1. Fix 7 bare exception handlers
2. Add trace_context to missing LLM-calling scripts
3. Consolidate highlight functions
4. Create composite indexes migration

### Phase 3: Component Refactoring (Week 2) - ~12-16 hours
1. Decompose DeveloperCard.tsx
2. Decompose ComplianceIssueCard.tsx
3. Extract shared repository methods
4. Add memoization to performance-critical components

### Phase 4: Cleanup (Week 3-4) - ~8 hours
1. Remove old column fallbacks (after verification)
2. Create shared-types.ts
3. Type consolidation across repositories
4. Documentation updates

---

## FILES TO MODIFY

### Critical (3 files)
- `backend/scripts/research_pipeline/tier_orchestrator.py`
- `backend/scripts/research_pipeline/tiers/tier2_runner.py`
- `backend/scripts/estimate_compliance_run.py`

### Migrations to Rename (5 files)
- `frontend/packages/database/migrations/0007_add_display_columns.sql`
- `frontend/packages/database/migrations/0009_definition_cross_reference_types.sql`
- `frontend/packages/database/migrations/0009_drop_legacy_definition_tables.sql`
- `frontend/packages/database/migrations/0009_exclude_from_analysis.sql`
- `frontend/packages/database/migrations/0014_original_severity.sql`

### High Priority (15+ files)
- `frontend/apps/web/src/components/review/DeveloperCard.tsx`
- `frontend/apps/web/src/components/issues/ComplianceIssueDisplayCard.tsx`
- `frontend/apps/web/src/components/analysis/RegexMatchesSection.tsx`
- `frontend/apps/web/src/components/browse/TreeNode.tsx`
- `frontend/apps/web/src/components/browse/DetailPanel.tsx`
- `frontend/packages/database/src/repositories/compliance-issues.repository.ts`
- `frontend/packages/database/src/repositories/bookmarks.repository.ts`
- `frontend/packages/database/src/schema/relations.ts`
- `backend/scripts/refine_patterns.py`
- `backend/scripts/red_flags.py`
- `backend/scripts/batch_definitions.py`
- `backend/scripts/ny_regulations_scraper.py`
- `backend/scripts/nj_regulations_scraper.py`

---

## SUCCESS METRICS

| Metric | Before | After Target |
|--------|--------|--------------|
| Runtime errors from tuple unpacking | 2 | 0 |
| Migration numbering conflicts | 5 | 0 |
| Bare except handlers | 7 | 0 |
| DeveloperCard.tsx lines | 723 | <300 |
| compliance-issues.repository.ts lines | 2,399 | <1,800 |
| Duplicate highlight implementations | 4 | 1 |
| Files with old column fallbacks | 5 | 0 |
