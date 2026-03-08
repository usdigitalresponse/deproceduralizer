import { describe, it, expect } from 'vitest';
import { getCrossRefTargetUrl, getCrossRefLinkText } from '../cross-ref-url';

describe('getCrossRefTargetUrl', () => {
  it('returns regulation URL when only targetDocumentId is set', () => {
    const url = getCrossRefTargetUrl('ny', {
      targetDocumentId: 123,
      targetGuidanceId: null,
    });
    expect(url).toBe('/ny/regulations/123');
  });

  it('returns guidance URL when only targetGuidanceId is set', () => {
    const url = getCrossRefTargetUrl('ny', {
      targetDocumentId: null,
      targetGuidanceId: 42,
    });
    expect(url).toBe('/ny/guidance/42');
  });

  it('returns null when both targets are null (unresolved)', () => {
    const url = getCrossRefTargetUrl('ny', {
      targetDocumentId: null,
      targetGuidanceId: null,
    });
    expect(url).toBeNull();
  });

  it('returns guidance URL when both targets are set (guidance takes priority)', () => {
    const url = getCrossRefTargetUrl('ny', {
      targetDocumentId: 123,
      targetGuidanceId: 42,
    });
    expect(url).toBe('/ny/guidance/42');
  });

  it('uses the provided state parameter in the URL', () => {
    const url = getCrossRefTargetUrl('nj', {
      targetDocumentId: 456,
      targetGuidanceId: null,
    });
    expect(url).toBe('/nj/regulations/456');
  });
});

describe('getCrossRefLinkText', () => {
  it('returns guidance text when targetGuidanceId is set', () => {
    const text = getCrossRefLinkText({ targetGuidanceId: 42 });
    expect(text).toBe('View referenced guidance');
  });

  it('returns document text when targetGuidanceId is null', () => {
    const text = getCrossRefLinkText({ targetGuidanceId: null });
    expect(text).toBe('View referenced document');
  });
});
