import { describe, it, expect } from 'vitest';
import type { HighlightRef } from '@deproceduralizer/database';
import { transformHighlightRefs } from '../useCrossRefHighlighting';

function makeRef(overrides: Partial<HighlightRef> & { id: number; rawText: string }): HighlightRef {
  return {
    startOffset: null,
    endOffset: null,
    targetDocumentId: null,
    targetGuidanceId: null,
    refType: 'nycrr',
    targetTitle: null,
    targetCitation: null,
    isResolved: null,
    ...overrides,
  };
}

describe('transformHighlightRefs', () => {
  it('returns empty array for undefined input', () => {
    expect(transformHighlightRefs(undefined)).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(transformHighlightRefs([])).toEqual([]);
  });

  it('filters out refs with null startOffset', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: '18 NYCRR 413.2', startOffset: null, endOffset: 50 }),
      makeRef({ id: 2, rawText: '18 NYCRR 413.3', startOffset: 100, endOffset: 120 }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters out refs with null endOffset', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: '18 NYCRR 413.2', startOffset: 10, endOffset: null }),
      makeRef({ id: 2, rawText: '18 NYCRR 413.3', startOffset: 100, endOffset: 120 }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters out refs with both offsets null', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: '18 NYCRR 413.2', startOffset: null, endOffset: null }),
    ];
    expect(transformHighlightRefs(refs)).toEqual([]);
  });

  it('sorts results by startOffset ascending', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: 'ref C', startOffset: 300, endOffset: 320 }),
      makeRef({ id: 2, rawText: 'ref A', startOffset: 10, endOffset: 30 }),
      makeRef({ id: 3, rawText: 'ref B', startOffset: 150, endOffset: 170 }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
    expect(result.map((r) => r.startOffset)).toEqual([10, 150, 300]);
  });

  it('maps targetGuidanceId through when non-null', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: 'GIS 19-OCFS-01', startOffset: 0, endOffset: 15, targetGuidanceId: 42 }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result[0].targetGuidanceId).toBe(42);
  });

  it('maps targetGuidanceId to null when null in source', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: '18 NYCRR 413.2', startOffset: 0, endOffset: 15, targetGuidanceId: null }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result[0].targetGuidanceId).toBeNull();
  });

  it('defaults refType to nycrr when nullish', () => {
    const refs: HighlightRef[] = [
      // Force undefined via cast to simulate missing field at runtime
      makeRef({ id: 1, rawText: 'some ref', startOffset: 0, endOffset: 10, refType: undefined as unknown as string }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result[0].refType).toBe('nycrr');
  });

  it('preserves explicit refType value', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: 'GIS ref', startOffset: 0, endOffset: 10, refType: 'guidance' }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result[0].refType).toBe('guidance');
  });

  it('defaults isResolved to false when null', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: '18 NYCRR 413.2', startOffset: 0, endOffset: 15, isResolved: null }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result[0].isResolved).toBe(false);
  });

  it('preserves isResolved true when set', () => {
    const refs: HighlightRef[] = [
      makeRef({ id: 1, rawText: '18 NYCRR 413.2', startOffset: 0, endOffset: 15, isResolved: true }),
    ];
    const result = transformHighlightRefs(refs);
    expect(result[0].isResolved).toBe(true);
  });

  it('handles mix of regulation and guidance targets in same array', () => {
    const refs: HighlightRef[] = [
      makeRef({
        id: 1,
        rawText: '18 NYCRR 413.2',
        startOffset: 50,
        endOffset: 65,
        targetDocumentId: 100,
        targetGuidanceId: null,
        refType: 'nycrr',
        isResolved: true,
        targetTitle: 'Child Protective Services',
        targetCitation: '18 NYCRR 413.2',
      }),
      makeRef({
        id: 2,
        rawText: 'GIS 19-OCFS-01',
        startOffset: 10,
        endOffset: 25,
        targetDocumentId: null,
        targetGuidanceId: 42,
        refType: 'guidance',
        isResolved: true,
        targetTitle: 'GIS Letter 19-01',
        targetCitation: null,
      }),
      makeRef({
        id: 3,
        rawText: 'SSL 390',
        startOffset: 200,
        endOffset: 210,
        targetDocumentId: null,
        targetGuidanceId: null,
        refType: 'ssl',
        isResolved: false,
        targetTitle: null,
        targetCitation: null,
      }),
    ];

    const result = transformHighlightRefs(refs);

    // Should be sorted by startOffset: 10, 50, 200
    expect(result).toHaveLength(3);

    // Guidance ref (earliest offset)
    expect(result[0]).toEqual({
      id: 2,
      rawText: 'GIS 19-OCFS-01',
      startOffset: 10,
      endOffset: 25,
      targetDocumentId: null,
      targetGuidanceId: 42,
      refType: 'guidance',
      isResolved: true,
      targetTitle: 'GIS Letter 19-01',
      targetCitation: null,
    });

    // Regulation ref
    expect(result[1]).toEqual({
      id: 1,
      rawText: '18 NYCRR 413.2',
      startOffset: 50,
      endOffset: 65,
      targetDocumentId: 100,
      targetGuidanceId: null,
      refType: 'nycrr',
      isResolved: true,
      targetTitle: 'Child Protective Services',
      targetCitation: '18 NYCRR 413.2',
    });

    // Unresolved ref
    expect(result[2]).toEqual({
      id: 3,
      rawText: 'SSL 390',
      startOffset: 200,
      endOffset: 210,
      targetDocumentId: null,
      targetGuidanceId: null,
      refType: 'ssl',
      isResolved: false,
      targetTitle: null,
      targetCitation: null,
    });
  });
});
