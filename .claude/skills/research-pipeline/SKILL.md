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
| Preview what would run | `--state nj --all` (dry-run is default) |
| Test single issue type | `--state nj --issue mail_only --execute` |
| Full production run | `--state nj --all --execute --max-tier 3 --web-search` |
| Reprocess after prompt change | Add `--force-rerun` |
| Filter by regulatory title | `--title 7` |
| Immediate results (2x cost) | Add `--realtime` |

## Required Flags

| Flag | Values | Description |
|------|--------|-------------|
| `--state` | `nj`, `ny`, `dangerously-run-all` | State to process |
| `--issue` OR `--all` | issue name OR flag | Single issue vs all 41 issues (must choose one) |

## Flags With Defaults (Cost-Safe)

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | `1000` | Max docs per issue type (`N` or `all`) |
| `--global-limit` | `100` | Max total docs across all issues (`N` or `no-limit`) |
| `--max-tier` | `2` | How far to process: 1=filter, 2=classify, 3=web search |
| `--web-search` | off | Enable Tier 3 web search |

## Optional Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--execute` | off (dry-run) | Actually run the pipeline (default previews only) |
| `--realtime` | batch API | Use realtime API (faster, 2x cost) |
| `--title` | none | Filter by title (e.g., `7` for Title 7) |
| `--force-rerun` | false | Ignore previous analyses, reprocess all |

## Tier Guide

| Tier | Purpose | Cost/Doc | When to Use |
|------|---------|----------|-------------|
| 1 | Match filtering | ~$0.002 | Quick triage, filter false positives |
| 2 | Classification + severity | ~$0.006 | Standard analysis |
| 3 | Web search validation | ~$0.020 | High-severity, federal citations |

**Tier 3 triggers** (when `--web-search` enabled):

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

### Preview (Default Behavior)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all
```

### Single Issue Test
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --issue mail_only --execute
```

### All Issues With Limits
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all --execute --global-limit 500
```

### Full Pipeline With Web Search
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all --execute --max-tier 3 --web-search
```

### Force Re-run (After Prompt Changes)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --issue wet_signature --execute \
  --limit all --global-limit no-limit --force-rerun
```

### Title-Specific Processing
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all --execute --global-limit 500 --title 7
```

### Realtime API (Immediate, Testing)
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --issue mail_only --execute \
  --limit 5 --realtime
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
- Default is dry-run — use `--execute` only when ready
- Cap with `--global-limit` for budget control (default: 100)

## Resume Behavior

The pipeline automatically resumes interrupted runs:

- **Skip completed**: Documents already analyzed to target tier are skipped
- **Resume partial**: Documents with partial progress continue from last tier

**Override resume**: Use `--force-rerun` to reprocess everything

## State Machine

The pipeline uses an 8-state machine to track processing units through tiers.

### Processing States

| State | Description |
|-------|-------------|
| `PENDING` | Initial state - not yet processed |
| `TIER1_COMPLETE` | Tier 1 complete, ready for routing |
| `TIER2_PENDING` | Waiting for context fetch |
| `TIER2_COMPLETE` | Tier 2 complete, ready for routing |
| `TIER3_PENDING` | Waiting for web search |
| `TIER3_COMPLETE` | Tier 3 complete |
| `DONE` | Classification complete |
| `DONE_FALSE_POSITIVE` | All matches were false positives |
| `ERROR` | Processing failed |

### Routing Logic

- **After Tier 1**: `all_false_positives` → DONE_FALSE_POSITIVE, otherwise → TIER2_PENDING
- **After Tier 2**: `unrelated` → DONE, check Tier 3 triggers, otherwise → DONE
- **After Tier 3**: → DONE (final tier)

## Statute Mandate Check (NY only)

Post-pipeline step for NY regulations. Checks whether cited statutes actually mandate flagged issues.

```bash
# Preview
python3 -m scripts.research_pipeline.cli \
  --state ny --all --run-statute-mandate-only

# Run (first 10 pairs)
python3 -m scripts.research_pipeline.cli \
  --state ny --all --run-statute-mandate-only --execute --limit 10

# Run after full pipeline
python3 -m scripts.research_pipeline.cli \
  --state ny --all --execute --statute-mandate
```

- Only runs for flagged analyses (burdensome/justified) with matched statute links
- Results in `statute_mandate_checks` table
- Small number of LLM calls (only flagged + linked pairs)

## Summarization CLI

Separate CLI for generating hierarchical summaries of regulatory documents.

```bash
cd backend

# Run all phases for a title (submit → poll → process → import to DB)
python3 -m scripts.summarization.cli --state NY --title 18 --run

# Dry run (preview what would be submitted)
python3 -m scripts.summarization.cli --state NY --title 18 --run --dry-run

# Manual phase control
python3 -m scripts.summarization.cli --state NY --title 18 --phase sections --submit
python3 -m scripts.summarization.cli --state NY --status --watch
python3 -m scripts.summarization.cli --state NY --phase sections --process
```

- 5 phases: sections → subchapters → chapters → parts → titles (must run in order)
- Uses Anthropic Batch API (Haiku, 50% savings)
- `--run` handles everything: submit, poll, process, import to DB
- Updates `regulatory_documents` with: `summary`, `section_type`, `keywords`, `applies_to`, `has_form`, `has_ibr`

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
- **Default is dry-run** — use `--execute` to actually run
- **Batch API can take 24h** in peak times (typically 10-40 min)
- **Don't kill running pipelines** without asking - they may have in-flight batches
