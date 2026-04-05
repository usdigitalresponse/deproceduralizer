import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/cache
const mockUpdateTag = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => mockUpdateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  unstable_cache: vi.fn(),
}));

vi.mock('server-only', () => ({}));

// Mock database
const mockGetByAnalysisId = vi.fn();
const mockCreate = vi.fn();
const mockGetMarkersForBookmark = vi.fn();
const mockAssignMarker = vi.fn();
const mockRemoveMarker = vi.fn();

// Mock db.select().from().where().limit() chain
const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock('@deproceduralizer/database', () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
  BookmarksRepository: vi.fn().mockImplementation(() => ({
    getByAnalysisId: mockGetByAnalysisId,
    create: mockCreate,
    getMarkersForBookmark: mockGetMarkersForBookmark,
    assignMarker: mockAssignMarker,
    removeMarker: mockRemoveMarker,
    // Stubs for other methods used during module init
    delete: vi.fn(),
    getDocumentBookmark: vi.fn(),
    update: vi.fn(),
  })),
  bookmarks: { id: 'b.id', analysisId: 'b.analysisId', jurisdiction: 'b.jurisdiction', issueType: 'b.issueType' },
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

const { toggleTriageTag } = await import('./bookmarks');

beforeEach(() => {
  vi.clearAllMocks();
  // Reset chain mocks
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
});

describe('toggleTriageTag', () => {
  const analysisResult = { analysisId: 100, jurisdiction: 'NY' };
  const existingBookmark = { id: 5, analysisId: 100, jurisdiction: 'NY' };

  describe('cache invalidation', () => {
    it('calls updateTag when a new bookmark is created (to refresh cached counts)', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(null); // no existing bookmark
      mockCreate.mockResolvedValue({ id: 99, analysisId: 100 });
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]);

      await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(mockUpdateTag).toHaveBeenCalledWith('bookmarks');
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('does not call updateTag when bookmark already exists (no re-render)', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(existingBookmark);
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]);

      await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(mockUpdateTag).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('auto-bookmark', () => {
    it('creates a bookmark when none exists', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(null); // no existing bookmark
      mockCreate.mockResolvedValue({ id: 99, analysisId: 100 });
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]);

      const result = await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        documentId: 42,
        analysisId: 100,
        issueType: 'wet_signature',
      }));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookmarkId).toBe(99);
      }
    });

    it('uses existing bookmark when already bookmarked', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(existingBookmark);
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]);

      const result = await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookmarkId).toBe(5);
      }
    });
  });

  describe('toggle behavior', () => {
    it('assigns marker when not already assigned', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(existingBookmark);
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([]) // no markers yet
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]);

      await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(mockAssignMarker).toHaveBeenCalledWith(5, 10);
      expect(mockRemoveMarker).not.toHaveBeenCalled();
    });

    it('removes marker when already assigned', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(existingBookmark);
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]) // already has it
        .mockResolvedValueOnce([]); // after removal

      await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(mockRemoveMarker).toHaveBeenCalledWith(5, 10);
      expect(mockAssignMarker).not.toHaveBeenCalled();
    });

    it('does not remove other triage markers (multi-select)', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(existingBookmark);
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([{ id: 11, name: 'Needs Review', color: '#d97706' }]) // has Needs Review
        .mockResolvedValueOnce([
          { id: 10, name: 'Confirmed', color: '#16a34a' },
          { id: 11, name: 'Needs Review', color: '#d97706' },
        ]); // after adding Confirmed

      const result = await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      // Should only assign the new one, not remove the existing one
      expect(mockAssignMarker).toHaveBeenCalledWith(5, 10);
      expect(mockRemoveMarker).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.markerIds).toEqual([10, 11]);
      }
    });

    it('returns updated marker IDs after toggle', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(existingBookmark);
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 10, name: 'Confirmed', color: '#16a34a' },
          { id: 11, name: 'Needs Review', color: '#d97706' },
        ]);

      const result = await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.markerIds).toEqual([10, 11]);
      }
    });
  });

  describe('guidance documents', () => {
    it('creates bookmark with guidanceDocumentId for guidance kind', async () => {
      mockLimit.mockResolvedValue([analysisResult]);
      mockGetByAnalysisId.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: 88, analysisId: 100 });
      mockGetMarkersForBookmark
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 10, name: 'Confirmed', color: '#16a34a' }]);

      await toggleTriageTag('guidance', 724, 'reporting_frequency', 10, 'NY');

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        guidanceDocumentId: 724,
        analysisId: 100,
        issueType: 'reporting_frequency',
      }));
      // Should NOT have documentId
      expect(mockCreate).toHaveBeenCalledWith(expect.not.objectContaining({
        documentId: expect.anything(),
      }));
    });
  });

  describe('error handling', () => {
    it('returns failure when analysis not found', async () => {
      mockLimit.mockResolvedValue([]);

      const result = await toggleTriageTag('regulation', 999, 'wet_signature', 10, 'NY');

      expect(result.success).toBe(false);
      expect(mockAssignMarker).not.toHaveBeenCalled();
      expect(mockRemoveMarker).not.toHaveBeenCalled();
      expect(mockUpdateTag).not.toHaveBeenCalled();
    });

    it('returns failure on database error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLimit.mockRejectedValue(new Error('connection lost'));

      const result = await toggleTriageTag('regulation', 42, 'wet_signature', 10, 'NY');

      expect(result.success).toBe(false);
      consoleSpy.mockRestore();
    });
  });
});
