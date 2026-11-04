import { describe, it, expect } from 'vitest';
import { parseCommaSeparated, serializeCommaSeparated } from './parsers';

describe('parseCommaSeparated', () => {
  it('returns empty array for null', () => {
    expect(parseCommaSeparated(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCommaSeparated('')).toEqual([]);
  });

  it('parses single value', () => {
    expect(parseCommaSeparated('high')).toEqual(['high']);
  });

  it('parses multiple values', () => {
    expect(parseCommaSeparated('high,medium,low')).toEqual(['high', 'medium', 'low']);
  });

  it('filters out empty segments from trailing commas', () => {
    expect(parseCommaSeparated('high,medium,')).toEqual(['high', 'medium']);
  });
});

describe('complianceSourceParser default', () => {
  it('defaults to "all"', async () => {
    const { complianceSourceParser } = await import('./parsers');
    expect(complianceSourceParser.defaultValue).toBe('all');
  });
});

describe('barrierSourceParser default', () => {
  it('defaults to "all"', async () => {
    const { barrierSourceParser } = await import('./parsers');
    expect(barrierSourceParser.defaultValue).toBe('all');
  });
});

describe('barrierVerbatimParser default', () => {
  it('defaults to "all"', async () => {
    const { barrierVerbatimParser } = await import('./parsers');
    expect(barrierVerbatimParser.defaultValue).toBe('all');
  });
});

describe('barrierQueueParsers keys (merged)', () => {
  it('includes all keys from both review and developer parsers', async () => {
    const { barrierQueueParsers } = await import('./parsers');
    // Shared
    expect(barrierQueueParsers).toHaveProperty('page');
    expect(barrierQueueParsers).toHaveProperty('source');
    expect(barrierQueueParsers).toHaveProperty('severity');
    expect(barrierQueueParsers).toHaveProperty('category');
    expect(barrierQueueParsers).toHaveProperty('part');
    expect(barrierQueueParsers).toHaveProperty('sectionType');
    expect(barrierQueueParsers).toHaveProperty('search');
    expect(barrierQueueParsers).toHaveProperty('complexity');
    expect(barrierQueueParsers).toHaveProperty('verbatim');
    expect(barrierQueueParsers).toHaveProperty('sortBy');
    expect(barrierQueueParsers).toHaveProperty('sortOrder');
    // Review-specific
    expect(barrierQueueParsers).toHaveProperty('reviewStatus');
    // Developer-specific
    expect(barrierQueueParsers).toHaveProperty('developerStatus');
    expect(barrierQueueParsers).toHaveProperty('developerAssigned');
  });
});

describe('barrierReviewQueueParsers keys', () => {
  it('includes part, sectionType, search, complexity, and verbatim parsers', async () => {
    const { barrierReviewQueueParsers } = await import('./parsers');
    expect(barrierReviewQueueParsers).toHaveProperty('part');
    expect(barrierReviewQueueParsers).toHaveProperty('sectionType');
    expect(barrierReviewQueueParsers).toHaveProperty('search');
    expect(barrierReviewQueueParsers).toHaveProperty('complexity');
    expect(barrierReviewQueueParsers).toHaveProperty('verbatim');
    expect(barrierReviewQueueParsers).not.toHaveProperty('department');
  });
});

describe('barrierDeveloperQueueParsers keys', () => {
  it('includes part, sectionType, search, complexity, and verbatim parsers', async () => {
    const { barrierDeveloperQueueParsers } = await import('./parsers');
    expect(barrierDeveloperQueueParsers).toHaveProperty('part');
    expect(barrierDeveloperQueueParsers).toHaveProperty('sectionType');
    expect(barrierDeveloperQueueParsers).toHaveProperty('search');
    expect(barrierDeveloperQueueParsers).toHaveProperty('complexity');
    expect(barrierDeveloperQueueParsers).toHaveProperty('verbatim');
    expect(barrierDeveloperQueueParsers).not.toHaveProperty('department');
  });
});

describe('serializeCommaSeparated', () => {
  it('returns null for empty array', () => {
    expect(serializeCommaSeparated([])).toBeNull();
  });

  it('returns string for single value', () => {
    expect(serializeCommaSeparated(['high'])).toBe('high');
  });

  it('joins multiple values with commas', () => {
    expect(serializeCommaSeparated(['high', 'medium', 'low'])).toBe('high,medium,low');
  });
});
