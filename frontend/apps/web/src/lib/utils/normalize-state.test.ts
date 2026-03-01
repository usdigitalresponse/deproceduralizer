import { describe, it, expect } from 'vitest';
import { normalizeJurisdiction } from '@deproceduralizer/database/schema';

describe('normalizeJurisdiction', () => {
  it('converts lowercase jurisdiction codes to uppercase', () => {
    expect(normalizeJurisdiction('ny')).toBe('NY');
    expect(normalizeJurisdiction('nj')).toBe('NJ');
    expect(normalizeJurisdiction('nyc')).toBe('NYC');
  });

  it('preserves already-uppercase jurisdiction codes', () => {
    expect(normalizeJurisdiction('NY')).toBe('NY');
    expect(normalizeJurisdiction('NJ')).toBe('NJ');
    expect(normalizeJurisdiction('NYC')).toBe('NYC');
  });

  it('handles mixed-case input', () => {
    expect(normalizeJurisdiction('Ny')).toBe('NY');
    expect(normalizeJurisdiction('nYc')).toBe('NYC');
  });

  it('handles empty string', () => {
    expect(normalizeJurisdiction('')).toBe('');
  });
});
