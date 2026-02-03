---
name: research-pipeline
description: Run the 3-tier regulatory burden analysis pipeline. Use when processing compliance issues, running batch analysis, or checking pipeline status.
---

# Research Pipeline CLI

Run the 3-tier regulatory burden analysis pipeline on compliance issue documents.

```bash
cd backend && python3 -m scripts.research_pipeline.cli [OPTIONS]
```

## Quick Reference

| Goal | Command |
|------|---------|
| Preview what would run | Add `--dry-run` |
| Test single issue type | `--issue-type mail_only --max-docs-per-issue 10` |
| Full production run | `--all-issues --max-tier 3 --enable-web-search true` |
| Reprocess after prompt change | Add `--force-rerun` |
| Filter by regulatory title | `--title 7` |
| Immediate results (2x cost) | Add `--realtime` |

## Required Flags

All of these must be specified:

| Flag | Values | Description |
|------|--------|-------------|
| `--state` | `nj`, `ny`, `dangerously-run-all` | State to process |
| `--issue-type` OR `--all-issues` | issue name OR flag | Single issue vs all 43 issues |
| `--max-docs-per-issue` | `N` or `all` | Max docs per issue type |
| `--global-docs-limit` | `N` or `no-limit` | Max total docs across all issues |
| `--max-tier` | `1`, `2`, `3` | How far to process |
| `--enable-web-search` | `true`, `false` | Enable Tier 3 web search |

## Optional Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--realtime` | batch API | Use realtime API (faster, 2x cost) |
| `--title` | none | Filter by title (e.g., `7` for Title 7) |
| `--dry-run` | false | Preview without API calls |
| `--force-rerun` | false | Ignore previous analyses, reprocess all |
| `--resume-batch` | none | Resume from a specific batch directory |
| `--resume-tier` | none | Resume from a specific tier (1, 2, or 3) |

## Tier Guide

| Tier | Purpose | Cost/Doc | When to Use |
|------|---------|----------|-------------|
| 1 | Match filtering | ~$0.002 | Quick triage, filter false positives |
| 2 | Classification + severity | ~$0.006 | Standard analysis |
| 3 | Web search validation | ~$0.020 | High-severity, federal citations |

**Tier 3 triggers** (when `--enable-web-search true`):

| # | Trigger | Condition | Rationale |
|---|---------|-----------|-----------|
| 1a | High-risk + justified | High-risk issue type AND classification = "justified" | 54-63% valuable |
| 1b | High-risk + severity | High-risk issue type AND severity >= 7 | 53% valuable |
| 2 | Federal statute cited | `cites_federal_statute = true` | Federal citations need verification |
| 3 | No alternative claimed | `claims_no_alternative = true` AND severity >= 7 | High-impact claims |
| 4 | Low confidence | confidence < 0.85 AND severity >= 7 | 44% valuable |
| 5 | Controversial justified | classification = "justified" AND controversial | Civil rights, vulnerable populations |
| 6 | Federal mandate suspected | `federal_mandate_suspected = true` | Unverified federal mandates |
| 7 | Random sample | 10% random sampling | Quality assurance |

**High-risk issue types:** `newspaper`, `notarization`, `wet_signature`, `witness`, `mandated_reports`, `in_person_*`

**Skip condition** (low value): Burdensome + high confidence (≥0.85) + high severity (≥7) + no federal statute cited → only 17% valuable, skipped unless random sampled

## Common Commands

### Dry Run Preview
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all-issues \
  --max-docs-per-issue 50 --global-docs-limit 500 \
  --max-tier 3 --enable-web-search true --dry-run
```

### Single Issue Test (10 docs)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --issue-type mail_only \
  --max-docs-per-issue 10 --global-docs-limit no-limit \
  --max-tier 2 --enable-web-search false
```

### All Issues Batched (Production)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all-issues \
  --max-docs-per-issue 50 --global-docs-limit 500 \
  --max-tier 3 --enable-web-search true
```

### Force Re-run (After Prompt Changes)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --issue-type wet_signature \
  --max-docs-per-issue all --global-docs-limit no-limit \
  --max-tier 2 --enable-web-search false --force-rerun
```

### Title-Specific Processing
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all-issues \
  --max-docs-per-issue 50 --global-docs-limit 500 \
  --max-tier 2 --enable-web-search false --title 7
```

### Realtime API (Immediate, Testing)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --issue-type mail_only \
  --max-docs-per-issue 5 --global-docs-limit no-limit \
  --max-tier 2 --enable-web-search false --realtime
```

## Cost Estimates

| Scenario | Docs | Tier | API | Est. Cost |
|----------|------|------|-----|-----------|
| Quick test | 10 | 2 | realtime | ~$0.12 |
| Single issue | 100 | 2 | batch | ~$0.30 |
| All issues (capped) | 500 | 2 | batch | ~$1.50 |
| Full state | 5,000 | 3 | batch | ~$50-60 |

