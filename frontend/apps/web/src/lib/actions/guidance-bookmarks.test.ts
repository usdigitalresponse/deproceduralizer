import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/cache before importing the module under test
const mockUpdateTag = vi.fn();
const mockRevalidatePath = vi.fn();
const mockUnstableCache = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => mockUpdateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  unstable_cache: (...args: unknown[]) => mockUnstableCache(...args),
}));

vi.mock('server-only', () => ({}));

// Mock the database module
const mockGetByAnalysisId = vi.fn();
const mockDelete = vi.fn();
const mockCreate = vi.fn();
const mockGetDocumentBookmark = vi.fn();
const mockGetGuidanceDocumentBookmark = vi.fn();
const mockUpdate = vi.fn();
const mockGetAllWithDetails = vi.fn();
const mockIsGuidanceDocumentBookmarked = vi.fn();

// Mock db.select chain for direct queries
const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockLeftJoin = vi.fn(() => ({ where: mockWhere }));
const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
const mockFrom = vi.fn(() => ({ where: mockWhere, leftJoin: mockLeftJoin, innerJoin: mockInnerJoin }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock('@deproceduralizer/database', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
  BookmarksRepository: vi.fn().mockImplementation(() => ({
    getByAnalysisId: mockGetByAnalysisId,
    delete: mockDelete,
    create: mockCreate,
    getDocumentBookmark: mockGetDocumentBookmark,
    getGuidanceDocumentBookmark: mockGetGuidanceDocumentBookmark,
    update: mockUpdate,
    getAllWithDetails: mockGetAllWithDetails,
    isGuidanceDocumentBookmarked: mockIsGuidanceDocumentBookmarked,
  })),
  bookmarks: {
    id: 'bookmarks.id',
    analysisId: 'bookmarks.analysisId',
    jurisdiction: 'bookmarks.jurisdiction',
    issueType: 'bookmarks.issueType',
  },
  complianceIssueAnalyses: {
    id: 'cia.id',
    documentId: 'cia.documentId',
    guidanceDocumentId: 'cia.guidanceDocumentId',
    issueType: 'cia.issueType',
    jurisdiction: 'cia.jurisdiction',
  },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

// Dynamically import so mocks are applied
const {
  toggleGuidanceAnalysisBookmarkByDocIssue,
  getBookmarkByGuidanceDocIssue,
  getBookmarkedGuidanceDocIssuePairs,
  toggleGuidanceBookmark,
  isGuidanceBookmarked,
} = await import('./bookmarks');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toggleGuidanceAnalysisBookmarkByDocIssue', () => {
  it('creates a bookmark when none exists', async () => {
    // Analysis found, no existing bookmark
    mockLimit.mockResolvedValue([{
      analysisId: 100,
      analysisJurisdiction: 'NY',
      bookmarkId: null,
    }]);

    const createdBookmark = { id: 1, guidanceDocumentId: 42, analysisId: 100, issueType: 'excessive_fees' };
    mockCreate.mockResolvedValue(createdBookmark);

    const result = await toggleGuidanceAnalysisBookmarkByDocIssue(42, 'excessive_fees', 'NY');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(createdBookmark);
    expect(mockCreate).toHaveBeenCalledWith({
      guidanceDocumentId: 42,
      analysisId: 100,
      issueType: 'excessive_fees',
      jurisdiction: 'NY',
      createdBy: undefined,
    });
  });

  it('removes an existing bookmark', async () => {
    // Analysis found with existing bookmark
    mockLimit.mockResolvedValue([{
      analysisId: 100,
      analysisJurisdiction: 'NY',
      bookmarkId: 55,
    }]);

    mockDelete.mockResolvedValue(true);

    const result = await toggleGuidanceAnalysisBookmarkByDocIssue(42, 'excessive_fees', 'NY');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith(55);
  });

  it('returns failure when analysis not found', async () => {
    mockLimit.mockResolvedValue([]);

    const result = await toggleGuidanceAnalysisBookmarkByDocIssue(999, 'excessive_fees', 'NY');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('999');
      expect(result.error).toContain('excessive_fees');
    }
  });

  it('invalidates pipeline cache on create', async () => {
    mockLimit.mockResolvedValue([{
      analysisId: 100,
      analysisJurisdiction: 'NY',
      bookmarkId: null,
    }]);
    mockCreate.mockResolvedValue({ id: 1 });

    await toggleGuidanceAnalysisBookmarkByDocIssue(42, 'excessive_fees', 'NY');

    expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/pipeline', 'page');
  });

  it('invalidates pipeline cache on remove', async () => {
    mockLimit.mockResolvedValue([{
      analysisId: 100,
      analysisJurisdiction: 'NY',
      bookmarkId: 55,
    }]);
    mockDelete.mockResolvedValue(true);

    await toggleGuidanceAnalysisBookmarkByDocIssue(42, 'excessive_fees', 'NY');

    expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/pipeline', 'page');
  });

  it('returns failure on database error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLimit.mockRejectedValue(new Error('connection lost'));

    const result = await toggleGuidanceAnalysisBookmarkByDocIssue(42, 'excessive_fees', 'NY');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('connection lost');
    }
    consoleSpy.mockRestore();
  });
});

