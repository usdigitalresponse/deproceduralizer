import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  // Re-enable the password form for auth tests (bypassed in dev/preview by default)
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TEST_AUTH_FLOW__ = true;
    });
  });

  test('unauthenticated user sees password form', async ({ page }) => {
    await page.goto('/');

    // Should show the password form, not the dashboard
    await expect(page.getByRole('heading', { name: /Authentication Required/i })).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();

    // Should NOT show dashboard content
    await expect(page.getByRole('heading', { name: /Regulatory Analysis Dashboard/i })).not.toBeVisible();
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/');

    // Enter wrong password
    await page.getByLabel(/Password/i).fill('WrongPassword');
    await page.getByRole('button', { name: /Continue/i }).click();

    // Should show error message
    await expect(page.getByText(/Incorrect password/i)).toBeVisible();
  });

  test('correct password grants access', async ({ page }) => {
    await page.goto('/');

    // Enter correct password
    await page.getByLabel(/Password/i).fill('***REMOVED***');
    await page.getByRole('button', { name: /Continue/i }).click();

    // Should redirect to dashboard
    await expect(page.getByRole('heading', { name: /Regulatory Analysis Dashboard/i })).toBeVisible({ timeout: 15000 });
  });

  test('authenticated session persists across navigation', async ({ page }) => {
    // Authenticate first
    await page.goto('/');
    await page.getByLabel(/Password/i).fill('***REMOVED***');
    await page.getByRole('button', { name: /Continue/i }).click();
    await expect(page.getByRole('heading', { name: /Regulatory Analysis Dashboard/i })).toBeVisible({ timeout: 15000 });

    // Navigate to another page
    await page.goto('/ny/browse');

    // Should still be authenticated (no password form)
    await expect(page.getByRole('heading', { name: /Browse New York/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Authentication Required/i })).not.toBeVisible();
  });

});
