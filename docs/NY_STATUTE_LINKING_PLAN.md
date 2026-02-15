> **Status: IMPLEMENTED — First NY run complete (Title 18)**
> - Phase 1 (Ingest statutes): ✅ Complete (41,348 statutes across 94 laws)
> - Phase 2 (Law name mapping): ✅ Complete
> - Phase 3 (Regex scan): ✅ Complete (6,437 links created, 4,934 matched)
> - Phase 4 (Link type classification): ✅ Complete (regex-based, no LLM needed)
> - Phase 5 (LLM statutory mandate check): ✅ Complete (12 NY checks run, all not statute-mandated)

# Plan: Link NY Statutes to NY Regulations

## Goal

Connect NY regulations (NYCRR) to NY statutes (NYCLS) via the `regulation_statute_links` table. Then, for regulations flagged by the compliance research pipeline, use an LLM to determine whether flagged issues are mandated by the cited statute or added by the agency.

## Current Status

### What's built

| File | Purpose | Status |
|------|---------|--------|
| `backend/scripts/ny_statutes.py` | Ingest statutes from OpenLegislation API | ✅ Complete (41,348 statutes) |
| `backend/lib/ny_law_names.py` | Law name → law ID mapping (94 laws + variants) | ✅ Complete |
| `backend/scripts/link_ny_statutes.py` | Regex citation scan + link creation | ✅ Complete |

### Linking results (40,518 NY regulation sections, 4 seconds)

- **6,516 citations found** across 4,431 regulations
- **98.8% law name resolution** (only 79 unknown out of 6,516)
- **Link type classification** (regex-based):
  - enabling_authority: 2,649
  - reference: 2,033
  - requirement: 937
  - definition: 818
- **4,934 matched** to statutes in DB (all 94 laws ingested)
- **1,503 unmatched** (section not in DB — partial article ingestion)
- **6,437 links** upserted to `regulation_statute_links`

### Compliance issue scan results (40 issue types, dry-run)

- **9,571 regex matches** across 61,540 NY documents
- Top hits: mandated_reports (2,017), storage_location (1,027), certified_mail (661), check_payment (560), landline (494), mail_only (434)

## How the Regex Linking Works

### Citation patterns captured

| Pattern | Example | Extracts |
|---------|---------|----------|
| `section X of the Y Law` | "section 488 of the Social Services Law" | SOS 488 |
| `Y Law section X` | "Education Law section 4401" | EDN 4401 |
| `Y Law § X` | "Public Health Law § 2801" | PBH 2801 |
| `subdivision (a) of section X of the Y Law` | "subdivision (a) of section 413 of the Social Services Law" | SOS 413 |

### Link type classification (regex context matching)

The scanner looks at ±150 characters around each citation and matches phrases:

| Link Type | Context Phrases |
|-----------|----------------|
| `enabling_authority` | "pursuant to", "authorized by", "authority of", "STATUTORY AUTHORITY" |
| `definition` | "as defined in", "means", "shall mean", "the meaning given" |
| `requirement` | "as required by", "in accordance with", "shall comply with" |
| `reference` | (default — no specific phrase matched) |

### Real examples from the DB

**Matched:**
- `14 NYCRR 624.3` → `SOS 488` (definition) — "...safety, treatment, or supervision of an individual receiving services..."
- `18 NYCRR 421.6` → `SOS 373` (enabling_authority) — "...biological parent or guardian has a full understanding..."

**Unmatched (law resolved, section not yet ingested):**
- `9 NYCRR 5321.2` → `PML 1335` (enabling_authority) — "...possess, maintain or exhibit gaming devices..."
- `8 NYCRR 90.5` → `EDN 272` (reference) — "...statewide library service goals..."

### What the regex does NOT tell us

The link type says "this regulation cites statute X as authority." But for a **flagged** regulation, the real question is:

> **Does the statute actually require the specific problematic thing, or did the agency go beyond what the statute says?**

## Phase 5: LLM Statutory Mandate Check (IMPLEMENTED)