describe('getBookmarkByGuidanceDocIssue', () => {
  it('returns bookmark when analysis and bookmark exist', async () => {
    const bookmark = { id: 10, analysisId: 100, notes: 'test' };
    mockLimit.mockResolvedValue([{ id: 100 }]);
    mockGetByAnalysisId.mockResolvedValue(bookmark);

    const result = await getBookmarkByGuidanceDocIssue(42, 'excessive_fees');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(bookmark);
    expect(mockGetByAnalysisId).toHaveBeenCalledWith(100);
  });

  it('returns null when analysis exists but no bookmark', async () => {
    mockLimit.mockResolvedValue([{ id: 100 }]);
    mockGetByAnalysisId.mockResolvedValue(undefined);

    const result = await getBookmarkByGuidanceDocIssue(42, 'excessive_fees');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns null when no analysis found', async () => {
    mockLimit.mockResolvedValue([]);

    const result = await getBookmarkByGuidanceDocIssue(999, 'excessive_fees');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns failure on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLimit.mockRejectedValue(new Error('db error'));

    const result = await getBookmarkByGuidanceDocIssue(42, 'excessive_fees');

    expect(result.success).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe('getBookmarkedGuidanceDocIssuePairs', () => {
  it('returns set of guidanceDocumentId-issueType pairs', async () => {
    mockWhere.mockResolvedValue([
      { guidanceDocumentId: 10, issueType: 'excessive_fees' },
      { guidanceDocumentId: 20, issueType: 'unclear_language' },
    ]);

    const result = await getBookmarkedGuidanceDocIssuePairs('NY');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(Set);
      expect(result.data.has('10-excessive_fees')).toBe(true);
      expect(result.data.has('20-unclear_language')).toBe(true);
      expect(result.data.size).toBe(2);
    }
  });

  it('filters out entries with null guidanceDocumentId', async () => {
    mockWhere.mockResolvedValue([
      { guidanceDocumentId: 10, issueType: 'excessive_fees' },
      { guidanceDocumentId: null, issueType: 'unclear_language' },
    ]);

    const result = await getBookmarkedGuidanceDocIssuePairs('NY');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.size).toBe(1);
      expect(result.data.has('10-excessive_fees')).toBe(true);
    }
  });

  it('filters out entries with null issueType', async () => {
    mockWhere.mockResolvedValue([
      { guidanceDocumentId: 10, issueType: null },
    ]);

    const result = await getBookmarkedGuidanceDocIssuePairs('NY');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.size).toBe(0);
    }
  });

  it('returns empty set when no bookmarks exist', async () => {
    mockWhere.mockResolvedValue([]);

    const result = await getBookmarkedGuidanceDocIssuePairs('ny');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.size).toBe(0);
    }
  });

  it('returns failure on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockWhere.mockRejectedValue(new Error('timeout'));

    const result = await getBookmarkedGuidanceDocIssuePairs('NY');

    expect(result.success).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe('toggleGuidanceBookmark', () => {
  it('creates a guidance document bookmark when none exists', async () => {
    mockGetGuidanceDocumentBookmark.mockResolvedValue(null);
    const createdBookmark = { id: 1, guidanceDocumentId: 42 };
    mockCreate.mockResolvedValue(createdBookmark);

    const result = await toggleGuidanceBookmark(42, 'NY');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(createdBookmark);
    expect(mockCreate).toHaveBeenCalledWith({
      guidanceDocumentId: 42,
      jurisdiction: 'NY',
      notes: undefined,
      createdBy: undefined,
    });
  });

  it('removes existing guidance document bookmark', async () => {
    mockGetGuidanceDocumentBookmark.mockResolvedValue({ id: 5 });
    mockDelete.mockResolvedValue(true);

    const result = await toggleGuidanceBookmark(42, 'NY');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith(5);
  });

  it('invalidates guidance cache on toggle', async () => {
    mockGetGuidanceDocumentBookmark.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 1 });

    await toggleGuidanceBookmark(42, 'NY');

    expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/guidance', 'page');
  });
});

describe('isGuidanceBookmarked', () => {
  it('returns true when bookmarked', async () => {
    mockIsGuidanceDocumentBookmarked.mockResolvedValue(true);

    const result = await isGuidanceBookmarked(42);

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  it('returns false when not bookmarked', async () => {
    mockIsGuidanceDocumentBookmarked.mockResolvedValue(false);

    const result = await isGuidanceBookmarked(42);

    expect(result.success).toBe(true);
    expect(result.data).toBe(false);
  });
});
