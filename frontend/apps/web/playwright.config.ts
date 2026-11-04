import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Server modes
//
//   E2E_SERVER=dev   (default) Start or reuse a `next dev` server. Handles port
//                    collisions between parallel agents and keeps its build in
//                    .next-test so it never corrupts a running dev server.
//   E2E_SERVER=start CI mode. Assumes `pnpm build` already ran and serves the
//                    production build with `next start` on E2E_PORT (3010).
//
//   PLAYWRIGHT_TEST_BASE_URL overrides both: no server is started.
// ---------------------------------------------------------------------------

const serverMode = process.env.E2E_SERVER === 'start' ? 'start' : 'dev';

const PREFERRED_PORTS = [3010, 3001, 3000];

function isOurAppResponding(port: number): boolean {
  try {
    // Fast check: see if a node process is listening on this port.
    // A full HTTP check (curl) is unreliable under load from parallel workers.
    const pids = execSync(`lsof -i :${port} -t`, { stdio: 'pipe' }).toString().trim();
    if (!pids) return false;
    const firstPid = pids.split('\n')[0];
    const comm = execSync(`ps -p ${firstPid} -o comm=`, { stdio: 'pipe' }).toString().trim();
    return comm.includes('node') || comm.includes('next');
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

  // 2. CI: serve the production build on a fixed port, no probing
  if (serverMode === 'start') {
    const port = Number(process.env.E2E_PORT ?? PREFERRED_PORTS[0]);
    return { baseURL: `http://localhost:${port}`, port, needsServer: true };
  }

  // 3. Check if any preferred port is running OUR app (not just any HTTP server)
  for (const port of PREFERRED_PORTS) {
    if (isOurAppResponding(port)) {
      return {
        baseURL: `http://localhost:${port}`,
        port,
        needsServer: false,
      };
    }
  }

  // 4. No existing server — find a free port and start our own
  const port = findFreePort(PREFERRED_PORTS[0]);
  return {
    baseURL: `http://localhost:${port}`,
    port,
    needsServer: true,
  };
}

const { baseURL, port, needsServer } = resolveServer();

const webServer = !needsServer
  ? undefined
  : serverMode === 'start'
    ? {
        command: `pnpm start --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        // Uses .next-test as distDir so we never corrupt a running dev server.
        command: [
          'rm -f .next-test/dev/lock',
          'pnpm prebuild',
          `NEXT_DIST_DIR=.next-test pnpm dev --port ${port}`,
        ].join(' && '),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { NEXT_DIST_DIR: '.next-test' },
      };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],
  timeout: 30_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer,

  projects: [
    // Auth setup: sets localStorage isAuthenticated before all tests
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Auth tests: run WITHOUT stored auth state to test the auth flow itself
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // Main tests: run WITH stored auth state (already authenticated)
    {
      name: 'chromium',
      testIgnore: /auth\.(setup|spec)\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/../.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
