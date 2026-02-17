# Abigail's Open Issues — Plan

> **Created:** 2026-02-17
> **Last updated:** 2026-02-17

## Done — Close These

These are complete (shipped in PR #172, #189, or earlier work):

| Issue | Title | Why it's done |
|-------|-------|---------------|
| #158 | docs: document 'state' column semantics | Done in Step 2, merged in #189 branch |
| #159 | feat: widen state column and add NYC/RCNY schema | Migrations 0044-0046 applied, PR #172 merged |
| #160 | feat: update TypeScript constants and backend config | NYC in STATE_CONFIG, VALID_STATES, PR #172 |
| #161 | feat: add document_tags table | Migration 0048, --tag flag, PR #189 branch |
| #169 | feat: build RCNY scraper | RCNY parser built + 7,777 docs imported, PR #172 |
| #170 | chore: verify/refresh NYC statute data and linking | 850 Charter + 10,241 Admin Code + 2,118 links |
| #171 | chore: write and run database migrations | Migrations 0044-0048 all applied to prod |
| #118 | Tell Abigail what in NYS Statute and NYC Code to scrape | Scraping done — Charter, Admin Code, RCNY all in DB |
| #163 | feat: configure compliance pipeline for NYC scanning | **DONE** — all pipeline scripts updated + test run on Title 24 |

## In Progress — On Current Branch (`feature/nyc-jurisdiction-docs`)

| Issue | Title | Status |
|-------|-------|--------|
| #162 | feat: extend cross_references for cross-jurisdiction links | RCNY→NYCRR cross-refs done (3,953). Migration 0050: `source_jurisdiction`/`target_jurisdiction` columns added + backfill. **Ready to apply.** |

## #163 Pipeline Run Results (NYC Title 24 test)

| Step | Result |
|------|--------|
| Compliance scan | 2,008 regex matches (all NYC, not just Title 24) |
| Definitions | 328 extracted, 974 links (Title 24) |
| Summarization | 294 sections summarized + imported (Title 24) |
| Research pipeline | 100 Tier 1 → 5 Tier 2 → 2 burdensome (confirmed Tier 3) |
| Cost | ~$0.30 for Tier 3 web search |

## Remaining Work — Not Started

| Issue | Title | Notes |
|-------|-------|-------|
| #45 | Verify compliance issues detection across all issue types | Spot-check work, can do alongside NYC pipeline run |
| #31 | Investigate unlinked definitions (3,146 in NY) | Research task — check why definitions aren't matching |
| #16 | Look at parsing when information is in table | Table content in regs gets garbled — scraper improvement |
| #11 | Reduce extraneous new lines | Display cleanup in regulation text |

## Suggested Order (remaining)

### 1. Finish #162 — Cross-jurisdiction metadata (small)
Add `source_jurisdiction`, `target_jurisdiction` columns to `cross_references`. Backfill from existing data. Low priority — the links work fine without metadata.

### 2. #45 — Verify compliance detection (medium)
Spot-check compliance issue types against real regulation text. Good to do after running NYC pipeline to have fresh data to check.

### 3. #31 — Investigate unlinked definitions (medium)
3,146 NY definitions not linked to documents. Could be scope issues, naming mismatches, or definitions from repealed sections.

### 4. #16 — Table parsing (larger effort)
Improve scraper to handle tabular data in regulation text. Affects display quality.

### 5. #11 — Extraneous newlines (small)
Cleanup pass on regulation text display. Could be a simple regex fix or scraper adjustment.
