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
