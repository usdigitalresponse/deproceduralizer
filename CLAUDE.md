- whenever adding new components or frontend features, be sure to look at @apps/web/STYLE_GUIDE.md and update the @apps/web/STYLE_GUIDE.md as necessary to ensure the new components are consistent with it. Also, try to keep components as atomic as possible, keeping DRY principles as much as possible
- before pushing, please always update the documentation about the latest state of the project
- Before pushing, always run the smoke tests: `cd frontend/apps/web && pnpm test:e2e` unless you've run it recently. When starting a big feature, always add running smoke tests to the todos.
- when modifying schema.sql, always update .claude/skills/database/ (especially schema.md) to reflect the schema changes
- I am using vercel for deployment of the frontend by either pushing a branch and promoting, or pushing from main
- whenever you are planning to create or modify a prompt, add a todo or integrate the prompt into @prompts.yaml
- when implementing batch processing, always implement caching to avoid redundant operations (especially before committing)

