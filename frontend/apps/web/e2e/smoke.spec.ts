import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {

  test('browse page loads with NY titles', async ({ page }) => {
    await page.goto('/ny/browse');

    // Wait for data to load (not just page render)
    await expect(page.getByRole('heading', { name: /Browse New York/i })).toBeVisible();

    // Should have multiple title rows with expand buttons
    const expandButtons = page.getByRole('button', { name: 'Expand' });
    await expect(expandButtons.first()).toBeVisible();

    // Should show document count
    await expect(page.getByText(/\d+,?\d* documents/)).toBeVisible();
  });

  test('title expansion shows children', async ({ page }) => {
    await page.goto('/ny/browse');

    // Wait for titles to load
    const firstExpand = page.getByRole('button', { name: 'Expand' }).first();
    await expect(firstExpand).toBeVisible();

    // Click to expand
    await firstExpand.click();

    // Should show nested items after expansion
    // Wait for at least one child to appear (the row we clicked plus children)
    await expect(page.getByRole('treeitem').nth(1)).toBeVisible();
  });

  test('review mode shows red flags', async ({ page }) => {
    await page.goto('/ny/review');

    // Wait for red flags tab to be active and show count
    await expect(page.getByRole('button', { name: /Red Flags/i })).toBeVisible();

    // Should show flag cards with severity
    await expect(page.getByText(/Severity:/i).first()).toBeVisible();
  });

  test('state switching works', async ({ page }) => {
    await page.goto('/ny/browse');

    // Click switch state button
    await page.getByRole('button', { name: /Switch State/i }).click();

    // Should show state options
    await expect(page.getByText('New Jersey')).toBeVisible();
  });

});
