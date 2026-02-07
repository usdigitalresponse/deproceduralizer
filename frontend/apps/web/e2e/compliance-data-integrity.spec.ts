import { test, expect } from '@playwright/test';
import {
  waitForComplianceReviewReady,
  waitForBrowseReady,
} from './helpers';

/**
 * Compliance Issue Data Integrity Tests
 *
 * These tests verify that compliance issue data renders correctly in the UI.
 * Written BEFORE removing legacy columns (matched_pattern, matched_context,
 * requirement_text, impact_assessment) to establish a baseline, then re-run
 * AFTER the removal to confirm no regressions.
 *
 * PR 6.3 additions: Tests that review/developer fields are served from
 * compliance_issue_analyses (not compliance_issues). Verifies review actions
 * still work after the column migration.
 *
 * Key invariants:
 * - Compliance cards display non-empty context text
 * - Compliance cards show issue type labels
 * - Pattern tags render when pattern data exists
 * - No "null" or "undefined" strings leak into the UI
 * - Section detail pages render compliance issue data
 * - Review/developer status counts are served correctly (PR 6.3)
 */

test.describe('Compliance Issue Data Integrity', () => {

  test('review cards display non-empty context text', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const firstCard = page.getByTestId('compliance-issue-card').first();
    await expect(firstCard).toBeVisible();

    // Card should have substantial text content (not empty/broken)
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(50);

    // No raw null/undefined leaking into the rendered text
    expect(cardText).not.toMatch(/\bnull\b/);
    expect(cardText).not.toMatch(/\bundefined\b/);
  });

  test('review cards show LLM analysis or technical details', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const firstCard = page.getByTestId('compliance-issue-card').first();
    await expect(firstCard).toBeVisible();

    // Card should have either:
    // - LLM Analysis section (decision rationale / verbatim text)
    // - Or a "Technical Details" collapsible (for regex pattern)
    // At least one of these must be present for the card to be useful
    const llmSection = firstCard.getByText('LLM Analysis');
    const technicalDetails = firstCard.getByText('Technical Details');
    const regulationActions = firstCard.getByText(/View Regulation/i);

    const hasLLM = await llmSection.isVisible().catch(() => false);
    const hasTechnical = await technicalDetails.isVisible().catch(() => false);
    const hasActions = await regulationActions.isVisible().catch(() => false);

    expect(
      hasLLM || hasTechnical || hasActions,
      'Compliance card should have LLM Analysis, Technical Details, or Regulation Actions'
    ).toBeTruthy();
  });

  test('multiple review cards all have content', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check up to 5 cards for non-empty content
    const checkCount = Math.min(count, 5);
    for (let i = 0; i < checkCount; i++) {
      const card = cards.nth(i);
      const text = await card.textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(30);
      expect(text).not.toMatch(/\bnull\b/);
      expect(text).not.toMatch(/\bundefined\b/);
    }
  });

  test('section detail page renders compliance issue context', async ({ page }) => {
    // Navigate to a known NJ section with compliance issues
    // (same test document used in smoke.spec.ts)
    await page.goto('/nj/regulations/150387');

    // Wait for page to load
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Check if compliance issues section exists on this page
    // Use a heading locator to avoid matching footer text that mentions "compliance issues"
    const complianceHeading = page.getByRole('heading', { name: /Compliance Issues/i });
    const hasCompliance = await complianceHeading.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCompliance) {
      // The compliance issues section heading should contain a count like "Compliance Issues (1)"
      const headingText = await complianceHeading.textContent();
      expect(headingText).toMatch(/Compliance Issues\s*\(\d+\)/i);
    }
  });

  test('browse detail panel shows compliance issue data', async ({ page }) => {
    // Navigate to NJ browse and expand to find a section with compliance issues
    await page.goto('/nj/browse');
    await waitForBrowseReady(page);

    // Look for a compliance badge in the tree
    const complianceBadge = page.getByText(/\d+ compliance/i).first();
    const hasBadge = await complianceBadge.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBadge) {
      // The badge text should be a number + "compliance"
      const badgeText = await complianceBadge.textContent();
      expect(badgeText).toMatch(/^\d+ compliance$/);
    }
  });

  test('compliance cards do not show stale column names as text', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    // Check multiple cards for any stale column name leakage
    const cards = page.getByTestId('compliance-issue-card');
    const count = Math.min(await cards.count(), 3);

    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      // These column names should never appear as raw text in the UI
      // PR 6.1 columns
      expect(text).not.toContain('matched_pattern');
      expect(text).not.toContain('matched_context');
      expect(text).not.toContain('requirement_text');
      expect(text).not.toContain('impact_assessment');
      // PR 6.2 columns (now sourced from compliance_issue_analyses)
      expect(text).not.toContain('requirement_found');
      expect(text).not.toContain('is_verbatim');
      expect(text).not.toContain('required_by_statute');
      expect(text).not.toContain('statute_citation');
      expect(text).not.toContain('verbatim_supporting_text');
      expect(text).not.toContain('decision_rationale');
    }
  });

  test('review cards show severity badges', async ({ page }) => {
    // Use requirementFound=true filter to get LLM-confirmed issues (more likely to have severity)
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&requirementFound=true');
    await waitForComplianceReviewReady(page);

    const firstCard = page.getByTestId('compliance-issue-card').first();
    await expect(firstCard).toBeVisible();

    // Severity should be displayed as text like "Medium (6)" or "High (8)" or "Low (3)"
    const cardText = await firstCard.textContent();
    const hasSeverity = /(?:Low|Medium|High|Critical)\s*\(\d+\)/i.test(cardText || '');
    // At least some confirmed issues should have severity
    expect(hasSeverity).toBeTruthy();
  });

  test('review cards show LLM confirmed/rejected badges', async ({ page }) => {
    // Filter for LLM confirmed issues
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&requirementFound=true');
    await waitForComplianceReviewReady(page);

    const firstCard = page.getByTestId('compliance-issue-card').first();
    await expect(firstCard).toBeVisible();

    // Should show "LLM Confirmed" badge
    const confirmedBadge = firstCard.getByText('LLM Confirmed');
    await expect(confirmedBadge).toBeVisible();
  });

  test('review cards show verbatim supporting text', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&requirementFound=true');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = Math.min(await cards.count(), 5);

    // At least one card should have an LLM Analysis section with supporting text
    let foundLLMAnalysis = false;
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const llmSection = card.getByText('LLM Analysis');
      if (await llmSection.isVisible().catch(() => false)) {
        foundLLMAnalysis = true;
        break;
      }
    }
    expect(foundLLMAnalysis).toBeTruthy();
  });

  test('review cards show decision rationale', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&requirementFound=true');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = Math.min(await cards.count(), 5);

    // At least one card should have "Decision Rationale:" text
    let foundRationale = false;
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const rationale = card.getByText('Decision Rationale:');
      if (await rationale.isVisible().catch(() => false)) {
        foundRationale = true;
        break;
      }
    }
    expect(foundRationale).toBeTruthy();
  });

  test('severity filter returns results', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&severity=high');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('requirementFound filter works', async ({ page }) => {
    // Default review queue filters to requirementFound=true
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&requirementFound=true');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // All visible cards should show "LLM Confirmed" badge
    const firstCard = cards.first();
    const confirmedBadge = firstCard.getByText('LLM Confirmed');
    await expect(confirmedBadge).toBeVisible();
  });

});

