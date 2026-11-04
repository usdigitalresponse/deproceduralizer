import { describe, it, expect } from 'vitest';
import {
  buildTier3FlagFilter,
  buildAnalysisListFilters,
  buildAnalysisListSort,
  mapAnalysisListRow,
} from './compliance-issues.repository';

// ═══════════════════════════════════════════════════════════════════
// buildTier3FlagFilter (JSONB flag helper)
// ═══════════════════════════════════════════════════════════════════

describe('buildTier3FlagFilter', () => {
  it('returns undefined when value is undefined', () => {
    expect(buildTier3FlagFilter('federal_mandate_confirmed', undefined)).toBeUndefined();
  });

  it('returns a SQL condition when value is "true"', () => {
    const result = buildTier3FlagFilter('federal_mandate_confirmed', 'true');
    expect(result).toBeDefined();
  });

  it('returns a SQL condition when value is "false"', () => {
    const result = buildTier3FlagFilter('state_discretion_found', 'false');
    expect(result).toBeDefined();
  });

  it('returns a SQL condition when value is "no_tier3"', () => {
    const result = buildTier3FlagFilter('advocacy_for_change', 'no_tier3');
    expect(result).toBeDefined();
  });

  it('handles all 4 JSONB flag names', () => {
    const flags = [
      'federal_mandate_confirmed',
      'state_discretion_found',
      'modernized_alternative_found',
      'superseded_by_law',
      'advocacy_for_change',
    ];
    for (const flag of flags) {
      expect(buildTier3FlagFilter(flag, 'true')).toBeDefined();
      expect(buildTier3FlagFilter(flag, 'false')).toBeDefined();
      expect(buildTier3FlagFilter(flag, 'no_tier3')).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildAnalysisListFilters
// ═══════════════════════════════════════════════════════════════════

describe('buildAnalysisListFilters', () => {
  it('always includes the jurisdiction condition', () => {
    const conditions = buildAnalysisListFilters({ jurisdiction: 'nj' });
    expect(conditions.length).toBeGreaterThanOrEqual(1);
  });

  it('returns only base conditions when no filters provided', () => {
    const conditions = buildAnalysisListFilters({ jurisdiction: 'nj' });
    // Just the jurisdiction + source condition
    expect(conditions.length).toBe(2);
  });

  it('returns only base conditions when filters is empty object', () => {
    const conditions = buildAnalysisListFilters({ jurisdiction: 'nj', filters: {} });
    expect(conditions.length).toBe(2);
  });

  // --- Tier completed filter ---
  it('adds tier completed condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tierCompleted: 2 },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Classification filter ---
  it('adds classification condition (cascading tier3 -> tier2 -> tier1)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { classification: 'burdensome' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Federal mandate filter ---
  it('adds federal mandate condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { federalMandate: true },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Pipeline run filter ---
  it('adds pipeline run=true condition (tier >= 1)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { pipelineRun: true },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds pipeline run=false condition (tier = 0)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { pipelineRun: false },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Issue type filter ---
  it('adds issue type condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { issueType: 'newspaper' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Severity range filter ---
  it('adds severity=high condition (>= 7)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severity: 'high' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds severity=medium condition (4-6)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severity: 'medium' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds severity=low condition (1-3)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severity: 'low' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds severity=none condition (IS NULL)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severity: 'none' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Severity changed filter ---
  it('adds severityChanged=increased condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severityChanged: 'increased' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds severityChanged=decreased condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severityChanged: 'decreased' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds severityChanged=unchanged condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severityChanged: 'unchanged' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds severityChanged=no_tier3 condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { severityChanged: 'no_tier3' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Tier 3 flag filters (JSONB) ---
  it('adds federalMandateConfirmed=true condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { federalMandateConfirmed: 'true' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds federalMandateConfirmed=false condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { federalMandateConfirmed: 'false' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds stateDiscretion filter', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { stateDiscretion: 'true' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds alternativeFound filter', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { alternativeFound: 'true' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds supersededByLaw filter', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { supersededByLaw: 'false' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds advocacyForChange filter', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { advocacyForChange: 'no_tier3' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Evidence gap filter (boolean column, not JSONB) ---
  it('adds evidenceGap=true condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { evidenceGap: 'true' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds evidenceGap=false condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { evidenceGap: 'false' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds evidenceGap=no_tier3 condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { evidenceGap: 'no_tier3' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Tier 3 trigger filter ---
  it('adds tier3Trigger=high_risk_issue condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'high_risk_issue' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds tier3Trigger=federal_citation condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'federal_citation' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds tier3Trigger=no_alternative condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'no_alternative' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds tier3Trigger=high_severity condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'high_severity' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds tier3Trigger=controversial condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'controversial' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds tier3Trigger=mandate_suspected condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'mandate_suspected' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds tier3Trigger=not_triggered condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { tier3Trigger: 'not_triggered' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Easy cleanup filter ---
  it('adds easyCleanup=any condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { easyCleanup: 'any' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds easyCleanup=trivial condition (specific effort level)', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { easyCleanup: 'trivial' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds easyCleanup=easy condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { easyCleanup: 'easy' },
    });
    expect(conditions.length).toBe(3);
  });

  it('adds easyCleanup=medium condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { easyCleanup: 'medium' },
    });
    expect(conditions.length).toBe(3);
  });

  // --- Bookmarked only filter ---
  it('adds bookmarkedOnly=true condition', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { bookmarkedOnly: true },
    });
    expect(conditions.length).toBe(3);
  });

  it('does not add condition when bookmarkedOnly=false', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: { bookmarkedOnly: false },
    });
    expect(conditions.length).toBe(2);
  });

  // --- Combined filters ---
  it('adds multiple conditions for combined filters', () => {
    const conditions = buildAnalysisListFilters({
      jurisdiction: 'nj',
      filters: {
        tierCompleted: 3,
        classification: 'burdensome',
        severity: 'high',
        federalMandateConfirmed: 'true',
        bookmarkedOnly: true,
      },
    });
    // jurisdiction + source + tierCompleted + classification + severity + federalMandateConfirmed + bookmarkedOnly
    expect(conditions.length).toBe(7);
  });

  it('handles NYC jurisdiction code', () => {
    const conditions = buildAnalysisListFilters({ jurisdiction: 'nyc' });
    expect(conditions.length).toBe(2);
  });

  it('handles NY jurisdiction code', () => {
    const conditions = buildAnalysisListFilters({ jurisdiction: 'ny' });
    expect(conditions.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildAnalysisListSort
// ═══════════════════════════════════════════════════════════════════

describe('buildAnalysisListSort', () => {
  it('returns an array of order clauses', () => {
    const clauses = buildAnalysisListSort('createdAt', 'desc');
    expect(Array.isArray(clauses)).toBe(true);
    expect(clauses.length).toBeGreaterThanOrEqual(1);
  });

  it('returns more clauses for severity sort (includes tiebreakers)', () => {
    const severityClauses = buildAnalysisListSort('severity', 'desc');
    const createdAtClauses = buildAnalysisListSort('createdAt', 'desc');
    expect(severityClauses.length).toBeGreaterThan(createdAtClauses.length);
  });

  it('handles all valid sort columns', () => {
    for (const sortBy of ['issueType', 'severity', 'highestTier', 'createdAt'] as const) {
      const clauses = buildAnalysisListSort(sortBy, 'asc');
      expect(clauses.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles both sort directions', () => {
    const ascClauses = buildAnalysisListSort('createdAt', 'asc');
    const descClauses = buildAnalysisListSort('createdAt', 'desc');
    expect(ascClauses.length).toBe(descClauses.length);
  });

  it('defaults to createdAt for unknown sort column', () => {
    const clauses = buildAnalysisListSort('unknown_column', 'desc');
    expect(clauses.length).toBeGreaterThanOrEqual(1);
  });

  it('severity DESC has NULLS LAST behavior', () => {
    const clauses = buildAnalysisListSort('severity', 'desc');
    // Should include 5 items: primary sort, easy cleanup, cleanup effort, issue type, id
    expect(clauses.length).toBe(5);
  });

  it('non-severity sort has id tiebreaker', () => {
    const clauses = buildAnalysisListSort('createdAt', 'desc');
    // Should include 2 items: primary sort, id tiebreaker
    expect(clauses.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// mapAnalysisListRow
// ═══════════════════════════════════════════════════════════════════

describe('mapAnalysisListRow', () => {
  const baseRow = {
    documentId: 123,
    issueType: 'newspaper',
    highestTierCompleted: 2,
    tier1Classification: 'needs_research',
    tier2Classification: 'burdensome',
    tier3Classification: null,
    finalSeverity: 7,
    federalMandateFound: false,
    isJustified: false,
    tier2RerunCount: 0,
    createdAt: new Date('2024-01-15'),
    easyCleanupCandidate: false,
    cleanupType: null,
    cleanupEffort: null,
    tier3TriggerReason: null,
    docTitle: 'Some Regulation',
    docShortTitle: 'SR',
    docNjacTitle: null,
    docNjacChapter: null,
    docNjacSubchapter: null,
    docNycrrTitle: null,
    docNycrrPart: null,
    docNycrrSection: null,
    reviewSummary: null,
  };

  it('maps basic fields correctly', () => {
    const result = mapAnalysisListRow(baseRow);
    expect(result.documentId).toBe(123);
    expect(result.issueType).toBe('newspaper');
    expect(result.highestTierCompleted).toBe(2);
    expect(result.finalSeverity).toBe(7);
    expect(result.federalMandateFound).toBe(false);
    expect(result.isJustified).toBe(false);
    expect(result.rerunCount).toBe(0);
  });

  it('uses shortTitle over title when available', () => {
    const result = mapAnalysisListRow(baseRow);
    expect(result.documentTitle).toBe('SR');
  });

  it('falls back to title when shortTitle is null', () => {
    const result = mapAnalysisListRow({ ...baseRow, docShortTitle: null });
    expect(result.documentTitle).toBe('Some Regulation');
  });

  it('builds NJAC citation correctly', () => {
    const row = {
      ...baseRow,
      docNjacTitle: '7',
      docNjacChapter: '14A',
      docNjacSubchapter: '2',
    };
    const result = mapAnalysisListRow(row);
    expect(result.citation).toBe('N.J.A.C. 7:14A-2');
  });

  it('builds NJAC citation without subchapter', () => {
    const row = {
      ...baseRow,
      docNjacTitle: '7',
      docNjacChapter: '14A',
      docNjacSubchapter: null,
    };
    const result = mapAnalysisListRow(row);
    expect(result.citation).toBe('N.J.A.C. 7:14A');
  });

  it('builds NYCRR citation correctly', () => {
    const row = {
      ...baseRow,
      docNycrrTitle: 12,
      docNycrrPart: '500',
      docNycrrSection: '3',
    };
    const result = mapAnalysisListRow(row);
    expect(result.citation).toBe('12 NYCRR 500.3');
  });

  it('builds NYCRR citation without section', () => {
    const row = {
      ...baseRow,
      docNycrrTitle: 12,
      docNycrrPart: '500',
      docNycrrSection: null,
    };
    const result = mapAnalysisListRow(row);
    expect(result.citation).toBe('12 NYCRR 500');
  });

  it('returns null citation when no NJAC or NYCRR fields', () => {
    const result = mapAnalysisListRow(baseRow);
    expect(result.citation).toBeNull();
  });

  it('defaults federalMandateFound to false when null', () => {
    const result = mapAnalysisListRow({ ...baseRow, federalMandateFound: null });
    expect(result.federalMandateFound).toBe(false);
  });

  it('defaults isJustified to false when null', () => {
    const result = mapAnalysisListRow({ ...baseRow, isJustified: null });
    expect(result.isJustified).toBe(false);
  });

  it('defaults highestTierCompleted to 0 when null', () => {
    const result = mapAnalysisListRow({ ...baseRow, highestTierCompleted: null });
    expect(result.highestTierCompleted).toBe(0);
  });

  it('defaults tier2RerunCount to 0 when null', () => {
    const result = mapAnalysisListRow({ ...baseRow, tier2RerunCount: null });
    expect(result.rerunCount).toBe(0);
  });

  it('defaults easyCleanupCandidate to false when null', () => {
    const result = mapAnalysisListRow({ ...baseRow, easyCleanupCandidate: null });
    expect(result.easyCleanupCandidate).toBe(false);
  });

  it('converts documentId to number', () => {
    // Database may return bigint as string
    const result = mapAnalysisListRow({ ...baseRow, documentId: '456' });
    expect(result.documentId).toBe(456);
    expect(typeof result.documentId).toBe('number');
  });

  it('preserves easy cleanup fields', () => {
    const row = {
      ...baseRow,
      easyCleanupCandidate: true,
      cleanupType: 'redundant_requirement',
      cleanupEffort: 'trivial',
    };
    const result = mapAnalysisListRow(row);
    expect(result.easyCleanupCandidate).toBe(true);
    expect(result.cleanupType).toBe('redundant_requirement');
    expect(result.cleanupEffort).toBe('trivial');
  });

  it('preserves tier3TriggerReason', () => {
    const row = { ...baseRow, tier3TriggerReason: 'high_risk_issue' };
    const result = mapAnalysisListRow(row);
    expect(result.tier3TriggerReason).toBe('high_risk_issue');
  });
});
