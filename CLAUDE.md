- whenever adding new components or frontend features, be sure to look at apps/web/STYLE_GUIDE.md and update the apps/web/STYLE_GUIDE.md as necessary to ensure the new components are consistent with it. Also, try to keep components as atomic as possible, keeping DRY principles as much as possible
- before pushing, please always update the documentation about the latest state of the project
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

### Pipeline Scripts
- Use `scripts.research_pipeline.cli` for the 3-tier compliance research.
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