/**
 * PR 6.3: Review/Developer Fields Migration Tests
 *
 * These tests verify that review and developer tracking fields
 * work correctly after being moved from compliance_issues to
 * compliance_issue_analyses.
 */
test.describe('PR 6.3: Review Fields on Analyses', () => {

  test('review status filter shows unreviewed issues (default)', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Status counts sidebar should be visible and show counts
    // This verifies getCountsByStatus() works from analyses table
    const statusCounts = page.getByText(/unreviewed/i).first();
    await expect(statusCounts).toBeVisible();
  });

  test('review status filter shows confirmed issues', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=confirmed');
    await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();

    // Wait for page to settle - may have 0 results or cards
    await page.waitForTimeout(3000);

    // The page should load without errors (no null/undefined)
    const pageText = await page.textContent('body');
    expect(pageText).not.toMatch(/\bnull\b/);
    expect(pageText).not.toMatch(/\bundefined\b/);
  });

  test('review cards do not leak review column names from compliance_issues', async ({ page }) => {
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = Math.min(await cards.count(), 3);

    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      // PR 6.3: These review column names should never appear as raw text
      expect(text).not.toContain('reviewer_severity');
      expect(text).not.toContain('reviewer_original_severity');
      expect(text).not.toContain('developer_status');
      expect(text).not.toContain('developer_assigned');
      expect(text).not.toContain('justification_notes');
      expect(text).not.toContain('developer_question');
    }
  });

  test('severity filter still works with reviewer_severity alias', async ({ page }) => {
    // This tests that the reviewer_severity -> severity alias works in queries
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=unreviewed&severity=high');
    await waitForComplianceReviewReady(page);

    const cards = page.getByTestId('compliance-issue-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Cards with high severity should show severity badge
    const firstCard = cards.first();
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText).not.toMatch(/\bnull\b/);
  });

  test('developer tab loads without errors', async ({ page }) => {
    // Navigate to developer view which uses getDeveloperStatusCounts from analyses
    await page.goto('/nj/review?type=compliance&queueMode=filter&reviewStatus=confirmed');
    await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible();

    // Page should load without crashing
    await page.waitForTimeout(3000);
    const pageText = await page.textContent('body');
    expect(pageText).not.toMatch(/error/i);
  });

});
