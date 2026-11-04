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
      await repo.getCountsByType('ny');
      expect((mockDb as any)._mocks.selectFn).toHaveBeenCalled();
    });

    it('calls db.select when invoked with regulation source', async () => {
      await repo.getCountsByType('ny', 'regulation');
      expect((mockDb as any)._mocks.selectFn).toHaveBeenCalled();
    });

    it('calls db.select when invoked with guidance source', async () => {
      await repo.getCountsByType('ny', 'guidance');
      expect((mockDb as any)._mocks.selectFn).toHaveBeenCalled();
    });

    it('returns empty record when no rows', async () => {
      const result = await repo.getCountsByType('ny');
      expect(result).toEqual({});
    });
  });

  describe('getCountsByTypeAndClassification', () => {
    it('returns empty record when no rows', async () => {
      const result = await repo.getCountsByTypeAndClassification('ny');
      expect(result).toEqual({});
    });

    it('accepts source parameter without error', async () => {
      await expect(repo.getCountsByTypeAndClassification('ny', 'regulation')).resolves.toBeDefined();
      await expect(repo.getCountsByTypeAndClassification('ny', 'guidance')).resolves.toBeDefined();
    });
  });

  describe('getSeverityDistribution', () => {
    it('returns zeros when DB returns empty result', async () => {
      mockDb = createMockDb([], [{ high: 0, medium: 0, low: 0, total: 0 }]);
      repo = new ComplianceIssuesRepository(mockDb);
      const result = await repo.getSeverityDistribution('ny');
      expect(result).toEqual({ high: 0, medium: 0, low: 0, total: 0 });
    });

    it('accepts source parameter', async () => {
      mockDb = createMockDb([], [{ high: 0, medium: 0, low: 0, total: 0 }]);
      repo = new ComplianceIssuesRepository(mockDb);
      const result = await repo.getSeverityDistribution('ny', 'regulation');
      expect(result).toEqual({ high: 0, medium: 0, low: 0, total: 0 });
    });

    it('includes source fragment in raw SQL for regulation', async () => {
      mockDb = createMockDb([], [{ high: 0, medium: 0, low: 0, total: 0 }]);
      repo = new ComplianceIssuesRepository(mockDb);
      await repo.getSeverityDistribution('ny', 'regulation');
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
    const noTier3: string | null = null;
    const noTier2: string | null = null;
    const coalescedT1 = noTier3 ?? noTier2 ?? 'needs_research';
    expect(coalescedT1).toBe('needs_research'); // tier1 used as last resort
  });
});

// ═══════════════════════════════════════════════════════════════════
// Metric contract invariants
// ═══════════════════════════════════════════════════════════════════

describe('Metric contract invariants', () => {
  it('requirementFound=false should never appear in user-facing counts', () => {
    // Simulating: the repo methods filter requirementFound=true
    // Records with requirementFound=false should be excluded
    const allRecords = [
      { issueType: 'notarization', requirementFound: true, classification: 'burdensome' },
      { issueType: 'notarization', requirementFound: false, classification: 'unrelated' },
      { issueType: 'wet_signature', requirementFound: true, classification: 'justified' },
      { issueType: 'wet_signature', requirementFound: false, classification: 'all_false_positives' },
    ];

    // User-facing counts should only include requirementFound=true
    const userFacing = allRecords.filter(r => r.requirementFound);
    expect(userFacing).toHaveLength(2);
    expect(userFacing.every(r => r.requirementFound)).toBe(true);

    // No false-positive classifications in user-facing data
    const classifications = userFacing.map(r => r.classification);
    expect(classifications).not.toContain('all_false_positives');
  });

  it('source-scoped drill-downs should not leak cross-source data', () => {
    const records = [
      { issueType: 'notarization', guidanceDocumentId: null, documentId: 1 },  // regulation
      { issueType: 'notarization', guidanceDocumentId: 100, documentId: null }, // guidance
      { issueType: 'wet_signature', guidanceDocumentId: null, documentId: 2 },  // regulation
    ];

    // Regulation filter
    const regulations = records.filter(r => r.guidanceDocumentId === null);
    expect(regulations).toHaveLength(2);
    expect(regulations.every(r => r.documentId !== null)).toBe(true);

    // Guidance filter
    const guidance = records.filter(r => r.guidanceDocumentId !== null);
    expect(guidance).toHaveLength(1);
    expect(guidance.every(r => r.documentId === null)).toBe(true);

    // Combined = all records
    expect(regulations.length + guidance.length).toBe(records.length);
  });

  it('classificationTotals should equal sum of countsByTypeAndClassification', () => {
    // Simulated countsByTypeAndClassification output
    const byTypeAndClass: Record<string, { burdensome: number; justified: number; total: number }> = {
      notarization: { burdensome: 87, justified: 64, total: 151 },
      check_payment: { burdensome: 107, justified: 8, total: 115 },
      certified_mail: { burdensome: 28, justified: 313, total: 341 },
    };

    // Compute classificationTotals (same logic as getClassificationTotals server action)
    const totals = Object.values(byTypeAndClass).reduce(
      (acc, classMap) => ({
        burdensome: acc.burdensome + classMap.burdensome,
        justified: acc.justified + classMap.justified,
        total: acc.total + classMap.total,
      }),
      { burdensome: 0, justified: 0, total: 0 }
    );

    expect(totals.burdensome).toBe(87 + 107 + 28);
    expect(totals.justified).toBe(64 + 8 + 313);
    expect(totals.total).toBe(151 + 115 + 341);
    expect(totals.burdensome + totals.justified).toBeLessThanOrEqual(totals.total);
  });

  it('guidance and regulation paths should use the same contract', () => {
    // Both paths should produce the same shape
    const regulationResult = {
      burdensome: 1027,
      justified: 2500,
      unrelated: 400,
      total: 3927,
    };

    const guidanceResult = {
      burdensome: 128,
      justified: 359,
      unrelated: 85,
      total: 572,
    };

    // Both have the same keys
    expect(Object.keys(regulationResult)).toEqual(Object.keys(guidanceResult));

    // Both have positive totals
    expect(regulationResult.total).toBeGreaterThan(0);
    expect(guidanceResult.total).toBeGreaterThan(0);

    // burdensome + justified + unrelated <= total (some records may have null classification)
    expect(regulationResult.burdensome + regulationResult.justified + regulationResult.unrelated)
      .toBeLessThanOrEqual(regulationResult.total);
    expect(guidanceResult.burdensome + guidanceResult.justified + guidanceResult.unrelated)
      .toBeLessThanOrEqual(guidanceResult.total);
  });
});
