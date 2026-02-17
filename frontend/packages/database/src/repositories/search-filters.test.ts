import { describe, it, expect } from 'vitest';
import { shouldExcludeStatutes, shouldExcludeRegulations, shouldSkipAnalyses } from './search-filters';

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

  it('returns true when sectionType is set', () => {
    expect(shouldExcludeStatutes({ sectionType: 'definitions' })).toBe(true);
  });

  it('returns true when hierarchyLevel is set', () => {
    expect(shouldExcludeStatutes({ hierarchyLevel: 'section' })).toBe(true);
  });

  it('returns true when hasAnalysis is true', () => {
    expect(shouldExcludeStatutes({ hasAnalysis: 'true' })).toBe(true);
  });

  it('returns false when hasAnalysis is false (statutes qualify as not-analyzed)', () => {
    expect(shouldExcludeStatutes({ hasAnalysis: 'false' })).toBe(false);
  });

  it('returns true when classification is set', () => {
    expect(shouldExcludeStatutes({ classification: 'burdensome' })).toBe(true);
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
      hasAnalysis: null,
      classification: null,
    })).toBe(false);
  });

  it('returns false when all filter values are undefined', () => {
    expect(shouldExcludeStatutes({
      docType: undefined,
      sectionType: undefined,
      hierarchyLevel: undefined,
      hasAnalysis: undefined,
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
});

describe('shouldSkipAnalyses', () => {
  it('returns false when null', () => {
    expect(shouldSkipAnalyses(null)).toBe(false);
  });

  it('returns false when undefined', () => {
    expect(shouldSkipAnalyses(undefined)).toBe(false);
  });

  it('returns false when true', () => {
    expect(shouldSkipAnalyses('true')).toBe(false);
  });

  it('returns true when false', () => {
    expect(shouldSkipAnalyses('false')).toBe(true);
  });
});
