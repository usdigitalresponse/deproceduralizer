import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetParts = vi.fn();
const mockGetSectionTypes = vi.fn();
const mockGetAllPaginated = vi.fn();
const mockGetReviewedPaginated = vi.fn();
const mockGetCategories = vi.fn();
const mockGetCountsByStatus = vi.fn();
const mockGetDeveloperStatusCounts = vi.fn();
const mockGetSeverityDistribution = vi.fn();
const mockGetByDocumentId = vi.fn();
const mockUpdateReview = vi.fn();
const mockUpdateDeveloperStatus = vi.fn();
const mockResetIssue = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn((fn: Function) => fn),
}));

vi.mock('server-only', () => ({}));

vi.mock('@deproceduralizer/database', () => ({
  db: {},
  BarrierRepository: vi.fn().mockImplementation(() => ({
    getParts: mockGetParts,
    getSectionTypes: mockGetSectionTypes,
    getAllPaginated: mockGetAllPaginated,
    getReviewedPaginated: mockGetReviewedPaginated,
    getCategories: mockGetCategories,
    getCountsByStatus: mockGetCountsByStatus,
    getDeveloperStatusCounts: mockGetDeveloperStatusCounts,
    getSeverityDistribution: mockGetSeverityDistribution,
    getByDocumentId: mockGetByDocumentId,
    updateReview: mockUpdateReview,
    updateDeveloperStatus: mockUpdateDeveloperStatus,
    resetIssue: mockResetIssue,
  })),
}));

const {
  getBarrierParts,
  getBarrierSectionTypes,
  getBarrierIssuesPaginated,
  getBarrierDeveloperItems,
} = await import('./barrier');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBarrierParts', () => {
  it('returns parts on success', async () => {
    const mockData = [
      { part: '418', partName: 'Child Care', count: 42 },
      { part: '413', partName: 'Family Court', count: 10 },
    ];
    mockGetParts.mockResolvedValue(mockData);

    const result = await getBarrierParts('ny');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(mockData);
    }
    expect(mockGetParts).toHaveBeenCalledWith('ny');
  });

  it('returns failure on error', async () => {
    mockGetParts.mockRejectedValue(new Error('DB error'));

    const result = await getBarrierParts('ny');

    expect(result.success).toBe(false);
  });
});

describe('getBarrierSectionTypes', () => {
  it('returns section types on success', async () => {
    const mockData = [
      { sectionType: 'requirements', count: 100 },
      { sectionType: 'penalties', count: 20 },
    ];
    mockGetSectionTypes.mockResolvedValue(mockData);

    const result = await getBarrierSectionTypes('ny');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(mockData);
    }
    expect(mockGetSectionTypes).toHaveBeenCalledWith('ny');
  });
});

describe('getBarrierIssuesPaginated with filters', () => {
  it('passes part filter to repository', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { part: '418,413' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          parts: ['418', '413'],
        }),
      })
    );
  });

  it('passes sectionType filter to repository', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { sectionType: 'requirements,penalties' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          sectionTypes: ['requirements', 'penalties'],
        }),
      })
    );
  });

  it('omits filters when not provided', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: {},
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          parts: undefined,
          sectionTypes: undefined,
        }),
      })
    );
  });

  it('passes search string to repository', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { search: 'child care' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          search: 'child care',
        }),
      })
    );
  });

  it('passes complexity comma-separated to complexities array', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { complexity: 'HIGH,MEDIUM' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          complexities: ['HIGH', 'MEDIUM'],
        }),
      })
    );
  });

  it('parses verbatim "true" to isVerbatim boolean', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { verbatim: 'true' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          isVerbatim: true,
        }),
      })
    );
  });

  it('parses verbatim "false" to isVerbatim false', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { verbatim: 'false' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          isVerbatim: false,
        }),
      })
    );
  });

  it('omits isVerbatim when verbatim is "all"', async () => {
    mockGetAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierIssuesPaginated('ny', {
      page: 1,
      pageSize: 10,
      filters: { verbatim: 'all' },
    });

    expect(mockGetAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          isVerbatim: undefined,
        }),
      })
    );
  });
});

describe('getBarrierDeveloperItems with filters', () => {
  it('passes part and sectionType to repository', async () => {
    mockGetReviewedPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierDeveloperItems('ny', {
      page: 1,
      pageSize: 10,
      part: '418',
      sectionType: 'requirements',
    });

    expect(mockGetReviewedPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          parts: ['418'],
          sectionTypes: ['requirements'],
        }),
      })
    );
  });

  it('passes search, complexity, and verbatim to repository', async () => {
    mockGetReviewedPaginated.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await getBarrierDeveloperItems('ny', {
      page: 1,
      pageSize: 10,
      search: 'licensure',
      complexity: 'HIGH',
      verbatim: 'true',
    });

    expect(mockGetReviewedPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          search: 'licensure',
          complexities: ['HIGH'],
          isVerbatim: true,
        }),
      })
    );
  });
});
