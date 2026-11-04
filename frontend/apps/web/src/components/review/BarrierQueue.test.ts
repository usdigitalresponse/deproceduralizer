import { describe, it, expect } from 'vitest';

/**
 * Replicate the filter-aware update logic from BarrierQueue.handleIssueUpdated.
 *
 * When a user saves a review and the issue's status changes, the queue should
 * remove the card if it no longer matches the active status filter.
 */

function shouldRemoveIssue(
  activeFilter: string | null | undefined,
  updatedStatus: string | null | undefined,
): boolean {
  // Matches the condition in BarrierQueue.tsx handleIssueUpdated:
  // if (activeStatusFilter && activeStatusFilter !== 'all' && updatedStatus !== activeStatusFilter)
  if (activeFilter && activeFilter !== 'all' && updatedStatus !== activeFilter) {
    return true;
  }
  return false;
}

describe('BarrierQueue: shouldRemoveIssue (filter-aware update logic)', () => {
  it('keeps issue when filter is "all" regardless of new status', () => {
    expect(shouldRemoveIssue('all', 'confirmed')).toBe(false);
    expect(shouldRemoveIssue('all', 'rejected_clear_fp')).toBe(false);
    expect(shouldRemoveIssue('all', 'unreviewed')).toBe(false);
  });

  it('removes issue when filter is "unreviewed" and status changes to "confirmed"', () => {
    expect(shouldRemoveIssue('unreviewed', 'confirmed')).toBe(true);
  });

  it('removes issue when filter is "unreviewed" and status changes to any non-matching value', () => {
    expect(shouldRemoveIssue('unreviewed', 'rejected_clear_fp')).toBe(true);
    expect(shouldRemoveIssue('unreviewed', 'needs_context')).toBe(true);
    expect(shouldRemoveIssue('unreviewed', 'deferred')).toBe(true);
  });

  it('keeps issue when filter matches the updated status', () => {
    expect(shouldRemoveIssue('confirmed', 'confirmed')).toBe(false);
    expect(shouldRemoveIssue('unreviewed', 'unreviewed')).toBe(false);
    expect(shouldRemoveIssue('deferred', 'deferred')).toBe(false);
  });

  it('keeps issue when filter is null (no filter active)', () => {
    expect(shouldRemoveIssue(null, 'confirmed')).toBe(false);
    expect(shouldRemoveIssue(null, 'unreviewed')).toBe(false);
  });

  it('keeps issue when filter is undefined (no filter active)', () => {
    expect(shouldRemoveIssue(undefined, 'confirmed')).toBe(false);
    expect(shouldRemoveIssue(undefined, 'unreviewed')).toBe(false);
  });

  it('keeps issue when filter is empty string', () => {
    expect(shouldRemoveIssue('', 'confirmed')).toBe(false);
  });

  // Developer mode uses the same logic with developerStatus instead of reviewStatus
  it('applies same logic for developer mode filters', () => {
    expect(shouldRemoveIssue('approved', 'needs_changes')).toBe(true);
    expect(shouldRemoveIssue('approved', 'approved')).toBe(false);
    expect(shouldRemoveIssue('all', 'needs_changes')).toBe(false);
  });
});

/**
 * Test hasActiveFilters logic for Barrier filters.
 * Mirrors the condition in BarrierReviewFilters and BarrierDeveloperFilters.
 */
function hasActiveFilters(filters: {
  reviewStatus?: string | null;
  severity?: string | null;
  source?: string | null;
  category?: string | null;
  part?: string | null;
  sectionType?: string | null;
  search?: string | null;
  complexity?: string | null;
  verbatim?: string | null;
}): boolean {
  return Boolean(
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    filters.severity ||
    (filters.source && filters.source !== 'all') ||
    filters.category ||
    filters.part ||
    filters.sectionType ||
    filters.search ||
    filters.complexity ||
    (filters.verbatim && filters.verbatim !== 'all')
  );
}

describe('BarrierQueue: hasActiveFilters includes filter fields', () => {
  it('returns false when no filters are active', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all' })).toBe(false);
  });

  it('returns true when part filter is set', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all', part: '418' })).toBe(true);
  });

  it('returns true when sectionType filter is set', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all', sectionType: 'requirements' })).toBe(true);
  });

  it('returns true when search filter is set', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all', search: 'child care' })).toBe(true);
  });

  it('returns true when complexity filter is set', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all', complexity: 'HIGH' })).toBe(true);
  });

  it('returns true when verbatim filter is non-default', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all', verbatim: 'true' })).toBe(true);
  });

  it('returns false when verbatim is "all"', () => {
    expect(hasActiveFilters({ reviewStatus: 'unreviewed', source: 'all', verbatim: 'all' })).toBe(false);
  });

  it('returns false when filters are null', () => {
    expect(hasActiveFilters({
      reviewStatus: 'unreviewed',
      source: 'all',
      part: null,
      sectionType: null,
      search: null,
      complexity: null,
      verbatim: null,
    })).toBe(false);
  });
});

describe('BarrierQueue: cleared filter state has no active filters', () => {
  it('hasActiveFilters returns false for the clear-filters shape', () => {
    // This shape mirrors what clearFilters() passes to setFilters
    expect(hasActiveFilters({
      reviewStatus: 'unreviewed',
      severity: null,
      category: null,
      source: 'all',
      part: null,
      sectionType: null,
      search: null,
      complexity: null,
      verbatim: 'all',
    })).toBe(false);
  });
});
