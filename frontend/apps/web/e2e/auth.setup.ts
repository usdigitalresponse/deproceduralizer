import { test as setup } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE = path.join(__dirname, '..', '.auth', 'user.json');

/**
 * Playwright setup that authenticates by setting localStorage.
 *
 * Runs once before all tests. Navigates to the base URL, sets the
 * isAuthenticated flag in localStorage, and saves the storage state
 * for all test projects to reuse.
 */
setup('authenticate', async ({ page }) => {
  // Navigate to the site (will show password form)
  await page.goto('/');

  // Set localStorage to bypass AuthGuard
  await page.evaluate(() => {
    localStorage.setItem('isAuthenticated', 'true');
  });

  // Save storage state (includes localStorage)
  await page.context().storageState({ path: STORAGE_STATE });
});
