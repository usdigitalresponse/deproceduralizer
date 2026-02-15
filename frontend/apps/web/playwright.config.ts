import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'child_process';

// Vercel Protection Bypass header (for testing protected deployments)
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// ---------------------------------------------------------------------------
// Smart server detection
//
// Problems this solves:
//   1. Port collisions between multiple Claude agents / dev servers
//   2. .next directory shared between dev server, build, and test runs
//   3. Stale .next/dev/lock files from crashed processes
//   4. `pnpm build` corrupting a running `pnpm dev` (they share .next/)
//
// Strategy:
//   - If a dev server is already running on any common port → reuse it
//   - Otherwise start our own on a free port with an ISOLATED .next-test
//     directory so we never touch the user's .next/
// ---------------------------------------------------------------------------

const PREFERRED_PORTS = [3010, 3001, 3000];

function isOurAppResponding(port: number): boolean {
  try {
    // Check /ny/browse — a route unique to our app — to avoid reusing an
    // unrelated dev server (e.g. another Next.js project on the same port).
    // curl -sf fails on non-2xx, so a 404 from the wrong app won't match.
    execSync(
      `curl -sf -o /dev/null --max-time 2 http://localhost:${port}/ny/browse`,
      { stdio: 'pipe' },
    );
    return true;
  } catch {
    return false;
  }
}

function isPortInUse(port: number): boolean {
  try {
    execSync(`lsof -i :${port} -t`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function findFreePort(start: number): number {
  const candidates = [start, start + 1, start + 2, start + 10, start + 100];
  for (const port of candidates) {
    if (!isPortInUse(port)) return port;
  }
  return start;
}

/**
 * Detect an existing dev/start server we can reuse, or pick a free port.
 * Returns { baseURL, needsServer } — if needsServer is false, Playwright
 * skips launching its own webServer entirely.
 */
function resolveServer(): { baseURL: string; port: number; needsServer: boolean } {
  // 1. Explicit override takes priority
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return {
      baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL,
      port: 0,
      needsServer: false,
    };
  }

  // 2. Check if any preferred port is running OUR app (not just any HTTP server)
  for (const port of PREFERRED_PORTS) {
    if (isOurAppResponding(port)) {
      return {
        baseURL: `http://localhost:${port}`,
        port,
        needsServer: false,
      };
    }
  }

  // 3. No existing server — find a free port and start our own
  const port = findFreePort(PREFERRED_PORTS[0]);
  return {
    baseURL: `http://localhost:${port}`,
    port,
    needsServer: true,
  };
}

const { baseURL, port, needsServer } = resolveServer();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  timeout: 30_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(vercelBypassSecret && {
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': vercelBypassSecret,
      },
    }),
  },

  // Only launch a server if we couldn't find an existing one.
  // Uses .next-test as distDir so we never corrupt a running dev server.
  webServer: needsServer
    ? {
        command: [
          'rm -f .next-test/dev/lock',
          'pnpm prebuild',
          `NEXT_DIST_DIR=.next-test pnpm dev --port ${port}`,
        ].join(' && '),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { NEXT_DIST_DIR: '.next-test' },
      }
    : undefined,

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
