import { describe, it, expect } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { buildBurdenFilterFragments } from './jenai.repository';

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
    paramIdx++;
    return `$${paramIdx}`;
  }

  return chunks.map(flatten).join('');
}

describe('buildBurdenFilterFragments', () => {
  it('returns empty fragments when no options are set', () => {
    const { sourceFilter, severityFilter, categoryFilter, partsFilter, sectionTypesFilter, searchFilter } =
      buildBurdenFilterFragments({});

    expect(toQueryString(sourceFilter)).toBe('');
    expect(toQueryString(severityFilter)).toBe('');
    expect(toQueryString(categoryFilter)).toBe('');
    expect(toQueryString(partsFilter)).toBe('');
    expect(toQueryString(sectionTypesFilter)).toBe('');
    expect(toQueryString(searchFilter)).toBe('');
  });

  it('returns empty fragments for source=all', () => {
    const { sourceFilter } = buildBurdenFilterFragments({ source: 'all' });
    expect(toQueryString(sourceFilter)).toBe('');
  });

  it('produces document_id IS NOT NULL for source=regulation', () => {
    const { sourceFilter } = buildBurdenFilterFragments({ source: 'regulation' });
    const qs = toQueryString(sourceFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('ja.document_id IS NOT NULL');
  });

  it('produces guidance_document_id IS NOT NULL for source=guidance', () => {
    const { sourceFilter } = buildBurdenFilterFragments({ source: 'guidance' });
    const qs = toQueryString(sourceFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('ja.guidance_document_id IS NOT NULL');
  });

  // Legacy minSeverity tests
  it('produces severity >= $N for minSeverity', () => {
    const { severityFilter } = buildBurdenFilterFragments({ minSeverity: 4 });
    const qs = toQueryString(severityFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('ja.max_severity >= $1');
  });

  it('returns empty severity fragment when minSeverity is 0', () => {
    const { severityFilter } = buildBurdenFilterFragments({ minSeverity: 0 });
    expect(toQueryString(severityFilter)).toBe('');
  });

  // Multi-value severities tests
  it('produces OR conditions for multi-value severities', () => {
    const { severityFilter } = buildBurdenFilterFragments({ severities: ['high', 'medium'] });
    const qs = toQueryString(severityFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('ja.max_severity >= 7');
    expect(qs).toContain('ja.max_severity >= 4 AND ja.max_severity < 7');
    expect(qs).toContain(' OR ');
  });

  it('produces single condition for single severity value', () => {
    const { severityFilter } = buildBurdenFilterFragments({ severities: ['low'] });
    const qs = toQueryString(severityFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('ja.max_severity < 4');
    expect(qs).not.toContain(' OR ');
  });

  it('returns empty severity fragment for empty severities array', () => {
    const { severityFilter } = buildBurdenFilterFragments({ severities: [] });
    expect(toQueryString(severityFilter)).toBe('');
  });

  it('severities takes precedence over minSeverity', () => {
    const { severityFilter } = buildBurdenFilterFragments({ severities: ['high'], minSeverity: 4 });
    const qs = toQueryString(severityFilter);
    expect(qs).toContain('ja.max_severity >= 7');
    expect(qs).not.toContain('$1'); // no parameterized minSeverity
  });

  // Legacy category test
  it('produces EXISTS with string_to_array for category filter', () => {
    const { categoryFilter } = buildBurdenFilterFragments({ category: 'ADMINISTRATIVE_BURDENS' });
    const qs = toQueryString(categoryFilter);
    expect(qs).toContain('AND EXISTS');
    expect(qs).toContain('jenai_issues');
    expect(qs).toContain('ja.id');
    expect(qs).toContain('string_to_array');
    expect(qs).toContain('ANY');
  });

  // Multi-value categories tests
  it('produces EXISTS with ARRAY[]::text[] for multi-value categories', () => {
    const { categoryFilter } = buildBurdenFilterFragments({ categories: ['ADMINISTRATIVE_BURDENS', 'UNFUNDED_MANDATE'] });
    const qs = toQueryString(categoryFilter);
    expect(qs).toContain('AND EXISTS');
    expect(qs).toContain('jenai_issues');
    expect(qs).toContain('ARRAY[');
    expect(qs).toContain('::text[]');
    expect(qs).toContain('ANY');
  });

  it('returns empty category fragment for empty categories array', () => {
    const { categoryFilter } = buildBurdenFilterFragments({ categories: [] });
    expect(toQueryString(categoryFilter)).toBe('');
  });

  it('categories takes precedence over category', () => {
    const { categoryFilter } = buildBurdenFilterFragments({
      categories: ['ADMINISTRATIVE_BURDENS'],
      category: 'UNFUNDED_MANDATE',
    });
    const qs = toQueryString(categoryFilter);
    expect(qs).toContain('ARRAY[');
    expect(qs).not.toContain('string_to_array');
  });

  // Parts filter tests
  it('produces nycrr_part filter for NY jurisdiction', () => {
    const { partsFilter } = buildBurdenFilterFragments({ parts: ['418', '413'] }, 'NY');
    const qs = toQueryString(partsFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('rd.nycrr_part');
    expect(qs).toContain('ANY');
    expect(qs).toContain('ARRAY[');
    expect(qs).toContain('::text[]');
  });

  it('produces njac_part filter for NJ jurisdiction', () => {
    const { partsFilter } = buildBurdenFilterFragments({ parts: ['3A'] }, 'NJ');
    const qs = toQueryString(partsFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('rd.njac_part');
    expect(qs).toContain('ANY');
  });

  it('defaults to nycrr_part when no jurisdiction provided', () => {
    const { partsFilter } = buildBurdenFilterFragments({ parts: ['418'] });
    const qs = toQueryString(partsFilter);
    expect(qs).toContain('rd.nycrr_part');
  });

  it('returns empty parts fragment for empty parts array', () => {
    const { partsFilter } = buildBurdenFilterFragments({ parts: [] });
    expect(toQueryString(partsFilter)).toBe('');
  });

  // Section types filter tests
  it('produces section_type filter for sectionTypes', () => {
    const { sectionTypesFilter } = buildBurdenFilterFragments({ sectionTypes: ['requirements', 'procedures'] });
    const qs = toQueryString(sectionTypesFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('rd.section_type');
    expect(qs).toContain('ANY');
    expect(qs).toContain('ARRAY[');
    expect(qs).toContain('::text[]');
  });

  it('returns empty sectionTypes fragment for empty array', () => {
    const { sectionTypesFilter } = buildBurdenFilterFragments({ sectionTypes: [] });
    expect(toQueryString(sectionTypesFilter)).toBe('');
  });

  // Search filter
  it('produces ILIKE on both rd.title and gd.title for search filter', () => {
    const { searchFilter } = buildBurdenFilterFragments({ search: 'daycare' });
    const qs = toQueryString(searchFilter);
    expect(qs).toContain('AND');
    expect(qs).toContain('rd.title ILIKE');
    expect(qs).toContain('gd.title ILIKE');
  });

  // Regression tests
  it('all fragments reference ja. alias (regression: not ja2.)', () => {
    const all = buildBurdenFilterFragments({
      source: 'regulation',
      severities: ['high'],
      categories: ['CASCADE_OF_RIGIDITY'],
      parts: ['418'],
      sectionTypes: ['requirements'],
      search: 'test',
    }, 'NY');

    for (const [, fragment] of Object.entries(all)) {
      const qs = toQueryString(fragment);
      expect(qs).not.toContain('ja2.');
    }
  });

  it('no whitespace errors between params and keywords', () => {
    const all = buildBurdenFilterFragments({
      source: 'guidance',
      severities: ['medium', 'low'],
      categories: ['UNFUNDED_MANDATE'],
      search: 'child care',
    });

    for (const [, fragment] of Object.entries(all)) {
      const qs = toQueryString(fragment);
      expect(qs).not.toMatch(/\$\d+AND/i);
      expect(qs).not.toMatch(/\$\d+OR/i);
    }
  });

  it('combined new + old filters produce valid fragments', () => {
    const all = buildBurdenFilterFragments({
      source: 'regulation',
      severities: ['high', 'medium'],
      categories: ['ADMINISTRATIVE_BURDENS', 'REGULATORY_COMPLEXITY'],
      parts: ['418', '413'],
      sectionTypes: ['requirements', 'procedures'],
      search: 'child',
    }, 'NY');

    // All fragments should be non-empty
    for (const [key, fragment] of Object.entries(all)) {
      const qs = toQueryString(fragment);
      expect(qs.length).toBeGreaterThan(0);
      expect(qs).toContain('AND');
    }
  });
});
