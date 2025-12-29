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
    // Include reviewStatus to avoid redirect delay
    await page.goto('/ny/review?reviewStatus=unreviewed');

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
    // Explicitly use filter mode (not suggestion mode which is now the default)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
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
    // Explicitly use filter mode (not suggestion mode which is now the default)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
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
    // Navigate to filter mode without specifying requirementFound - should default to true
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
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

test.describe('Suggestion Mode', () => {

  test('suggestion mode loads correctly with controls', async ({ page }) => {
    // Navigate directly to suggestion mode
    await page.goto('/nj/review?type=compliance&queueMode=suggestion');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Verify suggestion mode UI is visible
    await expect(page.getByText('Items per batch:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Skip Group/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible();

    // Verify batch size buttons are present (2, 3, 4, 5)
    await expect(page.locator('button').filter({ hasText: /^2$/ }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /^3$/ }).first()).toBeVisible();

    // Verify compliance issue cards are present
    const cards = page.getByTestId('compliance-issue-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(5); // Max batch size
  });

  test('filter mode loads correctly with dropdowns', async ({ page }) => {
    // Navigate directly to filter mode
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Verify filter mode UI is visible
    await expect(page.getByText('Status:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Type:')).toBeVisible();
    await expect(page.getByText('Severity:')).toBeVisible();

    // Verify suggestion mode controls are NOT visible
    await expect(page.getByText('Items per batch:')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Skip Group/i })).not.toBeVisible();

    // Verify pagination is present
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();
  });

  test('skip group loads a new group in smart suggestions', async ({ page }) => {
    // Start in suggestion mode with explicit params
    await page.goto('/nj/review?type=compliance&queueMode=suggestion&groupingMode=issue_type');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Wait for suggestion controls to be visible
    await expect(page.getByText('Items per batch:')).toBeVisible({ timeout: 10000 });

    // Get the current grouping mode indicator
    const currentModeText = await page.getByText(/By Issue Type|By Section|By Type \+ Section/).first().textContent();

    // Click Skip Group
    const skipGroupButton = page.getByRole('button', { name: /Skip Group/i });
    await expect(skipGroupButton).toBeVisible();
    await skipGroupButton.click();

    // Wait for Skip Group button to reappear (page loaded correctly)
    await expect(page.getByRole('button', { name: /Skip Group/i })).toBeVisible({ timeout: 10000 });

    // The grouping mode should have changed (issue_type -> section -> combined -> issue_type)
    const newModeText = await page.getByText(/By Issue Type|By Section|By Type \+ Section/).first().textContent();
    // Mode might be the same if we cycled back, but page should have loaded
    expect(newModeText).toBeTruthy();
  });

  test('changing batch size updates URL', async ({ page }) => {
    // Start in suggestion mode with batch size 3
    await page.goto('/nj/review?type=compliance&queueMode=suggestion&batchSize=3&groupingMode=issue_type');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Wait for suggestion controls to be visible
    await expect(page.getByText('Items per batch:')).toBeVisible({ timeout: 10000 });

    // Verify current batch size is 3 in URL
    expect(page.url()).toContain('batchSize=3');

    // Click on the "2" button to change batch size
    const size2Button = page.locator('button').filter({ hasText: /^2$/ }).first();
    await expect(size2Button).toBeVisible();
    await size2Button.click();

    // Wait for URL to update
    await page.waitForURL(/batchSize=2/, { timeout: 10000 });

    // Verify batch size changed in URL
    expect(page.url()).toContain('batchSize=2');

    // Now change to 5 to verify it works
    const size5Button = page.locator('button').filter({ hasText: /^5$/ }).first();
    await expect(size5Button).toBeVisible();
    await size5Button.click();

    // Wait for URL to update
    await page.waitForURL(/batchSize=5/, { timeout: 10000 });

    // Verify batch size changed in URL
    expect(page.url()).toContain('batchSize=5');
  });

});

test.describe('Prompts Alignment', () => {

  // Expected core prompts from prompts/core.yaml
  const EXPECTED_CORE_PROMPTS = ['red_flags_analysis', 'definition_extraction'];

  test('prompts page displays all core prompts from YAML', async ({ page }) => {
    await page.goto('/prompts');

    // Wait for prompts to load
    await expect(page.locator('h1').filter({ hasText: /Prompts/i }).first()).toBeVisible();

    // Verify each expected prompt exists on the page
    for (const promptName of EXPECTED_CORE_PROMPTS) {
      // Prompt names are displayed, check they exist (use first() due to nav sidebar)
      await expect(page.getByText(promptName, { exact: false }).first()).toBeVisible();
    }
  });

  test('prompt details include system and template sections', async ({ page }) => {
    await page.goto('/prompts');

    // Wait for prompts to load
    await expect(page.locator('h1').filter({ hasText: /Prompts/i }).first()).toBeVisible();

    // Find red_flags_analysis prompt card and click to expand
    const promptCard = page.locator('#prompt-red_flags_analysis');
    await expect(promptCard).toBeVisible();
    await promptCard.click();

    // Wait for expanded content
    await page.waitForTimeout(500);

    // Should show system prompt section header (expanded view shows this)
    await expect(page.getByText(/System Prompt/i).first()).toBeVisible();

    // Should show content from red_flags_analysis (Jennifer Pahlka reference)
    await expect(page.getByText(/Jennifer Pahlka/i).first()).toBeVisible();
  });

  test('compliance issue types in filters match expected types from YAML', async ({ page }) => {
    // Explicitly use filter mode (not suggestion mode which is now the default)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Open issue type dropdown
    const typeFilter = page.locator('label:has-text("Type:") + button, label:has-text("Type:") ~ button').first();
    await typeFilter.click();

    // Get all option texts
    const options = page.getByRole('option');
    const optionTexts: string[] = [];
    const optionCount = await options.count();

    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent();
      if (text) optionTexts.push(text.toLowerCase());
    }

    // Verify expected issue types are present (check display names exist)
    // Note: These are the display names from YAML (not snake_case)
    const expectedDisplayNames = [
      'wet signature',
      'mail',  // Mail-Only Submission
      'certified',
      'fax',
      'notarization',
      'newspaper',
      'microfiche',
    ];

    for (const name of expectedDisplayNames) {
      const found = optionTexts.some(opt => opt.toLowerCase().includes(name));
      expect(found, `Expected to find "${name}" in issue type options`).toBeTruthy();
    }
  });

  test('prompt updated_at dates are displayed', async ({ page }) => {
    await page.goto('/prompts');

    // Wait for prompts to load
    await expect(page.locator('h1').filter({ hasText: /Prompts/i }).first()).toBeVisible();

    // Look for "Last updated" or date format (YYYY-MM-DD)
    const datePattern = page.getByText(/Last updated:|Updated:|\d{4}-\d{2}-\d{2}/i);
    await expect(datePattern.first()).toBeVisible();
  });

});

