# E2E Tests

End-to-end tests using Playwright for the Deproceduralizer frontend.

## Quick Start

```bash
# Run all tests (uses local dev server)
pnpm test:e2e

# Run against a deployed environment
PLAYWRIGHT_TEST_BASE_URL=https://your-url.vercel.app pnpm test:e2e

# Run only smoke tests (fast, read-only)
pnpm test:e2e --grep @smoke

# Run only mutation tests (data-modifying)
pnpm test:e2e --grep @mutation
```

## Test Categories

### Smoke Tests (Default)
Fast, read-only tests that verify critical user paths work:
- Browse page loads and expands
- Review mode shows data
- Definitions glossary loads
- Dashboard statistics appear
- Search/filter functionality works

### Mutation Tests (`@mutation`)
Tests that modify data in the database:
- Review form submission
- Status changes
- Queue replacement behavior

These tests include cleanup logic to restore data after running.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLAYWRIGHT_TEST_BASE_URL` | No | Base URL for tests (default: `http://localhost:3000`) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | For Vercel | Bypass Vercel deployment protection |

## Data Invariants

Tests assume the following data exists:

| State | Requirement |
|-------|-------------|
| NY | Has regulatory documents with browse tree |
| NY | Has definitions in glossary |
| NY | Has unreviewed red flags |
| NJ | Has regulatory documents with browse tree |
| NJ | Has unreviewed compliance issues |
| NJ | Has LLM-rejected compliance issues (`requirement_found=false`) |

## File Structure

```
e2e/
├── README.md              # This file
├── smoke.spec.ts          # Main smoke test suite
└── helpers/
    ├── index.ts           # Barrel export
    └── ready.ts           # Page readiness helpers
```

## Helpers

### Page Readiness Helpers (`helpers/ready.ts`)

Use these instead of `waitForTimeout()` or `waitForLoadState('networkidle')`:

```typescript
import { waitForBrowseReady, waitForReviewReady } from './helpers';

// Instead of: await page.waitForTimeout(500)
await waitForBrowseReady(page);
await waitForReviewReady(page);
```

Available helpers:
- `waitForBrowseReady(page)` - Browse page with expand buttons
- `waitForComplianceReviewReady(page)` - Review page with compliance cards
- `waitForRedFlagReviewReady(page)` - Review page with red flag cards
- `waitForDefinitionsReady(page)` - Definitions glossary
- `waitForDashboardReady(page)` - Dashboard with statistics
- `waitForSuggestionModeReady(page)` - Suggestion mode UI
- `waitForFilterModeReady(page)` - Filter mode UI
- `waitForPromptsReady(page)` - Prompts page
- `waitForSaveComplete(page)` - Form save operations

## Writing New Tests

1. **Use explicit waits** - Never use `waitForTimeout()`. Use helpers or `expect().toBeVisible()`.

2. **Use data-testid selectors** - Prefer `getByTestId()` over text-based selectors.

3. **Tag appropriately** - Add `@mutation` to tests that modify data.

4. **Clean up mutations** - If your test modifies data, restore it in the test or `afterEach`.

5. **Document data requirements** - If your test needs specific data, add a precondition check.

## Debugging

```bash
# Run with UI mode
pnpm test:e2e --ui

# Run with headed browser
pnpm test:e2e --headed

# Show trace on failure
pnpm test:e2e --trace on
```

## Troubleshooting

### Timeout Failures on Local Runs

If you see multiple timeout errors like `page.goto: Test timeout of 30000ms exceeded`, the dev server may be overwhelmed by too many parallel test workers.

**Solution**: Reduce the number of workers:

```bash
# Run with 2 workers (recommended for local development)
npx playwright test --workers=2

# Run with 1 worker (slowest but most reliable)
npx playwright test --workers=1
```

The default configuration uses all available CPU cores locally, which can cause the Next.js dev server to become unresponsive under load. CI environments already use `workers: 1` for stability.