**Cost optimization:**
- Use batch API (50% cheaper than realtime)
- Start with `--max-tier 1` to filter false positives first
- Use `--dry-run` to preview scope before committing
- Cap with `--global-docs-limit` for budget control

## Resume Behavior

The pipeline automatically saves state and resumes:

- **State files**: `backend/.pipeline_batches/`
- **Auto-resume**: Rerunning same parameters resumes interrupted runs
- **Skip completed**: Documents already analyzed to target tier are skipped
- **Resume partial**: Documents with partial progress continue from last tier

**Override resume**: Use `--force-rerun` to reprocess everything

**Manual resume**: Use `--resume-batch <dir>` and `--resume-tier <N>` to recover from specific batch

## State Machine

The pipeline uses a 15-state machine to track processing units through tiers.

### Processing States

| State | Description |
|-------|-------------|
| `PENDING` | Initial state - not yet processed |
| `TIER1_QUEUED` | Queued for Tier 1 batch |
| `TIER1_SUBMITTED` | Tier 1 batch submitted, awaiting results |
| `TIER1_COMPLETE` | Tier 1 complete, ready for routing |
| `TIER2_PENDING` | Waiting for context fetch |
| `TIER2_QUEUED` | Queued for Tier 2 batch |
| `TIER2_SUBMITTED` | Tier 2 batch submitted, awaiting results |
| `TIER2_RERUNNING` | Re-running with additional context (real-time API) |
| `TIER2_COMPLETE` | Tier 2 complete, ready for routing |
| `TIER3_PENDING` | Waiting for web search |
| `TIER3_SUBMITTED` | Tier 3 batch submitted (V5.2) |
| `TIER3_PROCESSING` | Processing with web search (real-time only) |
| `TIER3_COMPLETE` | Tier 3 complete |
| `DONE` | Classification complete |
| `DONE_FALSE_POSITIVE` | All matches were false positives |
| `ERROR` | Processing failed |

### State Flow

```
PENDING → TIER1_QUEUED → TIER1_SUBMITTED → TIER1_COMPLETE
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ↓                                                   ↓
          all_false_positives                                  needs_research
                    ↓                                                   ↓
          DONE_FALSE_POSITIVE                         TIER2_PENDING → TIER2_QUEUED
                                                                        ↓
                                                      TIER2_SUBMITTED/TIER2_RERUNNING
                                                                        ↓
                                                                TIER2_COMPLETE
                                                                        │
                    ┌───────────────────────────────────────────────────┼───────────────┐
                    ↓                                                   ↓               ↓
               unrelated                                     justified/burdensome   Tier 3
                    ↓                                        (no trigger)          trigger met
                  DONE                                              ↓                   ↓
                                                                  DONE          TIER3_PENDING
                                                                                       ↓
                                                               TIER3_SUBMITTED/TIER3_PROCESSING
                                                                                       ↓
                                                                               TIER3_COMPLETE
                                                                                       ↓
                                                                                     DONE
```

### Routing Logic

- **After Tier 1**: `all_false_positives` → DONE_FALSE_POSITIVE, otherwise → TIER2
- **After Tier 2**: `unrelated` → DONE, check Tier 3 triggers, otherwise → DONE
- **After Tier 3**: → DONE (final tier)

## Tier 3 Modes (V5.2)

Tier 3 supports two execution modes:

| Mode | Flag | Cost | Speed | Use Case |
|------|------|------|-------|----------|
| Batch (default) | (none) | 50% discount | 10-40 min | Production runs, cost optimization |
| Real-time | `--realtime` | Full price | Immediate | Testing, debugging, urgent analysis |

**Batch mode** (default):
- Submits all Tier 3 requests as a single batch
- Polls for completion with progress updates
- Automatically handles batch result processing
- Uses structured outputs for reliable JSON parsing

**Real-time mode** (`--realtime`):
- Processes Tier 3 requests sequentially
- Uses rate limiting (5 concurrent requests)
- Immediate results but 2x cost
- Better for debugging or small batches

## API Timing

| Mode | Typical Time | Max Time |
|------|--------------|----------|
| Batch API | 10-40 min | 24 hours |
| Realtime API | Immediate | N/A |

The batch API polls automatically and prints progress updates.

## Database Output

Results saved to `compliance_issue_analyses` table:
- Incremental writes after each tier
- Contains tier outputs, classification, severity, verbatim requirements
- Query with: `./scripts/db-query.sh "SELECT * FROM compliance_issue_analyses WHERE issue_type = 'mail_only' LIMIT 10"`

## Important Notes

- **Always ask permission** before running - pipeline makes API calls that cost money
- **Use `--dry-run` first** for large runs to preview scope
- **Batch API can take 24h** in peak times (typically 10-40 min)
- **Don't kill running pipelines** without asking - they may have in-flight batches
