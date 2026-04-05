import { test, expect } from '@playwright/test';

test.describe('Analytics Page Smoke Tests', () => {

  test('analytics overview loads with key elements', async ({ page }) => {
    await page.goto('/ny/analytics');

    // Wait for stat cards to render
    await expect(page.getByText('Classified Burdensome')).toBeVisible();
    await expect(page.getByText('Regulations Analyzed')).toBeVisible();
    await expect(page.getByText('Best available classification per issue')).toBeVisible();

    // The burdensome stat should show a number > 0
    const burdensome = page.getByText('Classified Burdensome').locator('xpath=./following-sibling::p[1]');
    await expect(burdensome).toBeVisible();
    const value = await burdensome.textContent();
    expect(parseInt(value?.replace(/,/g, '') ?? '0')).toBeGreaterThan(0);
  });

  test('source filter toggles update numbers', async ({ page }) => {
    await page.goto('/ny/analytics');
    await expect(page.getByText('Classified Burdensome')).toBeVisible();

    // Get burdensome value from stat card
    const getBurdensome = async () => {
      const el = page.getByText('Classified Burdensome').locator('xpath=./following-sibling::p[1]');
      const text = await el.textContent();
      return parseInt(text?.replace(/,/g, '') ?? '0');
    };
    const allNum = await getBurdensome();
    expect(allNum).toBeGreaterThan(0);

    // Click Regulations — navigate and wait for full page load
    await page.goto('/ny/analytics?source=regulations');
    await expect(page.getByText('Classified Burdensome')).toBeVisible();
    const regNum = await getBurdensome();

    // Click Guidance — navigate and wait for full page load
    await page.goto('/ny/analytics?source=guidance');
    await expect(page.getByText('Classified Burdensome')).toBeVisible();
    const guidNum = await getBurdensome();

    // Regulations should have fewer issues than All (guidance excluded)
    expect(regNum).toBeLessThanOrEqual(allNum);
    // Guidance should have fewer issues than All (regulations excluded)
    expect(guidNum).toBeLessThanOrEqual(allNum);
    // Both should be > 0 for NY
    expect(regNum).toBeGreaterThan(0);
    expect(guidNum).toBeGreaterThan(0);
    // Regulations + Guidance should equal All
    expect(regNum + guidNum).toBe(allNum);
  });

  test('issues tab shows breakdown table', async ({ page }) => {
    await page.goto('/ny/analytics?tab=issues');

    // Wait for breakdown table
    await expect(page.getByText('Issue Type Breakdown')).toBeVisible();
    await expect(page.locator('tfoot')).toBeVisible();

    // Total row should have numbers
    const totalCells = page.locator('tfoot td');
    const lastCell = totalCells.last();
    const totalText = await lastCell.textContent();
    expect(parseInt(totalText?.replace(/,/g, '') ?? '0')).toBeGreaterThan(0);
  });

  test('classification filter updates bar chart title', async ({ page }) => {
    await page.goto('/ny/analytics');

    // Default shows burdensome
    await expect(page.getByText('Top Issue Types (burdensome)')).toBeVisible();

    // Click Justified tab (in the Show: filter, not the analytics tabs)
    await page.getByText('Show:').locator('..').getByRole('tab', { name: 'Justified' }).click();
    await expect(page.getByText('Top Issue Types (justified)')).toBeVisible();
  });

  test('clicking issue type row navigates to pipeline', async ({ page }) => {
    await page.goto('/ny/analytics?tab=issues');
    await expect(page.getByText('Issue Type Breakdown')).toBeVisible();

    // Click first data row
    await page.locator('tbody tr').first().click();

    // Should navigate to pipeline with params
    await expect(page).toHaveURL(/\/ny\/pipeline/);
    await expect(page).toHaveURL(/issueType=/);
  });
});
