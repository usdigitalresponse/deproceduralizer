## Repository Purpose

This is `deproceduralizer-backup`, a mirror of the active `deproceduralizer` codebase **plus** periodic database snapshots under `data/db_backup/<UTC-timestamp>/`. Most of the guidance below is inherited from upstream and applies when reading or reasoning about the code; for backup-specific operations (taking snapshots, restoring), see `data/db_backup/README.md` and the "Restoring from a Snapshot" section of `DATABASE_SETUP.md`. The export script lives at `scripts/export_db_to_flatfiles.py`.

---

- whenever adding new components or frontend features, be sure to look at apps/web/STYLE_GUIDE.md and update the apps/web/STYLE_GUIDE.md as necessary to ensure the new components are consistent with it. Also, try to keep components as atomic as possible, keeping DRY principles as much as possible
- before pushing, verify documentation is current: if changes touched pipeline scripts, check docs/OPERATIONS.md; if they touched schema, check .claude/skills/database/schema.md; if they touched pipeline internals, check the corresponding skill file
- Before pushing, always run the smoke tests: `cd frontend/apps/web && pnpm test:e2e` unless you've run it recently. When starting a big feature, always add running smoke tests to the todos.
- when modifying the database schema, add a migration to frontend/packages/database/migrations/ and update .claude/skills/database/schema.md
- I am using vercel for deployment of the frontend by either pushing a branch and promoting, or pushing from main. Do NOT run `vercel --prod` directly - always deploy via git push
- whenever you are planning to create or modify a prompt, add a todo or integrate the prompt into the appropriate file in ./prompts/
- when implementing batch processing, always implement caching to avoid redundant operations (especially before committing)
- when creating scripts that do batch/multi-document/multi-record processing, always display progress (e.g., "Processed 1000/5000 records, ETA: 2m30s") so the user knows it's working and can estimate completion time
- avoid typecasts (`as Type`) and casting to `unknown` unless truly necessary - prefer proper type guards, generics, or fixing the underlying type issue
- when setting max_tokens for LLM API calls, look up the model's maximum output token limit and use that value (e.g., Claude 4.5 models support 64000 output tokens, Claude 3.5 Sonnet supports 8192)
- when creating database-touching modules (actions, query layers), add `import 'server-only'` at the top to prevent accidental client bundling. Page files should not import the database directly; use server actions instead.
- when creating PR test plans, always include live example URLs (query the database to find real records) so each manual test item has a clickable link to verify
- when running git commands from a different directory, always `cd` first then run the git command as a separate statement (e.g., `cd /path && git status`), rather than using `git -C /path`. This avoids triggering extra permission prompts.
- before committing, check `git worktree list` - do not commit changes that belong to other worktrees/feature branches
- before starting a local dev server or running smoke tests, check what's already running with `lsof -i :3000,3010,3011,3012`. If a port is in use, pick the next available one. Also check for Next.js `.next` lock files — if another process holds the lock, use a git worktree to avoid conflicts. Multiple Claude agents may be running in the same folder simultaneously.
- when working in a git worktree, the frontend `.env` symlink (`frontend/apps/web/.env -> ../../../.env`) won't resolve correctly because the root `.env` isn't in the worktree. Symlink it from the main repo: `ln -sf <path-to-main-checkout>/.env frontend/apps/web/.env` (and same for `.env.local` if it exists). Also symlink `backend/.env` if running Python scripts.

## Project Metrics

Canonical counts for use across all documentation. When adding/removing issue types, pipeline steps, or categories, update this table first, then `grep -rn` docs for the old count.

| Metric | Value | Source of Truth |
|--------|-------|-----------------|
| Compliance issue types | 49 | `prompts/compliance_issues.yaml` |
| Pipeline steps | 13 | `docs/OPERATIONS.md` step table |
| JenAI/Pahlka categories | 18 | `prompts/jenai.yaml` |

## Frontend Architecture Guidelines (frontend/apps/web)

When working on the Next.js frontend, follow these patterns:

### Authentication
- Auth is automatically bypassed in development (`NODE_ENV === 'development'`) and Vercel preview (`NEXT_PUBLIC_VERCEL_ENV === 'preview'`) — no password form appears
- Production always requires the `SITE_PASSWORD` — bypass conditions are compile-time constants that cannot trigger in production builds
- To test the auth flow in Playwright, use `addInitScript(() => { window.__TEST_AUTH_FLOW__ = true })` to re-enable the password form
- The auth system is intentionally client-side (localStorage) — see `AuthGuard.tsx`

### Avoid Duplication Patterns
- Before creating a new component, check if similar components exist (queues, cards, filters, modals)
- If 3+ components share >50% logic, extract a shared hook or wrapper component
- Never define filter options, status mappings, or nav config in multiple places - centralize in `lib/constants/`

