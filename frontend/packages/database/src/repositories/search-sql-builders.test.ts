import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  sqlTextArray,
  buildSeverityCondition,
  buildComplianceExists,
  buildJenaiExists,
  buildIssueFilter,
} from './search.repository';
import {
  shouldExcludeStatutes,
  shouldExcludeRegulations,
  shouldExcludeGuidance,
  shouldSkipAnalyses,
} from './search-filters';

/**
 * Flatten a Drizzle SQL object into a single string with $N placeholders,
 * mimicking what the database driver sees.
 */
function toQueryString(fragment: SQL): string {
  let paramIdx = 0;
  const chunks: unknown[] = (fragment as unknown as { queryChunks: unknown[] }).queryChunks;

  function flatten(item: unknown): string {
    if (item == null) return '';
    if (typeof item === 'object' && 'queryChunks' in (item as Record<string, unknown>)) {
      return ((item as { queryChunks: unknown[] }).queryChunks).map(flatten).join('');
    }
    if (typeof item === 'object' && 'value' in (item as Record<string, unknown>)) {
      return ((item as { value: unknown[] }).value).join('');
    }
    // It's a parameter value
    paramIdx++;
    return `$${paramIdx}`;
  }

  return chunks.map(flatten).join('');
}

// ============================================
// sqlTextArray
// ============================================

describe('sqlTextArray', () => {
  it('produces ARRAY[...]::text[] for a single value', () => {
    const result = toQueryString(sqlTextArray(['bulletin_board']));
    expect(result).toContain('ARRAY[');
    expect(result).toContain('$1');
    expect(result).toContain(']::text[]');
  });

  it('produces comma-separated params for multiple values', () => {
    const result = toQueryString(sqlTextArray(['a', 'b', 'c']));
    expect(result).toContain('$1');
    expect(result).toContain('$2');
    expect(result).toContain('$3');
    expect(result).toMatch(/ARRAY\[.*\]::text\[\]/);
  });
});

// ============================================
// buildSeverityCondition
// ============================================

describe('buildSeverityCondition', () => {
  it('returns empty SQL for empty array', () => {
    const result = toQueryString(buildSeverityCondition([], 'cia'));
    expect(result).toBe('');
  });

  it('produces AND clause for high severity', () => {
    const result = toQueryString(buildSeverityCondition(['high'], 'cia'));
    expect(result).toContain('AND');
    expect(result).toContain('cia.severity >= 7');
  });

  it('combines multiple severities with OR', () => {
    const result = toQueryString(buildSeverityCondition(['high', 'low'], 'tbl'));
    expect(result).toContain('tbl.severity >= 7');
    expect(result).toContain('tbl.severity >= 1');
    expect(result).toContain('OR');
  });
});

// ============================================
// buildComplianceExists — whitespace regression
// ============================================

describe('buildComplianceExists', () => {
  it('produces valid SQL with classification only', () => {
    const result = toQueryString(buildComplianceExists('rd.id', 'burdensome'));
    expect(result).toContain('EXISTS');
    expect(result).toContain('tier2_classification');
    // No "$NAN" or missing whitespace
    expect(result).not.toMatch(/\$\d+AND/);
  });

  it('produces valid SQL with classification + issueTypes (whitespace regression)', () => {
    const result = toQueryString(buildComplianceExists('rd.id', 'burdensome', ['bulletin_board']));
    expect(result).toContain('tier2_classification');
    expect(result).toContain('issue_type');
    expect(result).toContain('ARRAY[');
    // The key regression: no "$Nkeyword" without a space
    expect(result).not.toMatch(/\$\d+AND/i);
  });

  it('produces valid SQL with all sub-filters combined', () => {
    const result = toQueryString(buildComplianceExists('rd.id', 'burdensome', ['in_person_pickup'], ['high']));
    expect(result).toContain('tier2_classification');
    expect(result).toContain('issue_type');
    expect(result).toContain('severity >= 7');
    expect(result).not.toMatch(/\$\d+AND/i);
  });

  it('uses guidance_document_id when isGuidance is true', () => {
    const result = toQueryString(buildComplianceExists('gd.id', null, null, null, true));
    expect(result).toContain('guidance_document_id');
  });

  it('uses document_id when isGuidance is false', () => {
    const result = toQueryString(buildComplianceExists('rd.id'));
    expect(result).toContain('cia_f.document_id');
    expect(result).not.toContain('guidance_document_id');
  });
});

// ============================================
// buildJenaiExists — whitespace + array regression
// ============================================

describe('buildJenaiExists', () => {
  it('produces valid SQL with categories', () => {
    const result = toQueryString(buildJenaiExists('rd.id', ['FROZEN_TECHNOLOGY']));
    expect(result).toContain('ARRAY[');
    expect(result).toContain('category');
    expect(result).not.toMatch(/\$\d+AND/i);
  });

  it('produces valid SQL with categories + severity', () => {
    const result = toQueryString(buildJenaiExists('rd.id', ['FROZEN_TECHNOLOGY'], ['high', 'medium']));
    expect(result).toContain('category');
    expect(result).toContain('severity');
    expect(result).not.toMatch(/\$\d+AND/i);
  });
});

