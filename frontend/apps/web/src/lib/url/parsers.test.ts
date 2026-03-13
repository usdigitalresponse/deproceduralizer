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

describe('jenaiSourceParser default', () => {
  it('defaults to "all"', async () => {
    const { jenaiSourceParser } = await import('./parsers');
    expect(jenaiSourceParser.defaultValue).toBe('all');
  });
});

describe('jenaiVerbatimParser default', () => {
  it('defaults to "all"', async () => {
    const { jenaiVerbatimParser } = await import('./parsers');
    expect(jenaiVerbatimParser.defaultValue).toBe('all');
  });
});

describe('jenaiQueueParsers keys (merged)', () => {
  it('includes all keys from both review and developer parsers', async () => {
    const { jenaiQueueParsers } = await import('./parsers');
    // Shared
    expect(jenaiQueueParsers).toHaveProperty('page');
    expect(jenaiQueueParsers).toHaveProperty('source');
    expect(jenaiQueueParsers).toHaveProperty('severity');
    expect(jenaiQueueParsers).toHaveProperty('category');
    expect(jenaiQueueParsers).toHaveProperty('part');
    expect(jenaiQueueParsers).toHaveProperty('sectionType');
    expect(jenaiQueueParsers).toHaveProperty('search');
    expect(jenaiQueueParsers).toHaveProperty('complexity');
    expect(jenaiQueueParsers).toHaveProperty('verbatim');
    expect(jenaiQueueParsers).toHaveProperty('sortBy');
    expect(jenaiQueueParsers).toHaveProperty('sortOrder');
    // Review-specific
    expect(jenaiQueueParsers).toHaveProperty('reviewStatus');
    // Developer-specific
    expect(jenaiQueueParsers).toHaveProperty('developerStatus');
    expect(jenaiQueueParsers).toHaveProperty('developerAssigned');
  });
});

describe('jenaiReviewQueueParsers keys', () => {
  it('includes part, sectionType, search, complexity, and verbatim parsers', async () => {
    const { jenaiReviewQueueParsers } = await import('./parsers');
    expect(jenaiReviewQueueParsers).toHaveProperty('part');
    expect(jenaiReviewQueueParsers).toHaveProperty('sectionType');
    expect(jenaiReviewQueueParsers).toHaveProperty('search');
    expect(jenaiReviewQueueParsers).toHaveProperty('complexity');
    expect(jenaiReviewQueueParsers).toHaveProperty('verbatim');
    expect(jenaiReviewQueueParsers).not.toHaveProperty('department');
  });
});

describe('jenaiDeveloperQueueParsers keys', () => {
  it('includes part, sectionType, search, complexity, and verbatim parsers', async () => {
    const { jenaiDeveloperQueueParsers } = await import('./parsers');
    expect(jenaiDeveloperQueueParsers).toHaveProperty('part');
    expect(jenaiDeveloperQueueParsers).toHaveProperty('sectionType');
    expect(jenaiDeveloperQueueParsers).toHaveProperty('search');
    expect(jenaiDeveloperQueueParsers).toHaveProperty('complexity');
    expect(jenaiDeveloperQueueParsers).toHaveProperty('verbatim');
    expect(jenaiDeveloperQueueParsers).not.toHaveProperty('department');
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
