# E2E Tests

End-to-end tests using Playwright for the Deproceduralizer frontend.

## Quick Start

The suite needs a populated database. The quickest way is the Docker stack from the root README ("Local database with Docker"):

```bash
cd frontend
pnpm db:e2e:up && pnpm db:e2e:reset
# then in .env.local (or exported):
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/deproceduralizer_e2e
#   NEON_LOCAL_PROXY_URL=http://localhost:4444
```

```bash
# Run all tests (starts or reuses a local dev server)
pnpm test:e2e

# Run the way CI does: production build served by `next start`
pnpm build && E2E_SERVER=start pnpm test:e2e

# Run against any running deployment (no server is started)
PLAYWRIGHT_TEST_BASE_URL=https://your-url.example.com pnpm test:e2e

# Run only mutation tests (data-modifying)
pnpm test:e2e --grep @mutation
```

**Note:** in dev mode the config reuses any Node server it finds on ports 3010, 3001 or 3000. If another project's dev server is listening there, the tests will hit the wrong app; stop it or use `E2E_SERVER=start`.

## Test Categories

### Smoke Tests (Default)
Fast, read-only tests that verify critical user paths work.

**Note:** the smoke tests check for real records, like nonzero counts and search results, so they need a populated database. Against an empty one they fail. See [Getting Data](../../../../README.md#getting-data).

They cover:
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
| `DATABASE_URL`, `NEON_LOCAL_PROXY_URL` | Yes (server) | Where the app under test reads data. See the root `.env.example`. |
| `E2E_SERVER` | No | `dev` (default) starts or reuses `next dev`; `start` serves an existing `pnpm build` with `next start`. |
| `E2E_PORT` | No | Port for `start` mode (default `3010`). |
| `PLAYWRIGHT_TEST_BASE_URL` | No | Test an already-running server instead; no server is started. |
| `SITE_PASSWORD` | For auth tests | The server-side password. The "wrong password" test needs it set to anything. |
| `E2E_SITE_PASSWORD` | For auth tests | The same value, so the two login tests run. They skip when it's unset. |

CI sets both passwords to a throwaway value, so all four auth tests run there.

## Auth Bypass in Dev/Preview

Auth is automatically bypassed in development and Vercel preview environments — no password form appears. This is controlled by compile-time constants in `AuthGuard.tsx` (`NODE_ENV` and `NEXT_PUBLIC_VERCEL_ENV`).

**For auth tests**: The `auth.spec.ts` test suite uses `addInitScript` to set `window.__TEST_AUTH_FLOW__ = true`, which re-enables the password form so the auth flow can be tested.

**When writing new auth-related tests**, include this in your `beforeEach`:

```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__TEST_AUTH_FLOW__ = true;
  });
});
```

Non-auth tests (smoke tests, mutation tests) are unaffected — they benefit from the bypass since they don't need to authenticate.

## Data Invariants

The synthetic seed in `frontend/packages/database/seed/` is built to satisfy every assertion here, and `seed/fixtures.test.ts` pins the invariants so a drift between seed and specs fails in the unit tests, not in CI's e2e job. The headline requirements:

| State | Requirement |
|-------|-------------|
| NY | Browse tree with precomputed child counts; at least 1,000 documents overall so dashboard totals are comma-formatted |
| NY | Definitions whose `url` contains `new-york` (that is how the glossary scopes by jurisdiction) |
| NY | Compliance analyses classified burdensome on both regulations and guidance; barrier issues incl. part `418`; fines with `llm_confirmed=true`; guidance docs; at least 1,000 cross-references |
| NY | Leaf sections with citation `10 NYCRR …` and content containing "fire safety" (composer search) |
| NJ | Browse tree; unreviewed confirmed compliance issues incl. low severity (1–3) and `wet_signature` |
| NJ | LLM-rejected compliance issues (`requirement_found=false`), one on document id `150387` |
| NJ | Pipeline rows with tier-3 flags set to false and high-risk types with severity ≥ 7 |

If you add a test that needs new data, extend the seed and add the invariant to `fixtures.test.ts` in the same change.

## File Structure

```
e2e/
├── README.md               # This file
├── auth.setup.ts           # Writes the authenticated storage state
├── auth.spec.ts            # Password form tests
├── smoke.spec.ts           # Main smoke test suite
├── analytics-smoke.spec.ts
├── guidance-smoke.spec.ts
├── markers-smoke.spec.ts
└── helpers/
    ├── index.ts            # Barrel export
    └── ready.ts            # Page readiness helpers
```

CI runs this suite in `.github/workflows/ci.yml` (job `e2e`): Docker Postgres + Neon proxy, schema and seed, `pnpm build`, then `E2E_SERVER=start pnpm test:e2e`. The Playwright report is uploaded as an artifact on failure.

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
