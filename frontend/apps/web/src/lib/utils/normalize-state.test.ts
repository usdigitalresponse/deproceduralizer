import { describe, it, expect } from 'vitest';
import { normalizeState } from '@deproceduralizer/database/schema';

describe('normalizeState', () => {
  it('converts lowercase state codes to uppercase', () => {
    expect(normalizeState('ny')).toBe('NY');
    expect(normalizeState('nj')).toBe('NJ');
    expect(normalizeState('nyc')).toBe('NYC');
  });

  it('preserves already-uppercase state codes', () => {
    expect(normalizeState('NY')).toBe('NY');
    expect(normalizeState('NJ')).toBe('NJ');
    expect(normalizeState('NYC')).toBe('NYC');
  });

  it('handles mixed-case input', () => {
    expect(normalizeState('Ny')).toBe('NY');
    expect(normalizeState('nYc')).toBe('NYC');
  });

  it('handles empty string', () => {
    expect(normalizeState('')).toBe('');
  });
});
