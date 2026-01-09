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
| Debug specific issue | `--all-issues --sequential` |
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
| `--sequential` | false | Process issues one at a time (with `--all-issues`) |

## Tier Guide

| Tier | Purpose | Cost/Doc | When to Use |
|------|---------|----------|-------------|
| 1 | Match filtering | ~$0.002 | Quick triage, filter false positives |
| 2 | Classification + severity | ~$0.006 | Standard analysis |
| 3 | Web search validation | ~$0.020 | High-severity, federal citations |

**Tier 3 triggers** (when `--enable-web-search true`):
- High-risk issue types with severity >= 6 (`newspaper`, `notarization`, `wet_signature`, `witness`, `in_person_*`, `mandated_reports`)
- Document cites federal statute
- Claims no alternative with severity >= 7
- Burdensome classification with severity >= 8

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

### Sequential Debugging
```bash
python3 -m scripts.research_pipeline.cli \
  --state nj --all-issues \
  --max-docs-per-issue 10 --global-docs-limit no-limit \
  --max-tier 2 --enable-web-search false --sequential
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
