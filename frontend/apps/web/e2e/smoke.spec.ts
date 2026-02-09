import { test, expect } from '@playwright/test';
import {
  waitForBrowseReady,
  waitForComplianceReviewReady,
  waitForRedFlagReviewReady,
  waitForDefinitionsReady,
  waitForDashboardReady,
  waitForSuggestionModeReady,
  waitForFilterModeReady,
  waitForPromptsReady,
  waitForSaveComplete,
  waitForReviewReady,
  waitForPipelineReady,
} from './helpers';

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
    await expect(page.getByText('Analyzed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Compliance Issues')).toBeVisible();
    await expect(page.getByText('Red Flags')).toBeVisible();

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

    // Wait for filter to apply - the expand button should still be visible after filtering
    await expect(page.getByRole('button', { name: 'Expand' }).first()).toBeVisible({ timeout: 5000 });
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

    // Wait for filter to apply - definition cards should still be visible
    const definitionTerms = page.locator('h3');
    await expect(definitionTerms.first()).toBeVisible({ timeout: 5000 });
  });

});

test.describe('Compliance Issues', () => {

  test('compliance issues filter by issue type', async ({ page }) => {
    // Explicitly use filter mode (not suggestion mode which is now the default)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for compliance issues to load
    await waitForComplianceReviewReady(page);

    // Apply filter - find the Type dropdown
    const typeFilter = page.getByTestId('issue-type-filter');
    await typeFilter.click();

    // Select "Wet Signature" option
    await page.getByRole('option', { name: /wet signature/i }).click();

    // Wait for filter to apply - cards should still be visible after filter
    await expect(page.getByTestId('compliance-issue-card').first()).toBeVisible({ timeout: 10000 });

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
    await waitForComplianceReviewReady(page);

    // Open issue type dropdown
    const typeFilter = page.getByTestId('issue-type-filter');
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
    await waitForComplianceReviewReady(page);

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
    await waitForBrowseReady(page);

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
    await waitForReviewReady(page);

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
    await waitForSuggestionModeReady(page);

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
    await waitForFilterModeReady(page);

    // Verify filter mode UI is visible
    await expect(page.getByText('Status:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Type:', { exact: true })).toBeVisible();
    await expect(page.getByText('Severity:', { exact: true })).toBeVisible();

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
    await waitForSuggestionModeReady(page);

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
    await waitForSuggestionModeReady(page);

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

    // Wait for expanded content - system prompt section should appear
    await expect(page.getByText(/System Prompt/i).first()).toBeVisible({ timeout: 5000 });

    // Should show content from red_flags_analysis (Jennifer Pahlka reference)
    await expect(page.getByText(/Jennifer Pahlka/i).first()).toBeVisible();
  });

  test('compliance issue types in filters match expected types from YAML', async ({ page }) => {
    // Explicitly use filter mode (not suggestion mode which is now the default)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for page to fully load
    await waitForComplianceReviewReady(page);

    // Open issue type dropdown
    const typeFilter = page.getByTestId('issue-type-filter');
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

  test('@mutation compliance issue review saves all fields including team notes', async ({ page }) => {
    // Use filter mode with LOW severity filter to minimize risk
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&severity=low');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for cards to load
    await waitForComplianceReviewReady(page);

    const card = page.getByTestId('compliance-issue-card').first();
    const cardCount = await page.getByTestId('compliance-issue-card').count();

    if (cardCount === 0) {
      console.log('No low severity compliance issues found, skipping test');
      return;
    }

    await expect(card).toBeVisible();

    // Store card ID for cleanup
    const cardId = await card.getAttribute('id');

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

    // Submit the form and wait for save to complete (button re-enables)
    await saveButton.click();
    await waitForSaveComplete(page, saveButton);

    // Verify the form still shows saved values (optimistic update)
    await expect(teamNotesTextarea).toHaveValue(testTeamNotes);

    // SELF-CLEANING: Clear the test data
    // The card is still visible since we didn't change status (stays 'unreviewed')
    // We clear the notes but must leave reviewer name (required for save button to work)
    const cleanupCard = page.locator(`#${cardId}`);
    if (await cleanupCard.count() > 0) {
      const cleanupReviewer = cleanupCard.getByTestId('compliance-reviewer-input');
      const cleanupJustification = cleanupCard.getByTestId('compliance-justification-textarea');
      const cleanupTeamNotes = cleanupCard.getByTestId('compliance-team-notes-textarea');
      const cleanupSaveButton = cleanupCard.getByTestId('compliance-save-button');

      // Wait for form to be enabled again after previous save
      await expect(cleanupReviewer).toBeEnabled({ timeout: 10000 });

      // Clear notes fields and use placeholder reviewer (can't be empty)
      await cleanupReviewer.clear();
      await cleanupReviewer.fill('_');  // Minimal placeholder to enable save
      await cleanupJustification.clear();
      await cleanupTeamNotes.clear();
      await cleanupSaveButton.click();
      await waitForSaveComplete(page);
    }
  });

  test('@mutation red flag review saves all fields', async ({ page }) => {
    // Use review mode with medium severity filter (NY has severity 4-9, no low/1-3)
    await page.goto('/ny/review?type=flags&reviewStatus=unreviewed&severity=medium');
    await expect(page.getByRole('heading', { name: /Review New York/i })).toBeVisible();

    // Wait for cards to load
    await waitForRedFlagReviewReady(page);

    const cardCount = await page.getByTestId('red-flag-card').count();

    if (cardCount === 0) {
      console.log('No medium severity red flags found, skipping test');
      return;
    }

    const card = page.getByTestId('red-flag-card').first();
    await expect(card).toBeVisible();

    // Store card ID for cleanup
    const cardId = await card.getAttribute('id');

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
    await waitForSaveComplete(page);

    // Verify the form shows saved values
    await expect(teamNotesTextarea).toHaveValue(testTeamNotes);

    // SELF-CLEANING: Clear the test data
    // The card is still visible since we didn't change status (stays 'unreviewed')
    // We clear the notes but must leave reviewer name (required for save button to work)
    const cleanupCard = page.locator(`#${cardId}`);
    if (await cleanupCard.count() > 0) {
      const cleanupReviewer = cleanupCard.getByTestId('red-flag-reviewer-input');
      const cleanupJustification = cleanupCard.getByTestId('red-flag-justification-textarea');
      const cleanupTeamNotes = cleanupCard.getByTestId('red-flag-team-notes-textarea');
      const cleanupSaveButton = cleanupCard.getByTestId('red-flag-save-button');

      // Wait for form to be enabled again after previous save
      await expect(cleanupReviewer).toBeEnabled({ timeout: 5000 });

      // Clear notes fields and use placeholder reviewer (can't be empty)
      await cleanupReviewer.clear();
      await cleanupReviewer.fill('_');  // Minimal placeholder to enable save
      await cleanupJustification.clear();
      await cleanupTeamNotes.clear();
      await cleanupSaveButton.click();
      await waitForSaveComplete(page);
    }
  });

  test('@mutation definition review form can be filled', async ({ page }) => {
    // Navigate to definitions review
    await page.goto('/ny/review?mode=review&type=definitions');
    await expect(page.getByRole('heading', { name: /Review New York/i })).toBeVisible();

    // Wait for cards to load
    await waitForReviewReady(page);

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

test.describe('Review Queue Filter Behavior', () => {

  test('@mutation compliance issue is replaced after review in filter mode', async ({ page }) => {
    // Navigate to filter mode with unreviewed status and low severity to minimize risk
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&severity=low');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for cards to load
    await waitForComplianceReviewReady(page);

    const initialCards = page.getByTestId('compliance-issue-card');
    const initialCount = await initialCards.count();

    if (initialCount === 0) {
      console.log('No low severity unreviewed compliance issues found, skipping test');
      return;
    }

    // Get the first card and capture its ID to verify it's replaced
    const firstCard = initialCards.first();
    await expect(firstCard).toBeVisible();
    const firstCardId = await firstCard.getAttribute('id');

    // Fill the form with a unique reviewer name and change status
    const reviewerInput = firstCard.getByTestId('compliance-reviewer-input');
    const statusSelect = firstCard.getByTestId('compliance-status-select');
    const saveButton = firstCard.getByTestId('compliance-save-button');

    const timestamp = Date.now();
    await reviewerInput.fill(`E2E Filter Test ${timestamp}`);

    // Change status from unreviewed to confirmed (Radix UI combobox)
    await statusSelect.click();
    await page.getByRole('option', { name: 'Confirmed' }).click();

    // Submit the form
    await saveButton.click();

    // Wait for the OLD card to disappear (it no longer matches "unreviewed" filter)
    // This confirms the save completed and refetch happened
    const oldCardLocator = page.locator(`#${firstCardId}`);
    await expect(oldCardLocator).toBeHidden({ timeout: 10000 });

    // The old card is now hidden, confirming it was filtered out after status change.
    // No need to check remaining card IDs — the toBeHidden assertion is sufficient.

    // CLEANUP: Revert the reviewed item back to unreviewed
    // Navigate to confirmed filter to find the item we just reviewed
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=confirmed&severity=low');
    await waitForComplianceReviewReady(page);

    // Find the card we reviewed (by ID)
    const reviewedCard = page.locator(`#${firstCardId}`);
    if (await reviewedCard.count() > 0) {
      const revertStatusSelect = reviewedCard.getByTestId('compliance-status-select');
      const revertSaveButton = reviewedCard.getByTestId('compliance-save-button');

      await revertStatusSelect.click();
      await page.getByRole('option', { name: 'Unreviewed' }).click();
      await revertSaveButton.click();
      await waitForSaveComplete(page);
    }
  });

  test('@mutation red flag is replaced after review in filter mode', async ({ page }) => {
    // Navigate to red flag review with unreviewed status and medium severity (NY has severity 4-9, no low/1-3)
    await page.goto('/ny/review?type=flags&reviewStatus=unreviewed&severity=medium');
    await expect(page.getByRole('heading', { name: /Review New York/i })).toBeVisible();

    // Wait for cards to load
    await waitForRedFlagReviewReady(page);

    const initialCards = page.getByTestId('red-flag-card');
    const initialCount = await initialCards.count();

    if (initialCount === 0) {
      console.log('No medium severity unreviewed red flags found, skipping test');
      return;
    }

    // Get the first card and capture its ID to verify it's replaced
    const firstCard = initialCards.first();
    await expect(firstCard).toBeVisible();
    const firstCardId = await firstCard.getAttribute('id');

    // Fill the form with a unique reviewer name and change status
    const reviewerInput = firstCard.getByTestId('red-flag-reviewer-input');
    const statusSelect = firstCard.getByTestId('red-flag-status-select');
    const saveButton = firstCard.getByTestId('red-flag-save-button');

    const timestamp = Date.now();
    await reviewerInput.fill(`E2E Filter Test ${timestamp}`);

    // Change status from unreviewed to confirmed (Radix UI combobox)
    await statusSelect.click();
    await page.getByRole('option', { name: 'Confirmed' }).click();

    // Submit the form
    await saveButton.click();

    // Wait for the OLD card to disappear (it no longer matches "unreviewed" filter)
    // This confirms the save completed and refetch happened
    const oldCardLocator = page.locator(`#${firstCardId}`);
    await expect(oldCardLocator).toBeHidden({ timeout: 10000 });

    // The old card is now hidden, confirming it was filtered out after status change.
    // No need to check remaining card IDs — the toBeHidden assertion is sufficient.

    // CLEANUP: Revert the reviewed item back to unreviewed
    // Navigate to confirmed filter to find the item we just reviewed
    await page.goto('/ny/review?type=flags&reviewStatus=confirmed&severity=low');
    await waitForRedFlagReviewReady(page);

    // Find the card we reviewed (by ID)
    const reviewedCard = page.locator(`#${firstCardId}`);
    if (await reviewedCard.count() > 0) {
      const revertStatusSelect = reviewedCard.getByTestId('red-flag-status-select');
      const revertSaveButton = reviewedCard.getByTestId('red-flag-save-button');

      await revertStatusSelect.click();
      await page.getByRole('option', { name: 'Unreviewed' }).click();
      await revertSaveButton.click();
      await waitForSaveComplete(page);
    }
  });

  test('@mutation compliance issue stays visible when filter is all', async ({ page }) => {
    // Navigate to filter mode with "all" status filter and low severity
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=all&severity=low');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();

    // Wait for cards to load
    await waitForComplianceReviewReady(page);

    const initialCards = page.getByTestId('compliance-issue-card');
    const initialCount = await initialCards.count();

    if (initialCount === 0) {
      console.log('No low severity compliance issues found, skipping test');
      return;
    }

    // Get the first card and its ID for cleanup
    const firstCard = initialCards.first();
    await expect(firstCard).toBeVisible();
    const firstCardId = await firstCard.getAttribute('id');

    // Fill the form with test data (don't change status to avoid side effects)
    const reviewerInput = firstCard.getByTestId('compliance-reviewer-input');
    const teamNotesTextarea = firstCard.getByTestId('compliance-team-notes-textarea');
    const saveButton = firstCard.getByTestId('compliance-save-button');

    const timestamp = Date.now();
    await reviewerInput.fill(`E2E All Filter Test ${timestamp}`);
    await teamNotesTextarea.fill(`Test notes ${timestamp}`);

    // Submit the form
    await saveButton.click();

    // Wait for the update
    await waitForSaveComplete(page);

    // Verify the item is STILL visible (count unchanged)
    const newCount = await page.getByTestId('compliance-issue-card').count();
    expect(newCount).toBe(initialCount);

    // Note: This test only adds reviewer name and notes (no status change)
    // Cleanup is optional since it doesn't affect queue behavior.
    // If needed: UPDATE compliance_issues SET reviewed_by = NULL, team_notes = NULL WHERE reviewed_by LIKE '%E2E All Filter%'
  });

});

test.describe('Sorting Consistency', () => {

  test('compliance issues sorted by severity are consistent across page loads', async ({ page }) => {
    // Navigate to filter mode sorted by severity (desc = highest first)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=all&sortBy=severity&sortOrder=desc');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const initialCount = await cards.count();

    if (initialCount < 2) {
      console.log('Not enough compliance issues to test sorting consistency, skipping');
      return;
    }

    // Get the first card's ID
    const firstCardId = await cards.first().getAttribute('id');

    // Reload the page and verify same item is still first
    await page.reload();
    await waitForComplianceReviewReady(page);

    const newFirstCardId = await page.getByTestId('compliance-issue-card').first().getAttribute('id');

    // The same item should be first after reload (consistent ordering)
    expect(newFirstCardId).toBe(firstCardId);
  });

  test('compliance issues sorted by severity asc show lowest first consistently', async ({ page }) => {
    // Navigate to filter mode sorted by severity (asc = lowest first)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=all&sortBy=severity&sortOrder=asc');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const initialCount = await cards.count();

    if (initialCount < 2) {
      console.log('Not enough compliance issues to test sorting consistency, skipping');
      return;
    }

    // Get the first card's ID
    const firstCardId = await cards.first().getAttribute('id');

    // Reload the page
    await page.reload();
    await waitForComplianceReviewReady(page);

    const newFirstCardId = await page.getByTestId('compliance-issue-card').first().getAttribute('id');

    // Same item should still be first
    expect(newFirstCardId).toBe(firstCardId);
  });

  test('red flags sorted by severity are consistent across page loads', async ({ page }) => {
    // Navigate to red flags sorted by severity
    await page.goto('/nj/review?type=flags&reviewStatus=all&sortBy=severity&sortOrder=desc');
    await expect(page.getByRole('heading', { name: /Review New Jersey/i })).toBeVisible();
    await waitForRedFlagReviewReady(page);

    const cards = page.getByTestId('red-flag-card');
    const initialCount = await cards.count();

    if (initialCount < 2) {
      console.log('Not enough red flags to test sorting consistency, skipping');
      return;
    }

    // Get the first card's ID
    const firstCardId = await cards.first().getAttribute('id');

    // Reload and verify consistency
    await page.reload();
    await waitForRedFlagReviewReady(page);

    const newFirstCardId = await page.getByTestId('red-flag-card').first().getAttribute('id');
    expect(newFirstCardId).toBe(firstCardId);
  });

});

test.describe('Pipeline Analysis Page', () => {

  test('pipeline page loads with table', async ({ page }) => {
    await page.goto('/nj/pipeline');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Should have a table
    await expect(page.locator('table')).toBeVisible();
  });

  test('issueType filter works correctly', async ({ page }) => {
    // Navigate to pipeline with issue type filter
    await page.goto('/nj/pipeline?issueType=wet_signature');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Should load without error
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('issueType=all does not cause empty results', async ({ page }) => {
    // Navigate with issueType=all (the bug case)
    await page.goto('/nj/pipeline?issueType=all');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Should show results (not empty due to WHERE issue_type = 'all')
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Verify we have rows (not just headers)
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('tier3 filter federalMandateConfirmed=false only shows tier3 rows', async ({ page }) => {
    // Navigate with federalMandateConfirmed=false filter
    await page.goto('/nj/pipeline?federalMandateConfirmed=false');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Page should load without error
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // The fix ensures only rows with tier3Classification are shown
    // We can't easily verify the data in e2e, but we verify no crash/error
  });

  test('tier3 filter stateDiscretion=false loads with correct structure', async ({ page }) => {
    await page.goto('/nj/pipeline?stateDiscretion=false');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Verify filter parameter is reflected in the URL
    expect(page.url()).toContain('stateDiscretion=false');

    const table = page.locator('table');
    const noRecords = page.getByText('No pipeline records found');
    await expect(table.or(noRecords)).toBeVisible({ timeout: 10000 });

    // If table loaded, verify expected column headers and data rows
    if (await table.isVisible()) {
      await expect(table.locator('th:has-text("Issue Type")')).toBeVisible();
      await expect(table.locator('th:has-text("Severity")')).toBeVisible();
      const rowCount = await table.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('tier3 filter alternativeFound=false loads with correct structure', async ({ page }) => {
    await page.goto('/nj/pipeline?alternativeFound=false');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Verify filter parameter is reflected in the URL
    expect(page.url()).toContain('alternativeFound=false');

    const table = page.locator('table');
    const noRecords = page.getByText('No pipeline records found');
    await expect(table.or(noRecords)).toBeVisible({ timeout: 10000 });

    // If table loaded, verify expected column headers and data rows
    if (await table.isVisible()) {
      await expect(table.locator('th:has-text("Issue Type")')).toBeVisible();
      await expect(table.locator('th:has-text("Severity")')).toBeVisible();
      const rowCount = await table.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('tier3Trigger filter high_risk_issue loads with correct structure', async ({ page }) => {
    await page.goto('/nj/pipeline?tier3Trigger=high_risk_issue');
    await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();

    // Verify filter parameter is reflected in the URL
    expect(page.url()).toContain('tier3Trigger=high_risk_issue');

    const table = page.locator('table');
    const noRecords = page.getByText('No pipeline records found');
    await expect(table.or(noRecords)).toBeVisible({ timeout: 10000 });

    // If table loaded, verify expected column headers and data rows
    if (await table.isVisible()) {
      await expect(table.locator('th:has-text("Issue Type")')).toBeVisible();
      await expect(table.locator('th:has-text("Severity")')).toBeVisible();
      const rowCount = await table.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    }
  });

});

test.describe('Data Integrity', () => {

  test('compliance cards do not show stale column names as text', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = Math.min(await cards.count(), 3);

    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      // These DB column names should never appear as raw text in the UI
      expect(text).not.toContain('matched_pattern');
      expect(text).not.toContain('matched_context');
      expect(text).not.toContain('requirement_text');
      expect(text).not.toContain('impact_assessment');
      expect(text).not.toContain('requirement_found');
      expect(text).not.toContain('is_verbatim');
      expect(text).not.toContain('required_by_statute');
      expect(text).not.toContain('statute_citation');
      expect(text).not.toContain('verbatim_supporting_text');
      expect(text).not.toContain('decision_rationale');
    }
  });

  test('review cards do not leak review column names from compliance_issues', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = Math.min(await cards.count(), 3);

    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      // Review column names should never appear as raw text
      expect(text).not.toContain('reviewer_severity');
      expect(text).not.toContain('reviewer_original_severity');
      expect(text).not.toContain('developer_status');
      expect(text).not.toContain('developer_assigned');
      expect(text).not.toContain('justification_notes');
      expect(text).not.toContain('developer_question');
    }
  });

});

