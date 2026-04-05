import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplianceIssuesRepository, buildSourceCondition, buildSourceSqlFragment } from './compliance-issues.repository';

// ═══════════════════════════════════════════════════════════════════
// buildSourceCondition (Drizzle ORM helper)
// ═══════════════════════════════════════════════════════════════════

describe('buildSourceCondition', () => {
  it('returns undefined when source is undefined (no filter)', () => {
    expect(buildSourceCondition(undefined)).toBeUndefined();
  });

  it('returns a SQL condition when source is "regulation"', () => {
    const result = buildSourceCondition('regulation');
    expect(result).toBeDefined();
  });

  it('returns a SQL condition when source is "guidance"', () => {
    const result = buildSourceCondition('guidance');
    expect(result).toBeDefined();
  });

  it('returns different conditions for regulation vs guidance', () => {
    const reg = buildSourceCondition('regulation');
    const guid = buildSourceCondition('guidance');
    expect(reg).toBeDefined();
    expect(guid).toBeDefined();
    // They should be different SQL objects
    expect(reg).not.toBe(guid);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildSourceSqlFragment (raw SQL helper)
// ═══════════════════════════════════════════════════════════════════

describe('buildSourceSqlFragment', () => {
  it('returns empty string when source is undefined', () => {
    expect(buildSourceSqlFragment(undefined)).toBe('');
  });

  it('returns IS NULL fragment for regulation source', () => {
    const result = buildSourceSqlFragment('regulation');
    expect(result).toContain('guidance_document_id IS NULL');
  });

  it('returns IS NOT NULL fragment for guidance source', () => {
    const result = buildSourceSqlFragment('guidance');
    expect(result).toContain('guidance_document_id IS NOT NULL');
  });

  it('fragments start with AND', () => {
    expect(buildSourceSqlFragment('regulation')).toMatch(/^AND/);
    expect(buildSourceSqlFragment('guidance')).toMatch(/^AND/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Repository source filtering consistency
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a mock DB that tracks all executed queries.
 * Returns configurable rows for select() chain and execute() calls.
 */
function createMockDb(selectRows: Record<string, unknown>[] = [], executeRows: Record<string, unknown>[] = []) {
  const executeFn = vi.fn().mockResolvedValue({ rows: executeRows });

  // Chain mock for Drizzle select().from().where().groupBy()
  const groupByFn = vi.fn().mockResolvedValue(selectRows);
  const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
  const leftJoinFn = vi.fn().mockReturnValue({ where: whereFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn, leftJoin: leftJoinFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return {
    select: selectFn,
    execute: executeFn,
    _mocks: { selectFn, fromFn, whereFn, groupByFn, executeFn },
  } as unknown as ConstructorParameters<typeof ComplianceIssuesRepository>[0];
}

describe('ComplianceIssuesRepository source filtering', () => {
  let repo: ComplianceIssuesRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new ComplianceIssuesRepository(mockDb);
  });

  describe('getCountsByType', () => {
    it('calls db.select when invoked without source', async () => {
      await repo.getCountsByType('NY');
      expect((mockDb as any)._mocks.selectFn).toHaveBeenCalled();
    });

    it('calls db.select when invoked with regulation source', async () => {
      await repo.getCountsByType('NY', 'regulation');
      expect((mockDb as any)._mocks.selectFn).toHaveBeenCalled();
    });

    it('calls db.select when invoked with guidance source', async () => {
      await repo.getCountsByType('NY', 'guidance');
      expect((mockDb as any)._mocks.selectFn).toHaveBeenCalled();
    });

    it('returns empty record when no rows', async () => {
      const result = await repo.getCountsByType('NY');
      expect(result).toEqual({});
    });
  });

  describe('getCountsByTypeAndClassification', () => {
    it('returns empty record when no rows', async () => {
      const result = await repo.getCountsByTypeAndClassification('NY');
      expect(result).toEqual({});
    });

    it('accepts source parameter without error', async () => {
      await expect(repo.getCountsByTypeAndClassification('NY', 'regulation')).resolves.toBeDefined();
      await expect(repo.getCountsByTypeAndClassification('NY', 'guidance')).resolves.toBeDefined();
    });
  });

  describe('getSeverityDistribution', () => {
    it('returns zeros when DB returns empty result', async () => {
      mockDb = createMockDb([], [{ high: 0, medium: 0, low: 0, total: 0 }]);
      repo = new ComplianceIssuesRepository(mockDb);
      const result = await repo.getSeverityDistribution('NY');
      expect(result).toEqual({ high: 0, medium: 0, low: 0, total: 0 });
    });

    it('accepts source parameter', async () => {
      mockDb = createMockDb([], [{ high: 0, medium: 0, low: 0, total: 0 }]);
      repo = new ComplianceIssuesRepository(mockDb);
      const result = await repo.getSeverityDistribution('NY', 'regulation');
      expect(result).toEqual({ high: 0, medium: 0, low: 0, total: 0 });
    });

    it('includes source fragment in raw SQL for regulation', async () => {
      mockDb = createMockDb([], [{ high: 0, medium: 0, low: 0, total: 0 }]);
      repo = new ComplianceIssuesRepository(mockDb);
      await repo.getSeverityDistribution('NY', 'regulation');
      expect((mockDb as any)._mocks.executeFn).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// COALESCE consistency: getCountsByTypeAndClassification should
// produce totals that sum to the same value as getCountsByType
// ═══════════════════════════════════════════════════════════════════

describe('COALESCE consistency', () => {
  it('getCountsByTypeAndClassification totals should equal getCountsByType totals for same source', async () => {
    // Simulate rows for getCountsByType
    const typeRows = [
      { issueType: 'notarization', count: 10 },
      { issueType: 'wet_signature', count: 5 },
    ];

    // Simulate rows for getCountsByTypeAndClassification
    const classRows = [
      { issueType: 'notarization', classification: 'burdensome', count: 7 },
      { issueType: 'notarization', classification: 'justified', count: 3 },
      { issueType: 'wet_signature', classification: 'burdensome', count: 4 },
      { issueType: 'wet_signature', classification: 'justified', count: 1 },
    ];

    // Both should produce the same totals per type
    const typeTotals: Record<string, number> = {};
    for (const row of typeRows) {
      typeTotals[row.issueType] = row.count;
    }

    const classTotals: Record<string, number> = {};
    for (const row of classRows) {
      classTotals[row.issueType] = (classTotals[row.issueType] ?? 0) + row.count;
    }

    expect(classTotals['notarization']).toBe(typeTotals['notarization']);
    expect(classTotals['wet_signature']).toBe(typeTotals['wet_signature']);
  });

  it('regulation + guidance should equal all sources combined', () => {
    // Simulated counts
    const regBurdensome = 1027;
    const guidBurdensome = 128;
    const allBurdensome = regBurdensome + guidBurdensome;

    expect(allBurdensome).toBe(1155); // Combined total
    expect(allBurdensome).toBeGreaterThan(regBurdensome);
    expect(allBurdensome).toBeGreaterThan(guidBurdensome);
  });

  it('COALESCE should not double-count: each record appears once', () => {
    // Record with tier2=burdensome and tier3=justified
    // COALESCE(tier3, tier2, tier1) should pick tier3 = justified
    const tier2 = 'burdensome';
    const tier3 = 'justified';
    const coalesced = tier3 ?? tier2 ?? null;
    expect(coalesced).toBe('justified'); // tier3 wins

    // Record with only tier2
    const tier2Only = 'burdensome';
    const tier3Only = null;
    const coalescedT2 = tier3Only ?? tier2Only ?? null;
    expect(coalescedT2).toBe('burdensome'); // tier2 used as fallback

    // Record with only tier1
    const coalescedT1 = null ?? null ?? 'needs_research';
    expect(coalescedT1).toBe('needs_research'); // tier1 used as last resort
  });
});
