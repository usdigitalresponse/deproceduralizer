---
name: fines-pipeline
description: Scan regulations and guidance for fines, fees, and penalties. Use when running fines extraction, checking fines scanner status, or working with the fines_fees_penalties table.
---

# Fines, Fees & Penalties Pipeline

Regex-first scanner that finds monetary charges in regulations and guidance, then uses LLM structured extraction to populate the `fines_fees_penalties` table.

## Quick Reference

| Task | Command |
|------|---------|
| Dry run (regex only) | `python backend/scripts/fines_scanner.py --state ny --dry-run` |
| Full scan (regulations) | `python backend/scripts/fines_scanner.py --state ny` |
| Full scan + guidance | `python backend/scripts/fines_scanner.py --state ny --include-guidance` |
| Batch API mode | `python backend/scripts/fines_scanner.py --state ny --batch` |
| Process batch results | `python backend/scripts/fines_scanner.py --state ny --process-batch <batch_id>` |
| Poll batch status | `python backend/scripts/fines_scanner.py --state ny --poll` |
| Filter by title | `python backend/scripts/fines_scanner.py --state ny --title 18` |
| Filter by part | `python backend/scripts/fines_scanner.py --state ny --part 360` |
| Limit docs | `python backend/scripts/fines_scanner.py --state ny --limit 10` |

## CLI Flags

| Flag | Description |
|------|-------------|
| `--state` | Jurisdiction code (ny, nj, nyc) — required |
| `--batch` | Use Anthropic Batch API (50% savings, async) |
| `--process-batch ID` | Process completed batch results |
| `--poll` | Poll for pending batch status |
| `--dry-run` | Regex scan only, no LLM calls |
| `--include-guidance` | Also scan guidance documents |
| `--title N` | Filter to specific NYCRR title number |
| `--part P` | Filter to specific part |
| `--limit N` | Limit number of documents scanned |

## Architecture

```
Regulatory Documents + Guidance Documents
    |
    v
[Regex Pattern Matching]  (prompts/compliance_issues.yaml patterns)
    |
    v
[LLM Structured Extraction]  (Haiku model)
    |  System prompt: extraction instructions
    |  Template: {document_metadata} + {regulation_context} + {statute_context}
    |
    v
[fines_fees_penalties table]
```

Extends `BasePatternSearcher` from `scripts/shared/base_searcher.py`.

## Prompt Structure

Lives in `prompts/compliance_issues.yaml` under key `fines_fees_penalties`.

### Placeholders

| Placeholder | Source | Description |
|-------------|--------|-------------|
| `{document_metadata}` | Built from doc fields | Source type, agency, title, URL |
| `{regulation_context}` | Document content | Full text or windowed excerpt (15K char threshold) |
| `{statute_context}` | StatuteChecker | Cited statute text for cross-referencing |

### System prompt
Static extraction instructions: what to include/exclude, penalty type classification, agency attribution rules.

### Template
Dynamic per-document: metadata block, regulation text, statute context.

## Agency Attribution

For NYCRR regulations, the administering agency is derived from the title number using `lib.jurisdictions.get_title_agency_map()`. For guidance documents, the agency comes from the `guidance_documents` table.

The system prompt instructs the LLM to use the agency from document metadata when the specific agency cannot be determined from the text.

## Context Strategy

Current context per document:
- **Document metadata**: source type, agency, title, URL
- **Regulation text**: full content for small docs (<15K chars), windowed around regex matches for large docs
- **Statute context**: cited statute text via StatuteChecker

Gap: No ancestor summaries, sibling summaries, or definitions yet (issue #261).

## Database

Results stored in `fines_fees_penalties` table. See `.claude/skills/database/schema.md` (line ~697) for full schema.

Key columns: `document_id`, `penalty_type`, `amount`, `amount_min`, `amount_max`, `per_unit`, `who_pays`, `responsible_agency`, `violation_description`, `requirement_quote`, `llm_confirmed`, `source_type`.

## Key Files

| File | Purpose |
|------|---------|
| `backend/scripts/fines_scanner.py` | Main scanner script (FinesSearcher class) |
| `prompts/compliance_issues.yaml` | Prompt config (key: `fines_fees_penalties`) |
| `frontend/packages/database/src/repositories/fines.repository.ts` | Database repository |
| `frontend/apps/web/src/lib/actions/fines.ts` | Server actions |

## Cost

~$1-3 per full state scan using Haiku model.

## Important

- **Always ask user permission** before running — costs money
- Resume-safe: already-analyzed documents are skipped automatically
- Use `--dry-run` first to see regex match counts before committing to LLM calls
- Batch API mode (`--batch`) provides 50% cost savings but is asynchronous
