import { describe, it, expect } from 'vitest';

/**
 * Replicate the filter-aware update logic from JenAIQueue.handleIssueUpdated.
 *
 * When a user saves a review and the issue's status changes, the queue should
 * remove the card if it no longer matches the active status filter.
 */

function shouldRemoveIssue(
  activeFilter: string | null | undefined,
  updatedStatus: string | null | undefined,
): boolean {
  // Matches the condition in JenAIQueue.tsx handleIssueUpdated:
  // if (activeStatusFilter && activeStatusFilter !== 'all' && updatedStatus !== activeStatusFilter)
  if (activeFilter && activeFilter !== 'all' && updatedStatus !== activeFilter) {
    return true;
  }
  return false;
}

describe('JenAIQueue: shouldRemoveIssue (filter-aware update logic)', () => {
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
