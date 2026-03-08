import { describe, it, expect } from 'vitest';

/**
 * Contract/logic tests for JenAIReviewSummary component.
 *
 * Replicates the missingCritical logic without rendering (node environment).
 * The component flags fields that are absent from a review.
 */

interface ReviewFields {
  reviewedBy: string | null;
  justificationNotes: string | null;
  reviewStatus: string | null;
  impactType: string | null;
  teamNotes: string | null;
}

function getMissingCritical(fields: ReviewFields): string[] {
  const missing: string[] = [];
  if (!fields.reviewedBy) missing.push('Reviewer');
  if (!fields.justificationNotes) missing.push('Justification');
  return missing;
}

function hasTeamNotesSection(fields: ReviewFields): boolean {
  // Team notes section shows when teamNotes is truthy OR justificationNotes is falsy
  return !!(fields.teamNotes || !fields.justificationNotes);
}

describe('ReviewSummary: missingCritical logic', () => {
  it('flags both reviewer and justification when both are null', () => {
    const missing = getMissingCritical({
      reviewedBy: null,
      justificationNotes: null,
      reviewStatus: 'unreviewed',
      impactType: null,
      teamNotes: null,
    });
    expect(missing).toEqual(['Reviewer', 'Justification']);
  });

  it('flags only reviewer when justification is present', () => {
    const missing = getMissingCritical({
      reviewedBy: null,
      justificationNotes: 'This is burdensome because...',
      reviewStatus: 'confirmed',
      impactType: null,
      teamNotes: null,
    });
    expect(missing).toEqual(['Reviewer']);
  });

  it('flags only justification when reviewer is present', () => {
    const missing = getMissingCritical({
      reviewedBy: 'analyst@example.com',
      justificationNotes: null,
      reviewStatus: 'confirmed',
      impactType: null,
      teamNotes: null,
    });
    expect(missing).toEqual(['Justification']);
  });

  it('returns empty array when both are present', () => {
    const missing = getMissingCritical({
      reviewedBy: 'analyst@example.com',
      justificationNotes: 'Clear burden identified',
      reviewStatus: 'confirmed',
      impactType: 'cost',
      teamNotes: null,
    });
    expect(missing).toEqual([]);
  });

  it('treats empty string as missing (falsy)', () => {
    const missing = getMissingCritical({
      reviewedBy: '',
      justificationNotes: '',
      reviewStatus: 'unreviewed',
      impactType: null,
      teamNotes: null,
    });
    expect(missing).toEqual(['Reviewer', 'Justification']);
  });
});

describe('ReviewSummary: team notes section visibility', () => {
  it('shows team notes section when teamNotes is present', () => {
    expect(hasTeamNotesSection({
      reviewedBy: 'analyst',
      justificationNotes: 'present',
      reviewStatus: 'confirmed',
      impactType: null,
      teamNotes: 'Some notes',
    })).toBe(true);
  });

  it('shows team notes section when justification is missing (even without teamNotes)', () => {
    expect(hasTeamNotesSection({
      reviewedBy: 'analyst',
      justificationNotes: null,
      reviewStatus: 'confirmed',
      impactType: null,
      teamNotes: null,
    })).toBe(true);
  });

  it('hides team notes section when justification is present and no teamNotes', () => {
    expect(hasTeamNotesSection({
      reviewedBy: 'analyst',
      justificationNotes: 'present',
      reviewStatus: 'confirmed',
      impactType: null,
      teamNotes: null,
    })).toBe(false);
  });
});
