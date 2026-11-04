---
name: codebase-stats
description: Use when the user asks about codebase size, lines of code, file counts, language breakdown, or project structure overview. Also use when onboarding to get a quick sense of the project.
---

# Codebase Stats

## Line Count Command

```bash
# Total LOC (all source files, excluding artifacts)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.sql" -o -name "*.yaml" -o -name "*.yml" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/.next-test/*" \
  -not -path "*/dist/*" \
  -not -path "*/.git/*" \
  -not -path "*/__pycache__/*" \
  -not -path "*/.venv/*" \
  -not -path "*/venv/*" \
  -not -path "*/coverage/*" \
  -not -path "*/data/outputs/*" \
  -not -path "*pnpm-lock*" \
  -not -path "*package-lock*" \
  -not -path "*.min.js" \
  -print0 | xargs -0 wc -l 2>/dev/null | tail -1
```

### By Language

Replace the file extensions in the find with a single language to get per-language counts:

| Language | Extensions |
|----------|-----------|
| TypeScript | `*.ts`, `*.tsx` |
| Python | `*.py` |
| YAML (prompts) | `*.yaml`, `*.yml` |
| SQL (migrations) | `*.sql` |
| CSS | `*.css` |

Example for one language:
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.next-test/*" \
  -not -path "*/dist/*" -not -path "*/.git/*" -not -path "*/coverage/*" \
  -print0 | xargs -0 wc -l 2>/dev/null | tail -1
```

### Largest Files

To find the biggest source files (useful for spotting generated/data files inflating counts):
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) \
  -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.next-test/*" \
  -not -path "*/dist/*" -not -path "*/.git/*" \
  -print0 | xargs -0 wc -l 2>/dev/null | sort -rn | head -20
```

## Exclusion Rationale

| Excluded Path | Why |
|---------------|-----|
| `node_modules/` | Third-party dependencies |
| `.next/`, `.next-test/` | Next.js build output (can be 800k+ lines) |
| `dist/`, `coverage/` | Build artifacts, test coverage reports |
| `data/outputs/` | Generated HTML reports (e.g., triage outputs) |
| `__pycache__/`, `.venv/` | Python bytecode and virtual environments |
| `*-lock*` | Package manager lockfiles |
| `*.min.js` | Minified vendor scripts |

## Project Structure

```
deproceduralizer/
├── frontend/                  # Next.js monorepo (TypeScript)
│   ├── apps/web/              # Main web application
│   │   ├── src/               # App router pages, components, actions
│   │   ├── STYLE_GUIDE.md     # Frontend component conventions
│   │   └── playwright/        # E2E tests
│   └── packages/database/     # Drizzle ORM schema + migrations
│       ├── schema/            # Table definitions, constants, types
│       └── migrations/        # SQL migration files (DDL authority)
├── backend/                   # Python analysis pipeline
│   ├── scripts/               # Scrapers, scanners, pipeline steps
│   │   ├── compliance_issues/ # Regex scanner + config
│   │   ├── research_pipeline/ # 3-tier LLM analysis (CLI entry point)
│   │   ├── barrier_pipeline/    # Single-pass 18-category barrier analysis
│   │   └── summarization/     # Hierarchical doc summarization
│   └── lib/                   # Shared Python utilities
├── prompts/                   # LLM prompt definitions (YAML)
│   ├── core.yaml              # Definitions prompts
│   └── compliance_issues.yaml # 42 issue types with regex + prompts
├── docs/                      # Documentation
│   ├── OPERATIONS.md          # Pipeline runbook (12 steps)
│   └── plans/                 # Design documents
├── scripts/                   # Top-level utility scripts
└── .claude/                   # Claude Code configuration
    └── skills/                # Project skills (see below)
```

## Project Skills

| Skill | Purpose |
|-------|---------|
| `database` | Query Neon PostgreSQL, run `db-query.sh`, schema reference |
| `pipeline` | 11-step analysis pipeline operations and commands |
| `research-pipeline` | 3-tier LLM compliance analysis (tiers, triggers, costs) |
| `cross-references` | Internal citation extraction between regulatory docs |
| `regulatory-analysis` | Bad regulation pattern taxonomy with examples |
| `prompt-writing` | LLM prompt authoring best practices and caching |
| `cleanup` | Track and revert test data / temporary operations |
| `troubleshooting` | Common issues (Next.js cache, etc.) |
| `barrier-pipeline` | Single-pass 18-category barrier framework analysis |
| `web-scraping` | NY state agency document scraping and downloads |
| `codebase-stats` | This skill — LOC counts and project overview |

## Key Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project-wide instructions for AI agents |
| `docs/OPERATIONS.md` | Pipeline commands, flags, costs, timing |
| `.claude/skills/database/schema.md` | Full database schema reference |
| `frontend/apps/web/STYLE_GUIDE.md` | Frontend component conventions |
| `prompts/compliance_issues.yaml` | All 42 compliance issue definitions |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React, TypeScript, Tailwind CSS |
| Database | Neon PostgreSQL, Drizzle ORM |
| Backend pipeline | Python 3, Anthropic API (Claude), regex scanning |
| Deployment | Vercel (frontend), Neon (database) |
| Testing | Playwright (E2E), pnpm |
| URL state | nuqs (query string state management) |
