import { describe, it, expect } from 'vitest';
import { TRIAGE_CATEGORY } from './triage';

describe('Triage constants', () => {
  it('sets TRIAGE_CATEGORY to "triage"', () => {
    expect(TRIAGE_CATEGORY).toBe('triage');
  });
});
