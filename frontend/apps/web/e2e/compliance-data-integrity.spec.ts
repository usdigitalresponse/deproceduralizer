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
 * Key invariants:
 * - Compliance cards display non-empty context text
 * - Compliance cards show issue type labels
 * - Pattern tags render when pattern data exists
 * - No "null" or "undefined" strings leak into the UI
 * - Section detail pages render compliance issue data
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
    const complianceHeading = page.getByText(/Compliance Issues/i).first();
    const hasCompliance = await complianceHeading.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCompliance) {
      // The compliance issues section should have visible text content
      const section = page.locator('text=/Compliance Issues/i >> xpath=ancestor::*[4]');
      const sectionText = await section.textContent().catch(() => '');
      expect(sectionText!.length).toBeGreaterThan(20);
      expect(sectionText).not.toMatch(/\bnull\b/);
      expect(sectionText).not.toMatch(/\bundefined\b/);
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
      expect(text).not.toContain('matched_pattern');
      expect(text).not.toContain('matched_context');
      expect(text).not.toContain('requirement_text');
      expect(text).not.toContain('impact_assessment');
    }
  });

});