// ============================================
// buildIssueFilter
// ============================================

describe('buildIssueFilter', () => {
  it('returns empty SQL when issueSystem is null', () => {
    const result = toQueryString(buildIssueFilter('rd.id', null));
    expect(result).toBe('');
  });

  it('returns compliance EXISTS for compliance system', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'compliance', 'burdensome', ['in_person_pickup']));
    expect(result).toContain('AND');
    expect(result).toContain('compliance_issue_analyses');
    expect(result).toContain('issue_type');
    expect(result).not.toMatch(/\$\d+AND/i);
  });

  it('returns jenai EXISTS for jenai system', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'jenai', null, null, ['FROZEN_TECHNOLOGY']));
    expect(result).toContain('jenai_issues');
    expect(result).toContain('category');
  });

  it('returns OR for any system', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'any'));
    expect(result).toContain('compliance_issue_analyses');
    expect(result).toContain('jenai_issues');
    expect(result).toContain('OR');
  });

  it('returns NOT for none system', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'none'));
    expect(result).toContain('NOT');
    expect(result).toContain('compliance_issue_analyses');
    expect(result).toContain('jenai_issues');
  });

  it('returns empty SQL for unknown system', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'unknown'));
    expect(result).toBe('');
  });

  it('compliance system does NOT reference jenai_issues', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'compliance', 'burdensome', ['in_person_pickup'], null, ['high']));
    expect(result).toContain('compliance_issue_analyses');
    expect(result).not.toContain('jenai_issues');
  });

  it('jenai system does NOT reference compliance_issue_analyses', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'jenai', null, null, ['FROZEN_TECHNOLOGY']));
    expect(result).toContain('jenai_issues');
    expect(result).not.toContain('compliance_issue_analyses');
  });

  it('none system negates both tables', () => {
    const result = toQueryString(buildIssueFilter('rd.id', 'none'));
    expect(result).toContain('NOT');
    expect(result).toContain('compliance_issue_analyses');
    expect(result).toContain('jenai_issues');
    // Should be AND NOT (both absent), not OR
    expect(result).toContain('AND');
  });

  it('compliance + all sub-filters produces no whitespace errors', () => {
    const result = toQueryString(
      buildIssueFilter('rd.id', 'compliance', 'burdensome', ['mail_only', 'in_person_pickup'], null, ['high', 'medium']),
    );
    expect(result).not.toMatch(/\$\d+AND/i);
    expect(result).not.toMatch(/\$\d+OR/i);
    expect(result).toContain('ARRAY[');
    expect(result).toContain('severity');
  });
});

// ============================================
// search-filters — doc type gating
// ============================================

describe('shouldExcludeStatutes', () => {
  it('excludes statutes when issueSystem is set', () => {
    expect(shouldExcludeStatutes({ issueSystem: 'compliance' })).toBe(true);
    expect(shouldExcludeStatutes({ issueSystem: 'jenai' })).toBe(true);
    expect(shouldExcludeStatutes({ issueSystem: 'any' })).toBe(true);
    expect(shouldExcludeStatutes({ issueSystem: 'none' })).toBe(true);
  });

  it('includes statutes when no issue filter is active', () => {
    expect(shouldExcludeStatutes({})).toBe(false);
    expect(shouldExcludeStatutes({ issueSystem: null })).toBe(false);
  });

  it('excludes statutes when docType is regulation or guidance', () => {
    expect(shouldExcludeStatutes({ docType: 'regulation' })).toBe(true);
    expect(shouldExcludeStatutes({ docType: 'guidance' })).toBe(true);
  });
});

describe('shouldExcludeRegulations', () => {
  it('excludes regulations when docType is statute or guidance', () => {
    expect(shouldExcludeRegulations({ docType: 'statute' })).toBe(true);
    expect(shouldExcludeRegulations({ docType: 'guidance' })).toBe(true);
  });

  it('includes regulations by default', () => {
    expect(shouldExcludeRegulations({})).toBe(false);
  });
});

describe('shouldExcludeGuidance', () => {
  it('excludes guidance when docType is regulation or statute', () => {
    expect(shouldExcludeGuidance({ docType: 'regulation' })).toBe(true);
    expect(shouldExcludeGuidance({ docType: 'statute' })).toBe(true);
  });

  it('excludes guidance when hierarchyLevel is set', () => {
    expect(shouldExcludeGuidance({ hierarchyLevel: 'chapter' })).toBe(true);
  });
});

describe('shouldSkipAnalyses', () => {
  it('skips analyses for none and jenai', () => {
    expect(shouldSkipAnalyses('none')).toBe(true);
    expect(shouldSkipAnalyses('jenai')).toBe(true);
  });

  it('does not skip for compliance, any, or null', () => {
    expect(shouldSkipAnalyses('compliance')).toBe(false);
    expect(shouldSkipAnalyses('any')).toBe(false);
    expect(shouldSkipAnalyses(null)).toBe(false);
    expect(shouldSkipAnalyses(undefined)).toBe(false);
  });
});
