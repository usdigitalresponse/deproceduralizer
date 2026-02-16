---
name: pipeline
description: Run the regulatory analysis pipeline (scraping, definitions, summarization, compliance scanning, research pipeline, IBR, red flags). Use when processing a new state, running any pipeline step, or checking what to run next.
---

# Pipeline Operations

**Before running any pipeline step, read the full operational runbook:**

Use the Read tool to read `docs/OPERATIONS.md` — it contains the complete 11-step pipeline with all commands, flags, costs, timing, and dependencies.

## Pipeline Steps (Quick Reference)

| Step | Operation | Key Command | Cost |
|------|-----------|-------------|------|
| 1 | Scrape regulations | `python backend/scripts/ny_regulations_scraper.py` | Free |
| 1b | Exclude non-regulatory | `python backend/scripts/batch_exclude_ny_sections.py` | Free |
| 2 | Detect regulatory status | `python backend/scripts/detect_regulatory_status.py --state NY` | Free |
| 3 | Extract definitions | `python backend/scripts/batch_definitions.py submit --state NY` | ~$10-20 |
| 4 | Link definitions | `python backend/scripts/link_definitions.py run --state NY` | Free |
| 5 | Cross-references | `cd backend && python3 -m scripts.cross_references.run_extraction --state NY --output db` | Free |
| 6 | Summarize | `cd backend && python3 -m scripts.summarization.cli --state NY --title 18 --run-all-phases` | ~$2-5/title |
| 7 | Compliance scan (regex) | `python backend/scripts/scan_compliance_issues.py --state ny` | Free |
| 8 | Research pipeline (LLM) | `cd backend && python3 -m scripts.research_pipeline.cli --state ny --all-issues --execute` | ~$50-60/title |
| 9 | IBR scan | `python backend/scripts/ibr_scanner.py --state ny` | ~$5-10 |
| 10 | Red flags | `python backend/scripts/red_flags.py --state NY` | ~$50-100 |
| 11 | Refresh stats | `python backend/scripts/refresh_hierarchy_stats.py --state NY` | Free |

## Critical Dependencies

- Steps 1-4 are sequential prerequisites
- Step 5 (cross-references) can run anytime after Step 1
- Steps 6 and 7 can run in parallel
- **Step 8 depends on Steps 5 and 6** — uses summaries and cross-ref summaries as LLM context
- Steps 9-10 are independent, can run anytime after Step 1
- Step 11 runs last

## Related Skills

For detailed architecture/internals on specific steps, invoke the relevant skill:
- **research-pipeline** — Tier logic, state machine, escalation triggers, cost optimization (Step 8)
- **cross-references** — Extraction patterns, resolution logic, troubleshooting (Step 5)
- **database** — Schema reference, queries, maintenance procedures

## Important Reminders

- **Always ask user permission** before running LLM-based steps (3, 6, 8, 9, 10) — they cost money
- **Always ask user permission** before killing a running pipeline
- Default is dry-run for research pipeline — must pass `--execute` to actually run
- Use `--dry-run` on any step that supports it before committing to a full run
