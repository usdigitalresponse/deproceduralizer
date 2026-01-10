# Research Pipeline Schema Design - To-Do List

> **Status: HISTORICAL**
> This document describes the original 3-tier design. See `../../` for current architecture.

---

## 1. Tier 1 Quick Signals Consolidation

**Issue**: Multiple boolean fields for quick signals are verbose and could be compressed.

**RESOLVED**: Use single `tier1_reasoning` TEXT field instead of structured signals.

- [x] **1.1** ~~Decide: Compress into single JSONB `tier1_signals` field?~~ **No - use TEXT**
- [x] **1.2** ~~Alternative: Keep only essential fields?~~ **No - just use reasoning text**
- [x] **1.3** Final approach: `tier1_reasoning` TEXT captures all signal info naturally
  - **Rationale**: No use case for querying signals individually. The reasoning text explains why something was classified (e.g., "Found alternative language: 'or by electronic submission'")
  - **Updated in**: `RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md`

---

## 2. Existing Fields Review

**Issue**: Need to verify what fields already exist and their current usage.

**IMPORTANT**: schema.sql is outdated! Actual columns from DB query:

```sql
-- Actual column names (different from schema.sql):
regex_match_pattern VARCHAR        -- (schema.sql says matched_pattern)
regex_match_context TEXT           -- (schema.sql says matched_context)
verbatim_supporting_text TEXT[]    -- ARRAY (schema.sql says requirement_text)
decision_rationale TEXT            -- (schema.sql says impact_assessment)

-- These match schema.sql:
requirement_found BOOLEAN
is_verbatim BOOLEAN
required_by_statute BOOLEAN
statute_citation VARCHAR
severity INTEGER
original_severity INTEGER
```

**To-Do**:

- [x] **2.1** Verify `is_verbatim` column exists and is being populated
  - ✅ Column added in migration 0012_compliance_issues_is_verbatim.sql
  - ✅ Populated via `are_all_verbatim()` function in validation.py
  - ✅ Called in searcher.py line 617, checks ALL array elements
  - ✅ **FIXED**: Now uses `are_all_verbatim()` to check all texts in array

- [x] **2.2** Review `required_by_statute` implementation
  - ✅ Confirmed: Already implemented in searcher.py (lines 701-705, 731, 786-787)
  - ✅ The LLM returns `required_by_statute: true/false/null`
  - ✅ Stored directly in compliance_issues table
  - **For Tier 2**: Consider renaming/aliasing in evidence schema to avoid confusion with `federally_mandated`
  - `required_by_statute` = state statute (e.g., N.J.S.A.)
  - `federally_mandated` = federal requirement (CFR/USC)

- [x] **2.3** Check if `statute_citation` is actually populated
  - Decision: Tier 2 evidence.statute_references will systematically capture this with `is_mandate` flag
  - Post-processing can populate `statute_citation` from evidence if needed

---

## 3. Evidence JSONB Schema Refinement ✅ RESOLVED

**Issue**: The evidence schema needs cleanup to avoid redundancy and add post-processing hooks.

**Resolution**: Replaced separate arrays with unified `context_used[]` array. All context sources (hierarchy, definitions, cross-references, statutes, siblings) use consistent structure with type discriminator.

**To-Do**:

- [x] **3.1** Remove `requirement_quote` from evidence schema
  - ✅ Not included in final evidence schema - existing `verbatim_supporting_text` + `is_verbatim` sufficient

- [x] **3.2** ~~Redesign `definitions_used` for post-processing linkage~~
  - ✅ Merged into unified `context_used` array with `type: "definition"`
  - identifier = term, source_id = definitions.id (post-processed)

- [x] **3.3** ~~Redesign `cross_references_used` for linkage~~
  - ✅ Merged into unified `context_used` array with `type: "cross_reference"`
  - identifier = citation, source_id = target document_id (post-processed)

- [x] **3.4** ~~Redesign `mitigating_factors_checked`~~
  - ✅ **DROPPED** - Mitigating factors (waivers, exemptions, alternatives) are already captured by other context types:
    - Waivers in other sections → `cross_reference` or `sibling` type
    - Definitions that narrow scope → `definition` type
    - Alternatives in same section → `verbatim_supporting_text`
    - Federal exemptions → `statute` type

- [x] **3.5** ~~Redesign `statute_references`~~
  - ✅ Merged into unified `context_used` array with `type: "statute"`
  - Includes `is_mandate` boolean to indicate if statute requires the burden

- [x] **3.6** Finalize complete evidence schema with consistent structure
  - ✅ Replaced separate arrays with unified `context_used[]` array
  - Types: hierarchy | definition | cross_reference | statute | sibling
  - All share: type, identifier, source_id, quote, relevance
  - Type-specific: summary (hierarchy), is_mandate (statute)
  - See RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md for full schema

