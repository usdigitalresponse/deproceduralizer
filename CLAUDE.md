- whenever adding new components or frontend features, be sure to look at @apps/web/STYLE_GUIDE.md and update the @apps/web/STYLE_GUIDE.md as necessary to ensure the new components are consistent with it. Also, try to keep components as atomic as possible, keeping DRY principles as much as possible
- before pushing, please always update the documentation about the latest state of the project
- Before pushing, always run the smoke tests: `cd frontend/apps/web && pnpm test:e2e` unless you've run it recently. When starting a big feature, always add running smoke tests to the todos.
- when modifying schema.sql, always update .claude/skills/database/ (especially schema.md) to reflect the schema changes
- I am using vercel for deployment of the frontend by either pushing a branch and promoting, or pushing from main
- whenever you are planning to create or modify a prompt, add a todo or integrate the prompt into @prompts.yaml
- when implementing batch processing, always implement caching to avoid redundant operations (especially before committing)
- when creating scripts that do batch/multi-document/multi-record processing, always display progress (e.g., "Processed 1000/5000 records, ETA: 2m30s") so the user knows it's working and can estimate completion time
- avoid typecasts (`as Type`) and casting to `unknown` unless truly necessary - prefer proper type guards, generics, or fixing the underlying type issue
- when setting max_tokens for LLM API calls, look up the model's maximum output token limit and use that value (e.g., Claude 4.5 models support 64000 output tokens, Claude 3.5 Sonnet supports 8192)
- when creating database-touching modules (actions, query layers), add `import 'server-only'` at the top to prevent accidental client bundling. Page files should not import the database directly; use server actions instead.
- before committing, check `git worktree list` - do not commit changes that belong to other worktrees/feature branches

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
- All LLM prompts are centralized in `prompts.yaml` at the project root
- Prompts have `system` (static, cached) and `template` (dynamic) sections
- When adding/modifying prompts, update prompts.yaml rather than inline strings

### Compliance Issues
- Issue patterns defined in `backend/scripts/compliance_issues/compliance_issues.yaml`
- Uses regex-based candidate detection followed by LLM verification
- See `.claude/skills/database/schema.md` for full schema documentation

