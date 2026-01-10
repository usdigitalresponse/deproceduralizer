import { test, expect } from '@playwright/test';

/**
 * Data Preconditions Check
 *
 * Run this first to validate that the test environment has the expected data.
 * If these tests fail, other tests will likely fail with confusing errors.
 *
 * Usage: pnpm test:e2e preconditions.spec.ts
 */
test.describe('Data Preconditions', () => {

  test('NY has regulatory documents', async ({ page }) => {
    await page.goto('/ny/browse');
    await expect(page.getByRole('heading', { name: /Browse New York/i })).toBeVisible();

    // Should show document count
    const docCount = page.getByText(/\d+,?\d* documents/);
    await expect(docCount).toBeVisible();

    // Verify at least some documents exist
    await expect(page.getByRole('button', { name: 'Expand' }).first()).toBeVisible();
  });

  test('NJ has regulatory documents', async ({ page }) => {
    await page.goto('/nj/browse');
    await expect(page.getByRole('heading', { name: /Browse New Jersey/i })).toBeVisible();

    // Should show document count
    const docCount = page.getByText(/\d+,?\d* documents/);
    await expect(docCount).toBeVisible();

    // Verify at least some documents exist
    await expect(page.getByRole('button', { name: 'Expand' }).first()).toBeVisible();
  });

  test('NY has definitions', async ({ page }) => {
    await page.goto('/ny/definitions');
    await expect(page.getByRole('heading', { name: /New York Definitions Glossary/i })).toBeVisible();

    // Should have definition cards
    const definitionTerms = page.locator('h3');
    await expect(definitionTerms.first()).toBeVisible();
  });

  test('NJ has unreviewed compliance issues', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for compliance cards to load
    const cards = page.getByTestId('compliance-issue-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();

    expect(
      count,
      `PRECONDITION FAILED: No unreviewed compliance issues in NJ.\n` +
      `This will cause downstream tests to fail.\n` +
      `Check: SELECT COUNT(*) FROM compliance_issues WHERE state='NJ' AND review_status='unreviewed'`
    ).toBeGreaterThan(0);
  });

  test('NY has unreviewed red flags', async ({ page }) => {
    await page.goto('/ny/review?type=flags&reviewStatus=unreviewed');
    await expect(page.getByRole('heading', { name: /Review New York/i })).toBeVisible();

    // Wait for red flag cards to load
    const cards = page.getByTestId('red-flag-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const count = await cards.count();

    expect(
      count,
      `PRECONDITION FAILED: No unreviewed red flags in NY.\n` +
      `This will cause downstream tests to fail.\n` +
      `Check: SELECT COUNT(*) FROM red_flags WHERE state='NY' AND review_status='unreviewed'`
    ).toBeGreaterThan(0);
  });

  test('NJ has LLM-rejected compliance issues (for section detail test)', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&requirementFound=false');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for cards to load - use a longer timeout for this specific data
    const cards = page.getByTestId('compliance-issue-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    const count = await cards.count();

    expect(
      count,
      `PRECONDITION FAILED: No LLM-rejected compliance issues in NJ.\n` +
      `This will cause the 'section detail does not display LLM-rejected issues' test to fail.\n` +
      `Check: SELECT COUNT(*) FROM compliance_issues WHERE requirement_found = false AND state = 'NJ'`
    ).toBeGreaterThan(0);
  });

  test('Dashboard shows statistics', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Regulatory Analysis Dashboard/i })).toBeVisible();

    // Verify formatted numbers exist (e.g., "123,456")
    await expect(page.locator('text=/\\d{1,3}(,\\d{3})+/').first()).toBeVisible();

    // Both states should be selectable
    await expect(page.getByRole('heading', { name: 'New York State' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Jersey State' })).toBeVisible();
  });

});
