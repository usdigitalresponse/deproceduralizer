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

test.describe('Compliance Issues', () => {

  test('compliance issues filter by issue type', async ({ page }) => {
    await page.goto('/nj/review?mode=review&type=compliance');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for compliance issues to load
    await page.waitForLoadState('networkidle');

    // Apply filter - find the Type dropdown
    const typeFilter = page.locator('label:has-text("Type:") + button, label:has-text("Type:") ~ button').first();
    await typeFilter.click();

    // Select "Wet Signature" option
    await page.getByRole('option', { name: /wet signature/i }).click();

    // Wait for filter to apply
    await page.waitForLoadState('networkidle');

    // Verify filtered results show wet signature issues
    const filteredCards = page.locator('[data-testid="compliance-issue-card"]');
    const cardCount = await filteredCards.count();

    // If there are cards, they should be wet signature type
    if (cardCount > 0) {
      await expect(filteredCards.first()).toContainText(/wet signature/i);
    }
  });

  test('issue type filter options are properly formatted (no snake_case)', async ({ page }) => {
    await page.goto('/nj/review?mode=review&type=compliance');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Open issue type dropdown
    const typeFilter = page.locator('label:has-text("Type:") + button, label:has-text("Type:") ~ button').first();
    await typeFilter.click();

    // Get all option texts
    const options = page.getByRole('option');
    const optionCount = await options.count();

    // Verify we have options
    expect(optionCount).toBeGreaterThan(0);

    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent();
      // Verify no underscores in display text (snake_case would have underscores)
      expect(text).not.toMatch(/_/);
      // Verify Title Case (first letter of each word capitalized, except "All Types")
      if (text && text !== 'All Types') {
        expect(text).toMatch(/^[A-Z]/);
      }
    }
  });

  test('compliance review defaults to showing only LLM confirmed issues', async ({ page }) => {
    // Navigate without specifying requirementFound - should default to true
    await page.goto('/nj/review?mode=review&type=compliance');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check that LLM filter shows "LLM Confirmed" as the selected value
    const llmFilter = page.locator('label:has-text("LLM:") + button, label:has-text("LLM:") ~ button').first();
    await expect(llmFilter).toContainText(/LLM Confirmed/i);

    // Verify URL does NOT contain requirementFound=false
    expect(page.url()).not.toContain('requirementFound=false');
  });

  test('browse view compliance badge shows only confirmed issue count', async ({ page }) => {
    // Navigate to NJ browse and find a section with compliance issues
    await page.goto('/nj/browse');
    await expect(page.getByRole('heading', { name: /Browse New Jersey/i })).toBeVisible();

    // Wait for tree to load
    await page.waitForLoadState('networkidle');

    // Find a compliance badge and verify it exists
    const complianceBadge = page.getByText(/\d+ compliance/i).first();
    await expect(complianceBadge).toBeVisible();

    // The count should be a number followed by "compliance"
    const badgeText = await complianceBadge.textContent();
    expect(badgeText).toMatch(/^\d+ compliance$/);
  });

  test('section detail does not display LLM-rejected compliance issues', async ({ page }) => {
    // This test verifies that section pages do not show "LLM Rejected" badges.
    // We use a document known to have a rejected compliance issue.
    const TEST_DOC_ID = '150387';

    // Step 1: Verify there ARE rejected issues in the system by checking the review page
    await page.goto('/nj/review?mode=review&type=compliance&requirementFound=false');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for issues to load
    await page.waitForLoadState('networkidle');

    // Check for the issue count indicator (e.g., "4289 issues")
    const issueCountText = page.getByText(/\d+ issues?$/i);
    const hasRejectedIssues = await issueCountText.count() > 0;

    if (!hasRejectedIssues) {
      // Also check if cards loaded
      const cards = page.locator('[data-testid="compliance-issue-card"]');
      const cardCount = await cards.count();
      if (cardCount === 0) {
        throw new Error(
          `TEST DATA STALE: No compliance issues with requirement_found=false exist. ` +
          `Run: SELECT COUNT(*) FROM compliance_issues WHERE requirement_found = false`
        );
      }
    }

    // Step 2: Navigate to a section page that has rejected issues
    await page.goto(`/nj/regulations/${TEST_DOC_ID}`);
    // Wait for the main section heading to load
    await expect(page.getByRole('heading', { name: /N\.J\. Admin\. Code/ })).toBeVisible();

    // Step 3: Verify no "LLM Rejected" badge is visible on the section page
    // Section pages should only show confirmed issues (requirement_found=true)
    const rejectedBadge = page.locator('text=/LLM Rejected/i');
    await expect(rejectedBadge).not.toBeVisible();
  });

});
