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
const mockUpdate = vi.fn();

vi.mock('@deproceduralizer/database', () => ({
  db: {},
  BookmarksRepository: vi.fn().mockImplementation(() => ({
    getByAnalysisId: mockGetByAnalysisId,
    delete: mockDelete,
    create: mockCreate,
    getDocumentBookmark: mockGetDocumentBookmark,
    update: mockUpdate,
  })),
  bookmarks: { id: 'bookmarks.id', analysisId: 'bookmarks.analysisId', state: 'bookmarks.state' },
  complianceIssueAnalyses: {
    id: 'cia.id',
    documentId: 'cia.documentId',
    issueType: 'cia.issueType',
    state: 'cia.state',
  },
  eq: vi.fn(),
  and: vi.fn(),
}));

// Dynamically import so mocks are applied
const { toggleAnalysisBookmark, toggleDocumentBookmark, removeBookmark, updateBookmarkNotes } =
  await import('./bookmarks');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('refreshBookmarkCache (via action behavior)', () => {
  describe('toggleAnalysisBookmark - removes bookmark', () => {
    it('invalidates bookmarks tag and pipeline+bookmarks pages', async () => {
      mockGetByAnalysisId.mockResolvedValue({ id: 1 });
      mockDelete.mockResolvedValue(true);

      await toggleAnalysisBookmark(42);

      expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/pipeline', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleDocumentBookmark - removes bookmark', () => {
    it('invalidates bookmarks tag and regulations+bookmarks pages', async () => {
      mockGetDocumentBookmark.mockResolvedValue({ id: 2 });
      mockDelete.mockResolvedValue(true);

      await toggleDocumentBookmark(10, 'ny');

      expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/regulations', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeBookmark', () => {
    it('invalidates bookmarks tag and all three pages', async () => {
      mockDelete.mockResolvedValue(true);

      await removeBookmark(5);

      expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/pipeline', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/regulations', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateBookmarkNotes', () => {
    it('only revalidates bookmarks page (no updateTag)', async () => {
      mockUpdate.mockResolvedValue({ id: 7, notes: 'updated' });

      await updateBookmarkNotes(7, 'new notes');

      expect(mockUpdateTag).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/[state]/bookmarks', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
    });
  });
});
