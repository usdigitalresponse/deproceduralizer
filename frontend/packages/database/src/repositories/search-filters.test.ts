import { describe, it, expect } from 'vitest';
import { shouldExcludeStatutes, shouldExcludeRegulations, shouldExcludeGuidance, shouldSkipAnalyses } from './search-filters';

describe('shouldExcludeStatutes', () => {
  it('returns false when no filters are active', () => {
    expect(shouldExcludeStatutes({})).toBe(false);
  });

  it('returns true when docType is regulation', () => {
    expect(shouldExcludeStatutes({ docType: 'regulation' })).toBe(true);
  });

  it('returns false when docType is statute', () => {
    expect(shouldExcludeStatutes({ docType: 'statute' })).toBe(false);
  });

  it('returns true when docType is guidance', () => {
    expect(shouldExcludeStatutes({ docType: 'guidance' })).toBe(true);
  });

  it('returns true when sectionType is set', () => {
    expect(shouldExcludeStatutes({ sectionType: 'definitions' })).toBe(true);
  });

  it('returns true when hierarchyLevel is set', () => {
    expect(shouldExcludeStatutes({ hierarchyLevel: 'section' })).toBe(true);
  });

  it('returns true when issueSystem is set', () => {
    expect(shouldExcludeStatutes({ issueSystem: 'compliance' })).toBe(true);
  });

  it('returns false when issueSystem is null', () => {
    expect(shouldExcludeStatutes({ issueSystem: null })).toBe(false);
  });

  it('returns false when only classification is set (no issueSystem)', () => {
    expect(shouldExcludeStatutes({ classification: 'burdensome' })).toBe(false);
  });

  it('returns true when issueSystem and classification are set', () => {
    expect(shouldExcludeStatutes({ issueSystem: 'compliance', classification: 'burdensome' })).toBe(true);
  });

  it('returns true when sectionType is set with null docType (original bug scenario)', () => {
    expect(shouldExcludeStatutes({ docType: null, sectionType: 'requirements' })).toBe(true);
  });

  it('returns true when multiple regulation-specific filters are combined', () => {
    expect(shouldExcludeStatutes({
      sectionType: 'definitions',
      hierarchyLevel: 'section',
      classification: 'burdensome',
    })).toBe(true);
  });

  it('returns false when all filter values are null', () => {
    expect(shouldExcludeStatutes({
      docType: null,
      sectionType: null,
      hierarchyLevel: null,
      issueSystem: null,
      classification: null,
    })).toBe(false);
  });

  it('returns false when all filter values are undefined', () => {
    expect(shouldExcludeStatutes({
      docType: undefined,
      sectionType: undefined,
      hierarchyLevel: undefined,
      issueSystem: undefined,
      classification: undefined,
    })).toBe(false);
  });
});

describe('shouldExcludeRegulations', () => {
  it('returns false when docType is null', () => {
    expect(shouldExcludeRegulations({ docType: null })).toBe(false);
  });

  it('returns false when docType is regulation', () => {
    expect(shouldExcludeRegulations({ docType: 'regulation' })).toBe(false);
  });

  it('returns true when docType is statute', () => {
    expect(shouldExcludeRegulations({ docType: 'statute' })).toBe(true);
  });

  it('returns true when docType is guidance', () => {
    expect(shouldExcludeRegulations({ docType: 'guidance' })).toBe(true);
  });
});

describe('shouldExcludeGuidance', () => {
  it('returns false when no filters are active', () => {
    expect(shouldExcludeGuidance({})).toBe(false);
  });

  it('returns true when docType is regulation', () => {
    expect(shouldExcludeGuidance({ docType: 'regulation' })).toBe(true);
  });

  it('returns true when docType is statute', () => {
    expect(shouldExcludeGuidance({ docType: 'statute' })).toBe(true);
  });

  it('returns false when docType is guidance', () => {
    expect(shouldExcludeGuidance({ docType: 'guidance' })).toBe(false);
  });

  it('returns true when hierarchyLevel is set', () => {
    expect(shouldExcludeGuidance({ hierarchyLevel: 'section' })).toBe(true);
  });

  it('returns false when issueSystem is set (guidance can have issues)', () => {
    expect(shouldExcludeGuidance({ issueSystem: 'compliance' })).toBe(false);
  });

  it('returns false when classification is set (guidance can have classified issues)', () => {
    expect(shouldExcludeGuidance({ classification: 'burdensome' })).toBe(false);
  });

  it('returns false when only sectionType is set', () => {
    expect(shouldExcludeGuidance({ sectionType: 'definitions' })).toBe(false);
  });
});

describe('shouldSkipAnalyses', () => {
  it('returns false when null', () => {
    expect(shouldSkipAnalyses(null)).toBe(false);
  });

  it('returns false when undefined', () => {
    expect(shouldSkipAnalyses(undefined)).toBe(false);
  });

  it('returns false when compliance', () => {
    expect(shouldSkipAnalyses('compliance')).toBe(false);
  });

  it('returns true when none', () => {
    expect(shouldSkipAnalyses('none')).toBe(true);
  });

  it('returns true when jenai', () => {
    expect(shouldSkipAnalyses('jenai')).toBe(true);
  });

  it('returns false when any', () => {
    expect(shouldSkipAnalyses('any')).toBe(false);
  });
});