### URL State Management
- Always use `nuqs` with predefined parsers from `lib/url/parsers.ts` for query state
- Never use raw `useSearchParams()` + manual URLSearchParams manipulation
- Add new parsers to `parsers.ts` rather than defining inline parsers in components

### State & Constants
- Use `DEFAULT_JURISDICTION` from `types/state.ts` - never hardcode state values ('nj', 'ny')
- Use `VALID_JURISDICTIONS` when iterating over jurisdictions
- Centralize enums and option arrays in `lib/constants/`

### Code Hygiene
- Delete unused exports immediately - don't leave "might use later" code
- After refactoring, audit index.ts barrel exports for dead code
- Run unused import cleanup as part of any PR

## Backend Patterns

### Jurisdiction Model
- The `jurisdiction` column stores jurisdiction codes: `NY` (New York State), `NJ` (New Jersey), `NYC` (New York City)
- NYC is a sub-state jurisdiction — its regulations (RCNY) and statutes (Charter + Admin Code) use `jurisdiction = 'NYC'`
- **Backend**: Import from `lib.jurisdictions` — `JurisdictionCode`, `VALID_JURISDICTIONS`, `VALID_JURISDICTIONS_LOWER`, `jurisdiction_prefix()`, `title_column_for_jurisdiction()`, `jurisdiction_validator()`
- **Frontend**: Use `DEFAULT_JURISDICTION` from `types/state.ts` and `VALID_JURISDICTIONS` from constants
- Never hardcode jurisdiction lists (`choices=['NJ','NY']`) or prefix mappings (`'njac' if state == 'nj' else 'nycrr'`) — use the shared helpers
- For argparse `choices`, use `VALID_JURISDICTIONS` or `VALID_JURISDICTIONS_LOWER`; for custom validation (e.g., `--state dangerously-run-all`), use `jurisdiction_validator(allow_run_all=True)`
- When adding a new jurisdiction, see the checklist in `.claude/skills/database/schema.md` (Jurisdiction Model section)

### LLM Prompts
- All prompts are centralized in the `/prompts/` directory:
  - `prompts/core.yaml` - Core analysis prompts (definitions)
  - `prompts/compliance_issues.yaml` - All 49 compliance issue types with patterns and prompts (includes fines_fees_penalties dedicated-table config)
- Prompts have `system` (static, cached) and `template` (dynamic) sections
- When adding/modifying prompts, update the appropriate file in `/prompts/`
- **Important:** When modifying any prompt, update its `updated_at` field to today's date (YYYY-MM-DD format)

### Compliance Issues
- Issue patterns defined in `prompts/compliance_issues.yaml` (regex patterns + LLM prompts).
- **Step 1**: `python backend/scripts/scan_compliance_issues.py --state nj` — regex scan, saves matches to DB (no LLM).
- **Step 2**: `python3 -m scripts.research_pipeline.cli` — 3-tier LLM analysis (Tier 1 filtering, Tier 2 classification, Tier 3 web search verification).
- **IMPORTANT**: Always ask user permission before running the research pipeline (realtime or batch). These runs make many API calls and cost money.
- **IMPORTANT**: Always ask user permission before killing a running pipeline. Don't assume the user wants it stopped.
- TypeScript types auto-generated from YAML - run `python scripts/generate_prompt_types.py`.
- See `.claude/skills/database/schema.md` for full schema documentation
- See `.claude/skills/regulatory-analysis/bad-regulation-patterns.md` for taxonomy of problematic regulatory patterns with real-world examples

### Summarization
- Hierarchical summarization of regulatory documents: `cd backend && python3 -m scripts.summarization.cli`
- 5 phases: sections → subchapters → chapters → parts → titles (must run in order)
- Uses Anthropic Batch API (Haiku, 50% savings)
- `--run-all-phases` handles full lifecycle: submit → poll → process → import to DB
- Updates `regulatory_documents` with: `summary`, `section_type`, `keywords`, `applies_to`, `has_form`, `has_ibr`

### Statute Mandate Checks (NY only)
- Post-pipeline step that checks whether cited statutes actually mandate flagged compliance issues
- Run via research pipeline CLI: `--run-statute-mandate-only` (standalone) or `--statute-mandate` (after full pipeline)
- Results stored in `statute_mandate_checks` table
- Only runs for flagged analyses (burdensome/justified) with matched statute links

### JenAI Pipeline
- Single-pass LLM pipeline for 18-category framework analysis: `cd backend && python3 -m scripts.jenai_pipeline.cli`
- Single enriched pass with full context upfront: ancestor summaries, sibling summaries, cross-ref summaries, definitions.
- Results in `jenai_analyses` + `jenai_issues` tables
- **IMPORTANT**: Always ask user permission before running (costs money)
- Default is dry-run — must pass `--execute` to actually run
- Prompts in `prompts/jenai.yaml`

