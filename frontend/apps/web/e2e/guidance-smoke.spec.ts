import { test, expect } from '@playwright/test';

test.describe('Guidance Documents', () => {
  test('guidance list page loads with overview stats', async ({ page }) => {
    await page.goto('/ny/guidance');

    // Check page title with a specific heading selector
    await expect(
      page.getByRole('heading', { level: 1, name: /Guidance Documents/i })
    ).toBeVisible();

    // Check Overview tab is active by default (should show stats)
    // Look for stat-like content in a stats card or summary section
    await expect(
      page.locator('[data-testid="overview-stats"], .stats, [class*="stat"]').first()
    ).toContainText('Total');

    // Screenshot
    await page.screenshot({ path: '/tmp/guidance-overview.png', fullPage: true });
  });

  test('guidance browse tab shows table with documents', async ({ page }) => {
    await page.goto('/ny/guidance?tab=browse');

    // Wait for table content to appear instead of arbitrary timeout
    await page.waitForSelector('table tbody tr, [role="row"]', { timeout: 10000 });

    // Check for table rows or document content
    const tableRows = page.locator('table tbody tr, [role="row"]');
    const rowCount = await tableRows.count();
    console.log(`Found ${rowCount} table rows`);

    // Screenshot
    await page.screenshot({ path: '/tmp/guidance-browse.png', fullPage: true });

    // Click first document link if available
    const docLink = page.locator('a[href*="/ny/guidance/"]').first();
    if (await docLink.isVisible()) {
      const href = await docLink.getAttribute('href');
      console.log('First doc link:', href);
    }
  });

  test('guidance detail page loads with document data', async ({ page }) => {
    // Go to browse tab and find a document
    await page.goto('/ny/guidance?tab=browse');

    // Wait for table content to load
    await page.waitForSelector('table tbody tr, [role="row"]', { timeout: 10000 });

    const docLink = page.locator('a[href*="/ny/guidance/"]').first();

    // Fail properly if no documents found instead of silently skipping
    await expect(docLink).toBeVisible({ timeout: 5000 });

    await docLink.click();

    // Wait for the detail page to finish loading
    await page.waitForLoadState('networkidle');

    // Check detail page loaded
    const h1 = await page.locator('h1').textContent().catch(() => '');
    console.log('Detail page H1:', h1?.substring(0, 100));

    // Check for back link
    await expect(page.locator('a[href="/ny/guidance"]')).toBeVisible();

    // Screenshot
    await page.screenshot({ path: '/tmp/guidance-detail.png', fullPage: true });
  });
});
