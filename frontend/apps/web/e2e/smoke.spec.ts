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

    // Wait for red flags tab to be visible and show count
    await expect(page.getByText(/Red Flags/i).first()).toBeVisible();

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

  test('definitions glossary shows terms', async ({ page }) => {
    await page.goto('/ny/definitions');

    // Wait for glossary heading (h1 includes state name)
    await expect(page.getByRole('heading', { name: /New York Definitions Glossary/i })).toBeVisible();

    // Should show total definitions count
    await expect(page.getByText(/Total Definitions/i)).toBeVisible();

    // Should have definition cards with terms (h3 headings)
    const definitionTerms = page.locator('h3');
    await expect(definitionTerms.first()).toBeVisible();

    // Should show at least some definitions (check for quality badges which appear on cards)
    await expect(page.getByText(/Quality/i).first()).toBeVisible();

    // Should have pagination showing page info
    await expect(page.getByText(/Page \d+ of \d+/i)).toBeVisible();
  });

  test('table view shows regulations', async ({ page }) => {
    await page.goto('/ny');

    // Wait for page heading
    await expect(page.getByRole('heading', { name: /New York/i })).toBeVisible();

    // Should have data table with rows
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('dashboard shows statistics', async ({ page }) => {
    await page.goto('/');

    // Should show dashboard heading
    await expect(page.getByRole('heading', { name: /Regulatory Analysis Dashboard/i })).toBeVisible();

    // Should show overview section with populated statistics
    await expect(page.getByRole('heading', { name: /Overview/i })).toBeVisible();

    // Verify key stats are populated with actual numbers (comma-formatted like 123,388)
    await expect(page.locator('text=/\\d{1,3}(,\\d{3})+/').first()).toBeVisible();

    // Should show all the stat labels in the overview section
    await expect(page.getByText('Total Regulations')).toBeVisible();
    await expect(page.getByText('Analyzed', { exact: true })).toBeVisible();
    await expect(page.getByText('With Flags', { exact: true })).toBeVisible();

    // Should show state selection with both states
    await expect(page.getByRole('heading', { name: /Select a State/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New York State' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Jersey State' })).toBeVisible();
  });

  test('browse search filters results', async ({ page }) => {
    await page.goto('/ny/browse');

    // Wait for browse page to load
    await expect(page.getByRole('heading', { name: /Browse New York/i })).toBeVisible();

    // Find and use the search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill('health');

    // Results should filter (wait for filtering to complete)
    await page.waitForTimeout(500);

    // Should still show results after filtering
    await expect(page.getByRole('button', { name: 'Expand' }).first()).toBeVisible();
  });

  test('glossary search filters definitions', async ({ page }) => {
    await page.goto('/ny/definitions');

    // Wait for glossary to load
    await expect(page.getByRole('heading', { name: /New York Definitions Glossary/i })).toBeVisible();

    // Find the search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill('person');

    // Wait for filtering
    await page.waitForTimeout(500);

    // Should show filtered results with definition cards
    const definitionTerms = page.locator('h3');
    await expect(definitionTerms.first()).toBeVisible();
  });

});
