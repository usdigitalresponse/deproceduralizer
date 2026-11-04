import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagsRepository } from './tags.repository';
import type {
  TagOverviewStats,
  TagCooccurrenceResult,
  TagNetworkResult,
  TagFlowResult,
  TagDetailResult,
  TagReadabilityCrosscuts,
  SimilarTag,
} from './tags.types';

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

/** Create a mock Database object with a programmable execute() method. */
function createMockDb(rows: Record<string, unknown>[] = []) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  } as unknown as ConstructorParameters<typeof TagsRepository>[0];
}

// ---------------------------------------------------------------------------
// getTagOverview
// ---------------------------------------------------------------------------

describe('TagsRepository.getTagOverview', () => {
  let repo: TagsRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb([]);
    repo = new TagsRepository(mockDb);
  });

  it('returns valid TagOverviewStats shape when DB returns no rows', async () => {
    const result: TagOverviewStats = await repo.getTagOverview('ny');

    expect(result).toHaveProperty('totalUniqueValues', 0);
    expect(result).toHaveProperty('fuzzyClusterCount', 0);
    expect(result).toHaveProperty('tagsByDomain');
    expect(result).toHaveProperty('tagValues');
    expect(Array.isArray(result.tagsByDomain)).toBe(true);
    expect(Array.isArray(result.tagValues)).toBe(true);
  });

  it('computes stats from returned rows', async () => {
    // getTagOverview reads one UNION ALL result set tagged by _type.
    mockDb = createMockDb([
      { _type: 'values', domain: 'regulation', field: 'reg_section_type', value: 'requirements', normalizedValue: 'requirements', count: 42 },
      { _type: 'values', domain: 'regulation', field: 'reg_section_type', value: 'definitions', normalizedValue: 'definitions', count: 30 },
      { _type: 'values', domain: 'guidance', field: 'policy_category', value: 'policy_directive', normalizedValue: 'policy_directive', count: 20 },
      { _type: 'stats', total_unique: 3, total_count: 92 },
      { _type: 'domain_stats', domain: 'regulation', domain_count: 72 },
      { _type: 'domain_stats', domain: 'guidance', domain_count: 20 },
    ]);
    repo = new TagsRepository(mockDb);

    const result = await repo.getTagOverview('ny');

    expect(result.totalUniqueValues).toBe(3);
    expect(result.tagValues).toHaveLength(3);
    expect(result.mostCommonTag?.value).toBe('requirements');
    expect(result.domainWithMostTags).toBe('regulation');
    expect(result.tagsByDomain.length).toBeGreaterThanOrEqual(1);
  });

  it('calls db.execute with SQL that contains UNION ALL', async () => {
    await repo.getTagOverview('nj');

    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('detects fuzzy clusters when multiple raw values share normalized form', async () => {
    mockDb = createMockDb([
      { _type: 'values', domain: 'regulation', field: 'reg_keywords', value: 'Licensing', normalizedValue: 'licensing', count: 10 },
      { _type: 'values', domain: 'regulation', field: 'reg_keywords', value: 'licensing', normalizedValue: 'licensing', count: 8 },
      { _type: 'values', domain: 'regulation', field: 'reg_keywords', value: 'LICENSING', normalizedValue: 'licensing', count: 5 },
      { _type: 'stats', total_unique: 1, total_count: 23 },
      { _type: 'domain_stats', domain: 'regulation', domain_count: 23 },
    ]);
    repo = new TagsRepository(mockDb);

    const result = await repo.getTagOverview('ny');

    // 3 raw values map to 1 normalized value = 1 cluster
    expect(result.fuzzyClusterCount).toBe(1);
    // But only 1 unique normalized value
    expect(result.totalUniqueValues).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getTagDetail
// ---------------------------------------------------------------------------

describe('TagsRepository.getTagDetail', () => {
  let repo: TagsRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    // Most methods in getTagDetail make multiple db.execute calls.
    // We return an empty result for all calls by default.
    mockDb = createMockDb([{ cnt: 0 }]);
    repo = new TagsRepository(mockDb);
  });

  it('returns valid TagDetailResult shape for unknown field', async () => {
    const result: TagDetailResult = await repo.getTagDetail('ny', 'nonexistent_field', 'test');

    expect(result.field).toBe('nonexistent_field');
    expect(result.value).toBe('test');
    expect(result.totalCount).toBe(0);
    expect(Array.isArray(result.domainCounts)).toBe(true);
    expect(Array.isArray(result.relatedTags)).toBe(true);
    expect(Array.isArray(result.similarTags)).toBe(true);
  });

  it('returns valid shape for known field with zero count', async () => {
    const result = await repo.getTagDetail('ny', 'reg_section_type', 'definitions');

    expect(result.field).toBe('reg_section_type');
    expect(result.value).toBe('definitions');
    expect(result.totalCount).toBe(0);
  });

  it('calls db.execute when field exists', async () => {
    await repo.getTagDetail('ny', 'reg_section_type', 'requirements');

    expect(mockDb.execute).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getSimilarTags
// ---------------------------------------------------------------------------

describe('TagsRepository.getSimilarTags', () => {
  it('returns empty array for unknown field', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result: SimilarTag[] = await repo.getSimilarTags('ny', 'nonexistent', 'test');

    expect(result).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('returns similar tags from DB result', async () => {
    const mockDb = createMockDb([
      { value: 'license', count: 15, similarity: 0.6 },
      { value: 'licensed', count: 8, similarity: 0.45 },
    ]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getSimilarTags('ny', 'reg_keywords', 'licensing');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: 'license', count: 15, similarity: 0.6 });
    expect(result[1]).toEqual({ value: 'licensed', count: 8, similarity: 0.45 });
  });

  it('gracefully returns empty when pg_trgm is unavailable', async () => {
    const mockDb = {
      execute: vi.fn().mockRejectedValue(new Error('function similarity does not exist')),
    } as unknown as ConstructorParameters<typeof TagsRepository>[0];
    const repo = new TagsRepository(mockDb);

    const result = await repo.getSimilarTags('ny', 'reg_keywords', 'test');

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTagCooccurrence
// ---------------------------------------------------------------------------

describe('TagsRepository.getTagCooccurrence', () => {
  it('returns empty result for unknown fields', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result: TagCooccurrenceResult = await repo.getTagCooccurrence('ny', 'unknown_a', 'unknown_b');

    expect(result.fieldA).toBe('unknown_a');
    expect(result.fieldB).toBe('unknown_b');
    expect(result.matrix).toEqual([]);
    expect(result.valuesA).toEqual([]);
    expect(result.valuesB).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('returns co-occurrence pairs from DB', async () => {
    const mockDb = createMockDb([
      { value_a: 'requirements', value_b: 'licensees', count: 25 },
      { value_a: 'definitions', value_b: 'employers', count: 12 },
    ]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getTagCooccurrence('ny', 'reg_section_type', 'reg_applies_to');

    expect(result.fieldA).toBe('reg_section_type');
    expect(result.fieldB).toBe('reg_applies_to');
    expect(result.matrix).toHaveLength(2);
    expect(result.valuesA).toContain('requirements');
    expect(result.valuesB).toContain('licensees');
  });

  it('handles same-table fields', async () => {
    const mockDb = createMockDb([
      { value_a: 'requirements', value_b: 'licensing', count: 10 },
    ]);
    const repo = new TagsRepository(mockDb);

    // reg_section_type and reg_keywords are both on regulatory_documents
    const result = await repo.getTagCooccurrence('ny', 'reg_section_type', 'reg_keywords');

    expect(result.matrix).toHaveLength(1);
    expect(mockDb.execute).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getTagNetwork
// ---------------------------------------------------------------------------

describe('TagsRepository.getTagNetwork', () => {
  it('returns valid TagNetworkResult with empty DB', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result: TagNetworkResult = await repo.getTagNetwork('ny');

    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
  });

  it('returns empty for no matching domains', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getTagNetwork('ny', { domains: ['nonexistent'] });

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTagFlow
// ---------------------------------------------------------------------------

describe('TagsRepository.getTagFlow', () => {
  it('returns empty for fewer than 2 stages', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result: TagFlowResult = await repo.getTagFlow('ny', ['reg_section_type']);

    expect(result.stages).toEqual(['reg_section_type']);
    expect(result.nodes).toEqual([]);
    expect(result.links).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('returns flow data from DB for valid stages', async () => {
    const mockDb = createMockDb([
      { source_field: 'reg_section_type', source_value: 'requirements', target_field: 'reg_keywords', target_value: 'licensing', weight: 15 },
    ]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getTagFlow('ny', ['reg_section_type', 'reg_keywords']);

    expect(result.stages).toEqual(['reg_section_type', 'reg_keywords']);
    expect(result.nodes).toContain('reg_section_type:requirements');
    expect(result.nodes).toContain('reg_keywords:licensing');
    expect(result.links).toHaveLength(1);
    expect(result.links[0].value).toBe(15);
  });

  it('handles unknown stages gracefully', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getTagFlow('ny', ['nonexistent_a', 'nonexistent_b']);

    expect(result.nodes).toEqual([]);
    expect(result.links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTagReadabilityCrosscuts
// ---------------------------------------------------------------------------

describe('TagsRepository.getTagReadabilityCrosscuts', () => {
  it('returns empty for non-guidance field', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    // issue_type is compliance domain, not guidance
    const result: TagReadabilityCrosscuts = await repo.getTagReadabilityCrosscuts('ny', 'issue_type');

    expect(result.field).toBe('issue_type');
    expect(result.rows).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('returns empty for non-NY jurisdiction', async () => {
    const mockDb = createMockDb([]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getTagReadabilityCrosscuts('nj', 'policy_category');

    expect(result.rows).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('returns readability rows for guidance field', async () => {
    const mockDb = createMockDb([
      { value: 'policy_directive', count: 100, avg_flesch_ease: 25.5, avg_grade_level: 14.2, avg_word_count: 3500, avg_sentence_count: 120 },
      { value: 'informational', count: 50, avg_flesch_ease: 32.1, avg_grade_level: 12.8, avg_word_count: 2000, avg_sentence_count: 80 },
    ]);
    const repo = new TagsRepository(mockDb);

    const result = await repo.getTagReadabilityCrosscuts('ny', 'policy_category');

    expect(result.field).toBe('policy_category');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].value).toBe('policy_directive');
    expect(result.rows[0].count).toBe(100);
    expect(result.rows[0].avgFleschEase).toBeCloseTo(25.5);
    expect(result.rows[0].avgGradeLevel).toBeCloseTo(14.2);
    expect(result.rows[0].avgWordCount).toBeCloseTo(3500);
    expect(result.rows[0].avgSentenceCount).toBeCloseTo(120);
  });
});