---

## 4. Classification and Decision Tracking Per Tier ✅ MOSTLY RESOLVED

**Issue**: Each tier can make a classification decision. Need to track decisions at each stage.

**Resolution**: Each tier has its own classification and reasoning fields. Tier 3 CAN reclassify.

**To-Do**:

- [x] **4.1** Confirm Tier 3 can also reclassify
  - ✅ Yes - added `tier3_classification` with values 'unchanged' | 'justified'
  - Web search may reveal federal mandate → reclassify to justified

- [x] **4.2** Track reasoning at each tier
  - ✅ Added: tier1_reasoning, tier2_reasoning, tier3_reasoning

- [x] **4.3** Decide: Should `unrelated_reason` and `justification_reason` be tier-specific?
  - ✅ Decision: NOT adding separate columns. Reasoning is captured in tier*_reasoning fields.
  - The tier*_reasoning explains why something is unrelated/justified/burdensome.

- [x] **4.4** Add field to track which tier made final determination
  - ✅ Added `classification_tier` (1, 2, or 3)

---

## 5. Justified Items: Remove Improvement Opportunity ✅ RESOLVED

**Issue**: For justified items, suggesting improvements is counterproductive. If something is justified, the severity should just be low (1-3).

**Resolution**: Chose Option B - justified items have requirement_found=true with is_justified=true flag.

**To-Do**:

- [x] **5.1** Remove `improvement_opportunity` column from schema
  - ✅ Not included in schema proposal

- [x] **5.2** Decide: How to handle "justified" classification?
  - ✅ Chose **Option B**: `requirement_found = true`, severity 1-3, `is_justified = true`
  - Rationale: Captures that burden exists but is acceptable
  - Derivation logic in schema proposal:
    - tier2_classification = 'justified' → is_justified=true, requirement_found=true, severity 1-3
    - tier3_classification = 'justified' (reclassification) → same

---

## 6. Tier 2/3 Shared Fields ✅ RESOLVED

**Issue**: Some fields should be fillable at either Tier 2 or Tier 3.

**Resolution**: Track both tier-specific values AND final computed values. Federal mandate info captured in context_used.

**To-Do**:

- [x] **6.1** Design pattern for tier updates
  - ✅ Tier 2 sets: `tier2_classification`, `severity` (initial), `severity_calculation`
  - ✅ Tier 3 can adjust: `tier3_classification`, `tier3_severity_adjustment`
  - ✅ Final `severity` = tier2 severity + tier3_severity_adjustment
  - ✅ `requirement_found`, `is_justified` derived from latest classification

- [x] **6.2** Decide approach: tier-specific vs final only
  - ✅ Chose hybrid: track tier-specific classifications + adjustments, derive final values
  - Audit trail preserved via tier*_classification, tier*_reasoning fields

- [x] **6.3** For `federally_mandated`
  - ✅ Dropped as separate column - derivable from `context_used`
  - Tier 2: context_used entries with type='statute', is_mandate=true, identifier matches CFR/USC
  - Tier 3: context_used entries with type='web', is_mandate=true for federal sources
  - `state_discretion` field on those entries captures flexibility

---

## 7. Pipeline Tracking Fields ✅ RESOLVED

**Issue**: Need to track which pipeline version and tier processed each item.

**Resolution**: Added pipeline_version, highest_tier_completed, classification_tier, tier*_batch_id, tier*_completed_at.

**To-Do**:

- [x] **7.1** Confirm field names and types
  - ✅ All in schema proposal with correct types

- [x] **7.2** Add `tier1_batch_id`, `tier2_batch_id` separately? Or single `batch_id`?
  - ✅ Chose **Option B**: Separate `tier1_batch_id`, `tier2_batch_id` columns
  - Enables tracing issues back to specific batch runs

- [x] **7.3** Add timestamps for each tier
  - ✅ Added: tier1_completed_at, tier2_completed_at, tier3_completed_at

---

## 8. Severity Calculation Tracking ✅ RESOLVED

**Issue**: Need to track how severity was calculated, not just final value.

**Resolution**: Added severity_baseline and severity_calculation (TEXT) to schema.

**To-Do**:

- [x] **8.1** Add `severity_baseline` column
  - ✅ In schema proposal
  - Populated from prompts/compliance_issues.yaml issue config

- [x] **8.2** Add `severity_calculation` column
  - ✅ In schema proposal as TEXT
  - Example: "Baseline 6 (mail_only) + no alternatives (+2) - professional licensee (-1) = 7"

