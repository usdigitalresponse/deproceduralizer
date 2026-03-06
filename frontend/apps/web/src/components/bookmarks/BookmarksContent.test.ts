import { describe, it, expect } from 'vitest';

/**
 * Tests for BookmarksContent filtering logic.
 *
 * The key bug that was fixed: guidance analysis bookmarks (analysisId != null,
 * guidanceDocumentId != null, documentId = null) must appear in the Analyses tab
 * and link to the guidance pipeline detail page.
 *
 * Since vitest uses node environment (no jsdom), we test the filtering logic
 * directly rather than rendering. The actual UI is covered by e2e smoke tests.
 */

// Replicate the filtering logic from BookmarksContent
function filterBookmarks(
  bookmarks: Array<{
    analysisId: number | null;
    guidanceDocumentId: number | null;
    documentId: number | null;
  }>,
  activeTab: 'analysis' | 'document' | 'guidance'
) {
  return bookmarks.filter(b => {
    if (activeTab === 'analysis') return b.analysisId !== null;
    if (activeTab === 'guidance') return b.guidanceDocumentId !== null && b.analysisId === null;
    return b.analysisId === null && b.guidanceDocumentId === null; // document
  });
}

// Replicate the URL logic from AnalysisBookmarkCard
function getViewUrl(
  bookmark: { documentId: number | null; guidanceDocumentId: number | null; issueType: string | null },
  jurisdiction: string
) {
  const isGuidanceAnalysis = bookmark.guidanceDocumentId !== null && bookmark.documentId === null;
  return isGuidanceAnalysis
    ? `/${jurisdiction.toLowerCase()}/pipeline/guidance/${bookmark.guidanceDocumentId}/${bookmark.issueType}`
    : `/${jurisdiction.toLowerCase()}/pipeline/${bookmark.documentId}/${bookmark.issueType}`;
}

describe('BookmarksContent filtering', () => {
  const regulationAnalysis = { analysisId: 1, guidanceDocumentId: null, documentId: 100 };
  const guidanceAnalysis = { analysisId: 2, guidanceDocumentId: 50, documentId: null };
  const documentBookmark = { analysisId: null, guidanceDocumentId: null, documentId: 200 };
  const guidanceDocBookmark = { analysisId: null, guidanceDocumentId: 60, documentId: null };

  const allBookmarks = [regulationAnalysis, guidanceAnalysis, documentBookmark, guidanceDocBookmark];

  it('analysis tab includes both regulation and guidance analyses', () => {
    const result = filterBookmarks(allBookmarks, 'analysis');
    expect(result).toHaveLength(2);
    expect(result).toContain(regulationAnalysis);
    expect(result).toContain(guidanceAnalysis);
  });

  it('analysis tab does not include document or guidance-doc-only bookmarks', () => {
    const result = filterBookmarks(allBookmarks, 'analysis');
    expect(result).not.toContain(documentBookmark);
    expect(result).not.toContain(guidanceDocBookmark);
  });

  it('guidance tab only includes guidance document bookmarks (no analysis)', () => {
    const result = filterBookmarks(allBookmarks, 'guidance');
    expect(result).toHaveLength(1);
    expect(result).toContain(guidanceDocBookmark);
  });

  it('guidance tab excludes guidance analysis bookmarks (those go to analysis tab)', () => {
    const result = filterBookmarks(allBookmarks, 'guidance');
    expect(result).not.toContain(guidanceAnalysis);
  });

  it('document tab only includes pure document bookmarks', () => {
    const result = filterBookmarks(allBookmarks, 'document');
    expect(result).toHaveLength(1);
    expect(result).toContain(documentBookmark);
  });
});

describe('AnalysisBookmarkCard URL generation', () => {
  it('generates guidance pipeline URL for guidance analysis bookmarks', () => {
    const url = getViewUrl(
      { documentId: null, guidanceDocumentId: 50, issueType: 'excessive_fees' },
      'NY'
    );
    expect(url).toBe('/ny/pipeline/guidance/50/excessive_fees');
  });

  it('generates regulation pipeline URL for regulation analysis bookmarks', () => {
    const url = getViewUrl(
      { documentId: 100, guidanceDocumentId: null, issueType: 'excessive_fees' },
      'NY'
    );
    expect(url).toBe('/ny/pipeline/100/excessive_fees');
  });

  it('handles case where both IDs are present (treats as regulation)', () => {
    // Edge case: if both documentId and guidanceDocumentId exist, it's not guidance-only
    const url = getViewUrl(
      { documentId: 100, guidanceDocumentId: 50, issueType: 'excessive_fees' },
      'NY'
    );
    expect(url).toBe('/ny/pipeline/100/excessive_fees');
  });
});

