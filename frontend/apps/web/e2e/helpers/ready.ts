import { expect, Page, Locator } from '@playwright/test';

/**
 * Page readiness helpers for smoke tests.
 * Use these instead of waitForTimeout() or waitForLoadState('networkidle').
 */

/** Wait for browse page to be fully loaded and interactive */
export async function waitForBrowseReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Browse/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand' }).first()).toBeVisible();
  await expect(page.getByText(/\d+,?\d* documents/)).toBeVisible();
}

/** Wait for review page to be fully loaded with cards */
export async function waitForReviewReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();
  // Wait for either compliance cards, red flag cards, or definition cards
  const cardLocator = page.locator('[data-testid$="-card"]').first();
  await expect(cardLocator).toBeVisible({ timeout: 10000 });
}

/** Wait for review page with compliance issues specifically */
export async function waitForComplianceReviewReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();
  await expect(page.getByTestId('compliance-issue-card').first()).toBeVisible({ timeout: 10000 });
}

/** Wait for review page with red flags specifically */
export async function waitForRedFlagReviewReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();
  await expect(page.getByTestId('red-flag-card').first()).toBeVisible({ timeout: 10000 });
}

/** Wait for definitions glossary page to be fully loaded */
export async function waitForDefinitionsReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Definitions Glossary/i })).toBeVisible();
  await expect(page.getByText(/Total Definitions/i)).toBeVisible();
  await expect(page.locator('h3').first()).toBeVisible();
}

/** Wait for dashboard page to be fully loaded with statistics */
export async function waitForDashboardReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Regulatory Analysis Dashboard/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Overview/i })).toBeVisible();
  // Wait for formatted numbers (e.g., "123,456")
  await expect(page.locator('text=/\\d{1,3}(,\\d{3})+/').first()).toBeVisible();
}

/** Wait for table view to be fully loaded with rows */
export async function waitForTableReady(page: Page) {
  await expect(page.getByRole('heading', { name: /New York|New Jersey/i })).toBeVisible();
  await expect(page.locator('table tbody tr').first()).toBeVisible();
}

/** Wait for suggestion mode UI to be ready */
export async function waitForSuggestionModeReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();
  await expect(page.getByText('Items per batch:')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /Skip Group/i })).toBeVisible();
}

/** Wait for filter mode UI to be ready */
export async function waitForFilterModeReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();
  await expect(page.getByText('Status:')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Type:', { exact: true })).toBeVisible();
}

/** Wait for prompts page to be fully loaded */
export async function waitForPromptsReady(page: Page) {
  await expect(page.locator('h1').filter({ hasText: /Prompts/i }).first()).toBeVisible();
}

/** Wait for a form save operation to complete */
export async function waitForSaveComplete(page: Page, saveButton?: Locator) {
  if (saveButton) {
    // Wait for the save button to be re-enabled (indicates save completed)
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
  } else {
    // Fallback: wait briefly for UI to settle
    await page.waitForTimeout(500);
  }
}

/** Wait for filter to be applied (cards to refresh) */
export async function waitForFilterApplied(page: Page, cardTestId: string) {
  // Wait for the first card to be visible after filter change
  await expect(page.getByTestId(cardTestId).first()).toBeVisible({ timeout: 10000 });
}

/** Wait for pipeline/analysis page to be ready */
export async function waitForPipelineReady(page: Page) {
  await expect(page.getByRole('heading', { name: /Research Pipeline/i }).first()).toBeVisible();
  // Wait for table or empty state
  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 10000 });
}