- [x] **8.3** Decide: TEXT formula vs JSONB structure?
  - ✅ Chose **Option A**: TEXT
  - Rationale: Severity breakdown is for human review, not querying. Simpler.

---

## 9. Web Search Sources Schema ✅ RESOLVED

**Issue**: Tier 3 web search results need structured storage.

**Resolution**: Web sources folded into unified `context_used` array with `type: "web"`. Dropped separate `web_search_sources` column.

**To-Do**:

- [x] **9.1** Add date/recency tracking
  - ✅ `publication_date` field added to context_used schema for type='web'
  - DERIVED from web search tool response, not LLM-generated

- [x] **9.2** Decide max sources to store (5? 10?)
  - ✅ No hard limit in schema, but testing note suggests ≤10
  - Can enforce in pipeline code if needed

- [x] **9.3** Add `web_search_query` field to track what was searched
  - ✅ Chose **Option B**: Skip it
  - Queries captured in `web_search_topics` (Tier 2) and `tier3_reasoning`

---

## 10. Index Strategy

**Issue**: New columns need appropriate indexes for query performance.

**To-Do**:

- [ ] **10.1** Define indexes for tier classifications:
  ```sql
  CREATE INDEX idx_ci_tier1_classification ON compliance_issues(tier1_classification);
  CREATE INDEX idx_ci_tier2_classification ON compliance_issues(tier2_classification);
  ```

- [ ] **10.2** Define partial indexes for pipeline workflow:
  ```sql
  -- Items needing Tier 2 processing
  CREATE INDEX idx_ci_needs_tier2 ON compliance_issues(id)
    WHERE tier1_classification = 'needs_research' AND tier2_classification IS NULL;

  -- Items needing Tier 3 processing
  CREATE INDEX idx_ci_needs_tier3 ON compliance_issues(id)
    WHERE needs_web_search = true AND tier3_completed_at IS NULL;
  ```

- [ ] **10.3** GIN index for context_used JSONB:
  ```sql
  CREATE INDEX idx_ci_context_used ON compliance_issues USING GIN (context_used);
  ```

---

## 11. Final Schema Decisions Summary ✅ DESIGN COMPLETE

**Status**: All schema design decisions resolved. Ready for implementation.

**To-Do** (Implementation Phase):

- [x] **11.1** Create final column list with types
  - ✅ See RESEARCH_PIPELINE_SCHEMA_PROPOSAL.md - complete with 56 total columns

- [ ] **11.2** Create migration SQL

- [ ] **11.3** Update `.claude/skills/database/schema.md`

- [ ] **11.4** Update `docs/RESEARCH_PIPELINE_DESIGN.md` output schemas
  - Align with new context_used structure

- [ ] **11.5** Create Pydantic models in `backend/scripts/research_pipeline/models.py`

---

## Quick Reference: Current compliance_issues Columns (30)

**From actual DB query** (schema.sql is outdated!):

| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| document_id | bigint | FK |
| issue_type | varchar | |
| occurrence_number | integer | |
| regex_match_pattern | varchar | ⚠️ schema.sql says matched_pattern |
| regex_match_context | text | ⚠️ schema.sql says matched_context |
| url | text | |
| requirement_found | boolean | |
| verbatim_supporting_text | text[] | ⚠️ ARRAY, schema.sql says requirement_text |
| is_verbatim | boolean | |
| required_by_statute | boolean | |
| statute_citation | varchar | |
| severity | integer | |
| original_severity | integer | |
| decision_rationale | text | ⚠️ schema.sql says impact_assessment |
| review_status | varchar | |
| reviewed_by | varchar | |
| reviewed_at | timestamp | |
| justification_notes | text | |
| team_notes | text | |
| impact_type | varchar | |
| developer_status | varchar | |
| developer_assigned | varchar | |
| developer_notes | text | |
| resolution_type | varchar | |
| resolution_comments | text | |
| developer_question | text | |
| developer_checked_at | timestamp | |
| state | varchar | |
| created_at | timestamp | |

**Total existing**: 30 columns

**TODO**: Sync schema.sql with actual DB or vice versa

---

## Appendix: Questions for User ✅ ALL RESOLVED

1. **Justified items**: ✅ `requirement_found=true` with `is_justified=true`, severity 1-3

2. **Tier 3 reclassification**: ✅ Yes, can change burdensome → justified via `tier3_classification`

3. **Evidence linkage**: ✅ Hybrid approach - citation always, source_id populated by post-processing. All unified in `context_used` array.

4. **Audit trail**: ✅ Track both tier-specific (tier2_classification, tier3_severity_adjustment) AND derive final values
