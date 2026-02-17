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
- before committing, check `git worktree list` - do not commit changes that belong to other worktrees/feature branches
- when starting local dev servers, use port 3010 instead of the default 3000 (e.g., `pnpm dev --port 3010`) to avoid conflicts with commonly used ports. Always check what's already running with `lsof -i :3000,3010` before starting a server, especially before running smoke tests. Multiple Claude agents may be running in the same folder simultaneously.

## Frontend Architecture Guidelines (frontend/apps/web)

When working on the Next.js frontend, follow these patterns:

### Avoid Duplication Patterns
- Before creating a new component, check if similar components exist (queues, cards, filters, modals)
- If 3+ components share >50% logic, extract a shared hook or wrapper component
- Never define filter options, status mappings, or nav config in multiple places - centralize in `lib/constants/`

### URL State Management
- Always use `nuqs` with predefined parsers from `lib/url/parsers.ts` for query state
- Never use raw `useSearchParams()` + manual URLSearchParams manipulation
- Add new parsers to `parsers.ts` rather than defining inline parsers in components

### State & Constants
- Use `DEFAULT_STATE` from `types/state.ts` - never hardcode state values ('nj', 'ny')
- Use `VALID_STATES` when iterating over states
- Centralize enums and option arrays in `lib/constants/`

### Code Hygiene
- Delete unused exports immediately - don't leave "might use later" code
- After refactoring, audit index.ts barrel exports for dead code
- Run unused import cleanup as part of any PR

## Backend Patterns

### Jurisdiction Model
- The `state` column represents a jurisdiction, not strictly a US state: `NY` (New York State), `NJ` (New Jersey), `NYC` (New York City)
- NYC is a sub-state jurisdiction — its regulations (RCNY) and statutes (Charter + Admin Code) use `state = 'NYC'`
- Use `StateCode` type and `VALID_STATES` array — never hardcode jurisdiction lists
- When adding a new jurisdiction, see the checklist in `.claude/skills/database/schema.md` (Jurisdiction Model section)

### LLM Prompts
- All prompts are centralized in the `/prompts/` directory:
  - `prompts/core.yaml` - Core analysis prompts (red_flags, definitions)
  - `prompts/compliance_issues.yaml` - All 41 compliance issue types with patterns and prompts
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
- Two-tier LLM pipeline for 14-category Pahlka framework analysis: `cd backend && python3 -m scripts.jenai_pipeline.cli`
- Tier 1: catalog context → classify sections. Tier 2: full context → confirm/revise/dismiss findings.
- Results in `jenai_analyses` + `jenai_issues` tables
- **IMPORTANT**: Always ask user permission before running (costs money)
- Default is dry-run — must pass `--execute` to actually run
- Prompts in `prompts/jenai.yaml`

### Pipeline Scripts
- Use `scripts.research_pipeline.cli` for the 3-tier compliance research.
- Use `scripts.jenai_pipeline.cli` for the two-tier JenAI analysis.
- Use `scripts.summarization.cli` for hierarchical document summarization.
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
| `.claude/skills/cross-references/` | Extraction patterns and troubleshooting | Changing regex patterns, resolution logic |

### Source of Truth Hierarchy
- `docs/OPERATIONS.md` — pipeline step ordering, commands, CLI flags, costs, timing
- `.claude/skills/*/SKILL.md` — detailed workflows, architecture internals, troubleshooting
- `.claude/skills/database/schema.md` — database table structure, columns, constraints
- `prompts/*.yaml` — prompt content, issue type definitions, regex patterns

### Keeping Documentation in Sync
- When modifying pipeline script CLI flags: update `docs/OPERATIONS.md` (required) and the corresponding skill if it documents those flags
- When adding/removing a pipeline step: update `docs/OPERATIONS.md` and `.claude/skills/pipeline/SKILL.md`
- When modifying pipeline internals (tier logic, patterns, state machine): update the corresponding skill file
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