See [issue #124](https://github.com/michaeleboyce/deproceduralizer/issues/124) for full discussion.

### When it runs

After the compliance research pipeline flags NY regulations (Tier 1-3 analysis), this step checks whether flagged issues are statute-mandated. Pipeline order:

1. ✅ Ingest NY statutes → `statutes` table (41,348 statutes)
2. ✅ Regex-link regulations to statutes → `regulation_statute_links` table (6,437 links)
3. ✅ Scan NY regulations for compliance issues → `compliance_issues` table (9,571 matches)
4. 🔄 Run research pipeline (Tier 1-3) → `compliance_issue_analyses` table (Title 18 done, rest pending)
5. ✅ **Statutory mandate check** → `statute_mandate_checks` table (12 NY checks complete)

### Implementation

- **DB table**: `statute_mandate_checks` (migration 0042)
- **Pydantic model**: `StatuteMandateOutput` in `backend/scripts/research_pipeline/models/statute_mandate.py`
- **Runner**: `run_statute_mandate_checks()` in `backend/scripts/research_pipeline/tiers/statute_mandate_runner.py`
- **Prompt**: `statute_mandate` section in `prompts/research_pipeline.yaml`
- **CLI**: `--statute-mandate` (post-pipeline) or `--run-statute-mandate-only` (standalone)

For each flagged regulation (burdensome/justified) that has matched statute links:
1. Pulls the regulation text, compliance issue info, and linked statute text
2. Asks the LLM: "Does the statute mandate this specific flagged aspect?"
3. Stores: `statute_mandated` (bool), `confidence`, `reasoning`, `statute_text_excerpt`
4. Skips already-checked (analysis_id, statute_id) pairs via UNIQUE constraint

### Scope

Small number of LLM calls — only flagged regulations with matched statute links, not all 6,500+ links.

### First run results (Title 18 NYCRR — child care/social services)

Pipeline run ($2.13, 22 min batch):
- **Tier 1**: 100 requests → 74 false positives filtered, 26 advanced
- **Tier 2**: 26 requests → 4 burdensome, 15 justified, 7 unrelated
- **Mandate checks**: 12 (analysis, statute) pairs → **all 12 not statute-mandated**

Burdensome findings (all agency-added, not required by statute):
| Regulation | Issue | Severity | Statutes checked |
|-----------|-------|----------|-----------------|
| `18 NYCRR 359.7` | In-person hearings for public assistance | 7 | — |
| `18 NYCRR 399.6` | In-person hearings | 7 | — |
| `18 NYCRR 300.6` | Certified mail between gov entities | 6 | — |
| `18 NYCRR 449.4` | Check/money order only for $5 fees | 6 | SOS 488, SOS 495, EXC 553 |

## Commands

```bash
# Ingest all statutes (running now, ~4 hours)
python backend/scripts/ny_statutes.py

# Link regulations to statutes (run after ingestion)
python backend/scripts/link_ny_statutes.py              # Real run
python backend/scripts/link_ny_statutes.py --dry-run     # Preview
python backend/scripts/link_ny_statutes.py --law SOS     # Filter by law
python backend/scripts/link_ny_statutes.py --title 18    # Filter by NYCRR title

# Scan for compliance issues (run with PYTHONPATH=backend from project root)
PYTHONPATH=backend python backend/scripts/scan_compliance_issues.py --state ny
PYTHONPATH=backend python backend/scripts/scan_compliance_issues.py --state ny --dry-run

# Research pipeline (small test batch)
cd backend && python3 -m scripts.research_pipeline.cli \
  --state ny --all-issues --limit 5 --global-limit 20 --execute

# Statute mandate check (preview)
cd backend && python3 -m scripts.research_pipeline.cli \
  --state ny --all-issues --run-statute-mandate-only

# Statute mandate check (run first 10 pairs)
cd backend && python3 -m scripts.research_pipeline.cli \
  --state ny --all-issues --run-statute-mandate-only --execute --limit 10

# Statute mandate check after full pipeline
cd backend && python3 -m scripts.research_pipeline.cli \
  --state ny --all-issues --execute --statute-mandate
```

## Cost Estimate

| Step | Cost | Time | Actual (Title 18) |
|------|------|------|-------------------|
| Ingest all laws | Free (API) | ~2 hours | Done |
| Regex scan + link type | Free | 4 seconds | Done |
| Compliance issue regex scan | Free | ~5 minutes | Done |
| Research pipeline (Title 18) | — | — | $2.13, 22 min |
| Research pipeline (full NY) | ~$50-100 | Hours (batch) | Pending |
| Statutory mandate check | ~$5-10 | Depends on flagged count | 12 checks done |