### Fines Pipeline
- Scans regulations and guidance for fines, fees, penalties, surcharges, forfeitures: `python backend/scripts/fines_scanner.py --state ny`
- Regex search followed by LLM structured extraction, saves to `fines_fees_penalties` table
- Extracts: penalty type, amount (min/max), who pays, responsible agency, violation description
- Prompt config in `prompts/compliance_issues.yaml` (key: `fines_fees_penalties`) — uses dedicated table, not `compliance_issues`
- Supports `--include-guidance` for guidance docs, `--batch` for Batch API, `--dry-run` for regex-only
- Uses Haiku model; cost ~$1-3 per full state scan
- **IMPORTANT**: Always ask user permission before running (costs money)

### Pipeline Scripts
- Use `scripts.research_pipeline.cli` for the 3-tier compliance research.
- Use `scripts.jenai_pipeline.cli` for the single-pass JenAI analysis.
- Use `scripts.summarization.cli` for hierarchical document summarization.
- Use `backend/scripts/fines_scanner.py` for fines, fees & penalties extraction.
- When adding/removing backend scripts, update `docs/OPERATIONS.md`.
- Scrapers handle migration automatically via `lib.migration.migrate_regulations_to_db()`.

## Documentation Guidelines

### Key Documentation Files
| File | Purpose | Update When |
|------|---------|-------------|
| `docs/OPERATIONS.md` | Operational runbook | Adding/removing scripts, changing pipeline steps |
| `README.md` | Project overview, architecture | Architecture changes, new major features |
| `DATABASE_SETUP.md` | DB setup and common queries | Schema changes, new query patterns |
| `.claude/skills/database/schema.md` | Full schema reference | Any schema/migration changes |
| `.claude/skills/regulatory-analysis/` | Bad regulation patterns & examples | Adding new anti-pattern categories |
| `.claude/skills/pipeline/SKILL.md` | Pipeline overview and step routing | Adding/removing pipeline steps |
| `.claude/skills/research-pipeline/SKILL.md` | Pipeline internals (tiers, state machine, triggers) | Changing tier logic, triggers, state machine, cost model |
| `.claude/skills/jenai-pipeline/SKILL.md` | JenAI pipeline architecture and categories | Changing tier logic, categories, context strategy |
| `.claude/skills/fines-pipeline/SKILL.md` | Fines extraction architecture and prompt structure | Adding scrapers, changing fines extraction logic |
| `.claude/skills/cross-references/` | Extraction patterns and troubleshooting | Changing regex patterns, resolution logic |
| `.claude/skills/pipeline-caching/SKILL.md` | 3-layer prompt caching architecture | Editing context formatting, sibling/cross-ref queries, batch preparation |
| `.claude/skills/web-scraping/SKILL.md` | nys-documents scraping pipeline and downloaders | Adding scrapers, changing download logic, download failures |

### Source of Truth Hierarchy
- `docs/OPERATIONS.md` — pipeline step ordering, commands, CLI flags, costs, timing
- `.claude/skills/*/SKILL.md` — detailed workflows, architecture internals, troubleshooting
- `.claude/skills/database/schema.md` — database table structure, columns, constraints
- `prompts/*.yaml` — prompt content, issue type definitions, regex patterns

### Keeping Documentation in Sync
- When modifying pipeline script CLI flags: update `docs/OPERATIONS.md` (required) and the corresponding skill if it documents those flags
- When adding/removing a pipeline step: update `docs/OPERATIONS.md` and `.claude/skills/pipeline/SKILL.md`
- When modifying pipeline internals (tier logic, patterns, state machine): update the corresponding skill file
- When modifying pipeline context formatting or sibling/cross-ref queries: check `.claude/skills/pipeline-caching/SKILL.md` for caching rules (Layer 2 must be identical per subchapter)
- When removing a script: remove from OPERATIONS.md, update/delete any skill that references it, grep `.md` files for stale references
- Skills document "why/how it works internally"; OPERATIONS.md documents "what commands to run"

### Status Headers for Future Docs
Documents describing unimplemented or partially implemented features must include a status header:
```markdown
> **Status: PROPOSED / FUTURE**
> This document describes a proposed approach that has NOT been implemented.
```
Or for partial implementation:
```markdown
> **Status: PARTIALLY IMPLEMENTED**
> - Phase 1-3: ✅ Complete
> - Phase 4: 📋 Planned
```

### Script Reference Accuracy
- Never reference scripts that don't exist in documentation
- When removing a script, grep for references and update all docs
- Backend scripts live in `backend/scripts/` - verify paths before documenting

