import { test, expect } from '@playwright/test';

test.describe('Markers Feature Smoke Tests', () => {

  test('markers page loads with tabs', async ({ page }) => {
    await page.goto('/ny/markers');
    // Wait for the page-specific heading (not the nav h1)
    await expect(page.getByRole('heading', { name: /Labels/i })).toBeVisible({ timeout: 15000 });
    // Check tab buttons exist (custom TabButton components render as <button>)
    await expect(page.locator('button:has-text("Analyses")')).toBeVisible();
    await expect(page.locator('button:has-text("Fines")')).toBeVisible();
  });

  test('pipeline page shows marked filter toggle', async ({ page }) => {
    await page.goto('/ny/pipeline');
    await page.waitForSelector('table', { timeout: 15000 });
    const markedButton = page.locator('button:has-text("Marked")');
    await expect(markedButton).toBeVisible();
  });

  test('fines browse has marked filter', async ({ page }) => {
    await page.goto('/ny/fines?tab=browse');
    await page.waitForSelector('table', { timeout: 15000 });
    const markedButton = page.locator('button:has-text("Marked")');
    await expect(markedButton).toBeVisible();
  });

  test('pipeline row click opens detail drawer', async ({ page }) => {
    await page.goto('/ny/pipeline');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    // Drawer should open
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  });

  test('fines drawer opens on row click', async ({ page }) => {
    await page.goto('/ny/fines?tab=browse');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    // Wait for hydration to complete before clicking
    await page.waitForLoadState('networkidle');
    // Click on the row's agency cell (no ClickableTag or stopPropagation)
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.locator('td').nth(5).click(); // agency column
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
  });

  test('fines table has select-all checkbox', async ({ page }) => {
    await page.goto('/ny/fines?tab=browse');
    await page.waitForSelector('table', { timeout: 15000 });
    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await expect(headerCheckbox).toBeVisible();
  });

  test('pipeline table has select-all checkbox', async ({ page }) => {
    await page.goto('/ny/pipeline');
    await page.waitForSelector('table', { timeout: 15000 });
    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await expect(headerCheckbox).toBeVisible();
  });

  test('guidance browse has marked filter', async ({ page }) => {
    await page.goto('/ny/guidance');
    await page.waitForSelector('table', { timeout: 15000 });
    const markedButton = page.locator('button:has-text("Marked")');
    await expect(markedButton).toBeVisible();
  });

  test('bookmarks URL redirects to markers', async ({ page }) => {
    await page.goto('/ny/bookmarks');
    await page.waitForURL('**/ny/markers**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/ny\/markers/);
  });

});
