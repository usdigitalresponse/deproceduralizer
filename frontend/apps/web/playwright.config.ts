import { defineConfig, devices } from '@playwright/test';

// Vercel Protection Bypass header (for testing protected deployments)
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Add bypass header for Vercel protected deployments
    ...(vercelBypassSecret && {
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': vercelBypassSecret,
      },
    }),
  },

  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL ? undefined : {
    command: 'pnpm prebuild && pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