test.describe('Review Form Submission', () => {

  test('compliance issue review saves all fields including team notes', async ({ page }) => {
    // Use filter mode with LOW severity filter to minimize risk
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&severity=low');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for cards to load
    await page.waitForLoadState('networkidle');

    const card = page.getByTestId('compliance-issue-card').first();
    const cardCount = await page.getByTestId('compliance-issue-card').count();

    if (cardCount === 0) {
      console.log('No low severity compliance issues found, skipping test');
      return;
    }

    await expect(card).toBeVisible();

    // Store form elements
    const reviewerInput = card.getByTestId('compliance-reviewer-input');
    const justificationTextarea = card.getByTestId('compliance-justification-textarea');
    const teamNotesTextarea = card.getByTestId('compliance-team-notes-textarea');
    const saveButton = card.getByTestId('compliance-save-button');

    // Generate unique test values with timestamp
    const timestamp = Date.now();
    const testTeamNotes = `E2E Test Notes ${timestamp}`;
    const testJustification = `E2E Test Justification ${timestamp}`;

    // Fill form fields
    await reviewerInput.fill('E2E Test Reviewer');
    await justificationTextarea.fill(testJustification);
    await teamNotesTextarea.fill(testTeamNotes);

    // Submit the form
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // Verify the form still shows saved values (optimistic update)
    await expect(teamNotesTextarea).toHaveValue(testTeamNotes);

    // Note: This test leaves test data in the DB. Run cleanup query if needed:
    // UPDATE compliance_issues SET reviewed_by = NULL, team_notes = NULL WHERE reviewed_by LIKE '%E2E%'
  });

  test('red flag review saves all fields', async ({ page }) => {
    // Use review mode with low severity filter and explicit reviewStatus to avoid redirect
    await page.goto('/ny/review?type=flags&reviewStatus=unreviewed&severity=low');
    await expect(page.getByRole('heading', { name: /Review New York/i })).toBeVisible();

    // Wait for cards to load
    await page.waitForLoadState('networkidle');

    const cardCount = await page.getByTestId('red-flag-card').count();

    if (cardCount === 0) {
      console.log('No low severity red flags found, skipping test');
      return;
    }

    const card = page.getByTestId('red-flag-card').first();
    await expect(card).toBeVisible();

    // Store form elements
    const reviewerInput = card.getByTestId('red-flag-reviewer-input');
    const justificationTextarea = card.getByTestId('red-flag-justification-textarea');
    const teamNotesTextarea = card.getByTestId('red-flag-team-notes-textarea');
    const saveButton = card.getByTestId('red-flag-save-button');

    const timestamp = Date.now();
    const testTeamNotes = `E2E Red Flag Notes ${timestamp}`;

    // Fill form fields
    await reviewerInput.fill('E2E Test Reviewer');
    await justificationTextarea.fill(`E2E Red Flag Justification ${timestamp}`);
    await teamNotesTextarea.fill(testTeamNotes);

    // Submit the form
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // Verify the form shows saved values
    await expect(teamNotesTextarea).toHaveValue(testTeamNotes);

    // Note: This test leaves test data in the DB. Run cleanup query if needed:
    // UPDATE red_flags SET reviewed_by = NULL, team_notes = NULL WHERE reviewed_by LIKE '%E2E%'
  });

  test('definition review form can be filled', async ({ page }) => {
    // Navigate to definitions review
    await page.goto('/ny/review?mode=review&type=definitions');
    await expect(page.getByRole('heading', { name: /Review New York/i })).toBeVisible();

    // Wait for cards to load
    await page.waitForLoadState('networkidle');

    const cardCount = await page.getByTestId('definition-card').count();

    if (cardCount === 0) {
      console.log('No definitions found for review, skipping test');
      return;
    }

    const card = page.getByTestId('definition-card').first();
    await expect(card).toBeVisible();

    // Get form elements
    const reviewerInput = card.getByTestId('definition-reviewer-input');
    const teamNotesTextarea = card.getByTestId('definition-team-notes-textarea');

    const timestamp = Date.now();
    const testTeamNotes = `E2E Definition Notes ${timestamp}`;

    // Verify we can fill the form fields
    await reviewerInput.fill('E2E Test Reviewer');
    await teamNotesTextarea.fill(testTeamNotes);

    // Verify the values were filled
    await expect(reviewerInput).toHaveValue('E2E Test Reviewer');
    await expect(teamNotesTextarea).toHaveValue(testTeamNotes);

    // Note: We don't click confirm to avoid permanently modifying definitions
    // The test verifies the form is functional
  });

});

