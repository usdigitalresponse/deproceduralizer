import { eq, and, desc, asc, sql, count, gte, lt, or, isNull, ne } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { redFlags, RedFlag, ReviewStatus, ImpactType, DeveloperStatus, ResolutionType, Developer, REVIEW_STATUSES, DEVELOPER_STATUSES } from '../schema/red-flags';
import { analyses } from '../schema/analyses';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { StateCode } from '../schema/constants';

export interface UpdateRedFlagReviewInput {
  reviewStatus: ReviewStatus;
  reviewedBy: string;
  justificationNotes?: string;
  teamNotes?: string;
  priority?: number;
  impactType?: ImpactType;
}

export interface UpdateRedFlagDeveloperInput {
  developerStatus: DeveloperStatus;
  developerAssigned: Developer;
  developerNotes?: string;
  resolutionType?: ResolutionType;
  resolutionComments?: string;
  developerQuestion?: string;
}

// Types for the review queue
export interface RedFlagWithContext extends RedFlag {
  regulation: {
    id: number;
    title: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    url: string | null;
    // Summary metadata
    summary: string | null;
    sectionType: string | null;
    hasForm: boolean | null;
    hasIbr: boolean | null;
  };
}

export interface RedFlagFilterOptions {
  state: StateCode;
  status?: ReviewStatus | 'all';
  severity?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface RedFlagPaginationOptions {
  state: StateCode;
  page: number;
  pageSize: number;
  sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<RedFlagFilterOptions, 'state'>;
}

export interface PaginatedRedFlagsResult {
  data: RedFlagWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReviewStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

export interface DeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

export class RedFlagsRepository extends BaseRepository {
  async getById(id: number): Promise<RedFlag | undefined> {
    const result = await this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.id, id))
      .limit(1);

    return result[0];
  }

  async getByAnalysisId(analysisId: number): Promise<RedFlag[]> {
    return this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.analysisId, analysisId));
  }

  async updateReview(id: number, data: UpdateRedFlagReviewInput): Promise<RedFlag | undefined> {
    const result = await this.db
      .update(redFlags)
      .set({
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        justificationNotes: data.justificationNotes ?? null,
        teamNotes: data.teamNotes ?? null,
        priority: data.priority ?? null,
        impactType: data.impactType ?? null,
      })
      .where(eq(redFlags.id, id))
      .returning();

    return result[0];
  }

  async getUnreviewedFlags(): Promise<RedFlag[]> {
    return this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.reviewStatus, 'unreviewed'));
  }

  async getFlagsByStatus(status: ReviewStatus): Promise<RedFlag[]> {
    return this.db
      .select()
      .from(redFlags)
      .where(eq(redFlags.reviewStatus, status));
  }

  /**
   * Get all unique categories for filter dropdown
   */
  async getCategories(state: StateCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ category: redFlags.category })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(and(
        eq(analyses.isCurrent, true),
        eq(regulatoryDocuments.state, state.toUpperCase())
      ))
      .orderBy(asc(redFlags.category));

    return result.map(r => r.category);
  }

  /**
   * Get counts by review status for progress display
   */
  async getCountsByStatus(state: StateCode): Promise<ReviewStatusCounts> {
    const result = await this.db
      .select({
        status: redFlags.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(and(
        eq(analyses.isCurrent, true),
        eq(regulatoryDocuments.state, state.toUpperCase())
      ))
      .groupBy(redFlags.reviewStatus);

    // Initialize counts with zeros
    const counts: ReviewStatusCounts = {
      unreviewed: 0,
      confirmed: 0,
      rejected_clear_fp: 0,
      rejected_not_obvious_bad: 0,
      needs_context: 0,
      deferred: 0,
      total: 0,
    };

    // Fill in counts from query results
    for (const row of result) {
      const status = (row.status ?? 'unreviewed') as ReviewStatus;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get paginated red flags with regulation context for review queue
   */
  async getAllPaginated(
    options: RedFlagPaginationOptions
  ): Promise<PaginatedRedFlagsResult> {
    const { state, page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions - always filter by state and current analysis
    const conditions: ReturnType<typeof eq>[] = [
      eq(analyses.isCurrent, true),
      eq(regulatoryDocuments.state, state.toUpperCase()),
    ];

    if (filters) {
      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'unreviewed') {
          // Handle both explicit 'unreviewed' and NULL
          conditions.push(
            or(
              eq(redFlags.reviewStatus, 'unreviewed'),
              isNull(redFlags.reviewStatus)
            )!
          );
        } else {
          conditions.push(eq(redFlags.reviewStatus, filters.status));
        }
      }

      // Severity filter
      if (filters.severity === 'high') {
        conditions.push(gte(redFlags.severity, 7));
      } else if (filters.severity === 'medium') {
        conditions.push(and(gte(redFlags.severity, 4), lt(redFlags.severity, 7))!);
      } else if (filters.severity === 'low') {
        conditions.push(lt(redFlags.severity, 4));
      }

      // Category filter
      if (filters.category) {
        conditions.push(eq(redFlags.category, filters.category));
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Build sort column
    const sortColumn = {
      severity: redFlags.severity,
      category: redFlags.category,
      reviewedAt: redFlags.reviewedAt,
      developerCheckedAt: redFlags.developerCheckedAt,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(redFlags.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context
    const results = await this.db
      .select({
        // Red flag fields
        id: redFlags.id,
        analysisId: redFlags.analysisId,
        category: redFlags.category,
        explanation: redFlags.explanation,
        severity: redFlags.severity,
        complexity: redFlags.complexity,
        matchedPhrases: redFlags.matchedPhrases,
        implementationApproach: redFlags.implementationApproach,
        effortEstimate: redFlags.effortEstimate,
        textExamples: redFlags.textExamples,
        reviewStatus: redFlags.reviewStatus,
        reviewedBy: redFlags.reviewedBy,
        reviewedAt: redFlags.reviewedAt,
        justificationNotes: redFlags.justificationNotes,
        teamNotes: redFlags.teamNotes,
        priority: redFlags.priority,
        impactType: redFlags.impactType,
        // Developer fields
        developerStatus: redFlags.developerStatus,
        developerAssigned: redFlags.developerAssigned,
        developerNotes: redFlags.developerNotes,
        resolutionType: redFlags.resolutionType,
        resolutionComments: redFlags.resolutionComments,
        developerQuestion: redFlags.developerQuestion,
        developerCheckedAt: redFlags.developerCheckedAt,
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationUrl: regulatoryDocuments.url,
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform results to RedFlagWithContext shape
    const data: RedFlagWithContext[] = results.map(row => ({
      id: Number(row.id),
      analysisId: Number(row.analysisId),
      category: row.category,
      explanation: row.explanation,
      severity: row.severity,
      complexity: row.complexity,
      matchedPhrases: row.matchedPhrases,
      implementationApproach: row.implementationApproach,
      effortEstimate: row.effortEstimate,
      textExamples: row.textExamples,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      priority: row.priority,
      impactType: row.impactType,
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        url: row.regulationUrl,
        summary: row.regulationSummary,
        sectionType: row.regulationSectionType,
        hasForm: row.regulationHasForm,
        hasIbr: row.regulationHasIbr,
      },
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update developer tracking fields for a red flag
   */
  async updateDeveloperStatus(id: number, data: UpdateRedFlagDeveloperInput): Promise<RedFlag | undefined> {
    const result = await this.db
      .update(redFlags)
      .set({
        developerStatus: data.developerStatus,
        developerAssigned: data.developerAssigned,
        developerNotes: data.developerNotes ?? null,
        resolutionType: data.resolutionType ?? null,
        resolutionComments: data.resolutionComments ?? null,
        developerQuestion: data.developerQuestion ?? null,
        developerCheckedAt: new Date(),
      })
      .where(eq(redFlags.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get counts by developer status for progress display
   */
  async getDeveloperStatusCounts(state: StateCode): Promise<DeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: redFlags.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(and(
        eq(analyses.isCurrent, true),
        eq(regulatoryDocuments.state, state.toUpperCase()),
        // Only count reviewed items
        ne(redFlags.reviewStatus, 'unreviewed')
      ))
      .groupBy(redFlags.developerStatus);

    // Initialize counts with zeros
    const counts: DeveloperStatusCounts = {
      unresolved: 0,
      resolved: 0,
      pending: 0,
      backlogged: 0,
      need_more_info: 0,
      total: 0,
    };

    // Fill in counts from query results
    for (const row of result) {
      const status = (row.status ?? 'unresolved') as DeveloperStatus;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get paginated reviewed red flags for developer mode
   */
  async getReviewedPaginated(
    options: RedFlagPaginationOptions & {
      developerStatus?: DeveloperStatus | 'all';
      developerAssigned?: Developer;
    }
  ): Promise<PaginatedRedFlagsResult> {
    const { state, page, pageSize, sortBy = 'reviewedAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions - only reviewed items
    const conditions: ReturnType<typeof eq>[] = [
      eq(analyses.isCurrent, true),
      eq(regulatoryDocuments.state, state.toUpperCase()),
      ne(redFlags.reviewStatus, 'unreviewed'),
    ];

    // Developer status filter
    if (developerStatus && developerStatus !== 'all') {
      conditions.push(eq(redFlags.developerStatus, developerStatus));
    }

    // Developer assigned filter
    if (developerAssigned) {
      conditions.push(eq(redFlags.developerAssigned, developerAssigned));
    }

    if (filters) {
      // Status filter
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(redFlags.reviewStatus, filters.status));
      }

      // Severity filter
      if (filters.severity === 'high') {
        conditions.push(gte(redFlags.severity, 7));
      } else if (filters.severity === 'medium') {
        conditions.push(and(gte(redFlags.severity, 4), lt(redFlags.severity, 7))!);
      } else if (filters.severity === 'low') {
        conditions.push(lt(redFlags.severity, 4));
      }

      // Category filter
      if (filters.category) {
        conditions.push(eq(redFlags.category, filters.category));
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Build sort column
    const sortColumn = {
      severity: redFlags.severity,
      category: redFlags.category,
      reviewedAt: redFlags.reviewedAt,
      developerCheckedAt: redFlags.developerCheckedAt,
    }[sortBy] ?? redFlags.reviewedAt;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(redFlags.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context
    const results = await this.db
      .select({
        // Red flag fields
        id: redFlags.id,
        analysisId: redFlags.analysisId,
        category: redFlags.category,
        explanation: redFlags.explanation,
        severity: redFlags.severity,
        complexity: redFlags.complexity,
        matchedPhrases: redFlags.matchedPhrases,
        implementationApproach: redFlags.implementationApproach,
        effortEstimate: redFlags.effortEstimate,
        textExamples: redFlags.textExamples,
        reviewStatus: redFlags.reviewStatus,
        reviewedBy: redFlags.reviewedBy,
        reviewedAt: redFlags.reviewedAt,
        justificationNotes: redFlags.justificationNotes,
        teamNotes: redFlags.teamNotes,
        priority: redFlags.priority,
        impactType: redFlags.impactType,
        // Developer fields
        developerStatus: redFlags.developerStatus,
        developerAssigned: redFlags.developerAssigned,
        developerNotes: redFlags.developerNotes,
        resolutionType: redFlags.resolutionType,
        resolutionComments: redFlags.resolutionComments,
        developerQuestion: redFlags.developerQuestion,
        developerCheckedAt: redFlags.developerCheckedAt,
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationUrl: regulatoryDocuments.url,
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform results to RedFlagWithContext shape
    const data: RedFlagWithContext[] = results.map(row => ({
      id: Number(row.id),
      analysisId: Number(row.analysisId),
      category: row.category,
      explanation: row.explanation,
      severity: row.severity,
      complexity: row.complexity,
      matchedPhrases: row.matchedPhrases,
      implementationApproach: row.implementationApproach,
      effortEstimate: row.effortEstimate,
      textExamples: row.textExamples,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      priority: row.priority,
      impactType: row.impactType,
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        url: row.regulationUrl,
        summary: row.regulationSummary,
        sectionType: row.regulationSectionType,
        hasForm: row.regulationHasForm,
        hasIbr: row.regulationHasIbr,
      },
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get red flags that need more info, with reviewer's items first
   */
  async getNeedMoreInfoFlags(
    state: StateCode,
    options: {
      page: number;
      pageSize: number;
      reviewerName?: string;
    }
  ): Promise<PaginatedRedFlagsResult> {
    const { page, pageSize, reviewerName } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(analyses.isCurrent, true),
      eq(regulatoryDocuments.state, state.toUpperCase()),
      eq(redFlags.developerStatus, 'need_more_info'),
    ];

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Order: reviewer's items first, then by developerCheckedAt desc
    const orderBy = reviewerName
      ? [
          sql`CASE WHEN ${redFlags.reviewedBy} = ${reviewerName} THEN 0 ELSE 1 END`,
          desc(redFlags.developerCheckedAt),
        ]
      : [desc(redFlags.developerCheckedAt)];

    // Get paginated results
    const results = await this.db
      .select({
        id: redFlags.id,
        analysisId: redFlags.analysisId,
        category: redFlags.category,
        explanation: redFlags.explanation,
        severity: redFlags.severity,
        complexity: redFlags.complexity,
        matchedPhrases: redFlags.matchedPhrases,
        implementationApproach: redFlags.implementationApproach,
        effortEstimate: redFlags.effortEstimate,
        textExamples: redFlags.textExamples,
        reviewStatus: redFlags.reviewStatus,
        reviewedBy: redFlags.reviewedBy,
        reviewedAt: redFlags.reviewedAt,
        justificationNotes: redFlags.justificationNotes,
        teamNotes: redFlags.teamNotes,
        priority: redFlags.priority,
        impactType: redFlags.impactType,
        developerStatus: redFlags.developerStatus,
        developerAssigned: redFlags.developerAssigned,
        developerNotes: redFlags.developerNotes,
        resolutionType: redFlags.resolutionType,
        resolutionComments: redFlags.resolutionComments,
        developerQuestion: redFlags.developerQuestion,
        developerCheckedAt: redFlags.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationUrl: regulatoryDocuments.url,
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset);

    const data: RedFlagWithContext[] = results.map(row => ({
      id: Number(row.id),
      analysisId: Number(row.analysisId),
      category: row.category,
      explanation: row.explanation,
      severity: row.severity,
      complexity: row.complexity,
      matchedPhrases: row.matchedPhrases,
      implementationApproach: row.implementationApproach,
      effortEstimate: row.effortEstimate,
      textExamples: row.textExamples,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      priority: row.priority,
      impactType: row.impactType,
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        url: row.regulationUrl,
        summary: row.regulationSummary,
        sectionType: row.regulationSectionType,
        hasForm: row.regulationHasForm,
        hasIbr: row.regulationHasIbr,
      },
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get count of need_more_info flags, optionally filtered by reviewer
   */
  async getNeedMoreInfoCount(state: StateCode, reviewerName?: string): Promise<{ total: number; forReviewer: number }> {
    const baseConditions = [
      eq(analyses.isCurrent, true),
      eq(regulatoryDocuments.state, state.toUpperCase()),
      eq(redFlags.developerStatus, 'need_more_info'),
    ];

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(and(...baseConditions));

    // Get count for specific reviewer
    let forReviewer = 0;
    if (reviewerName) {
      const [{ count: reviewerCount }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(redFlags)
        .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
        .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
        .where(and(...baseConditions, eq(redFlags.reviewedBy, reviewerName)));
      forReviewer = reviewerCount;
    }

    return { total, forReviewer };
  }

  /**
   * Clear all review and developer fields, returning item to unreviewed queue.
   */
  async clearForReview(id: number): Promise<RedFlag | undefined> {
    const result = await this.db
      .update(redFlags)
      .set({
        // Review fields
        reviewStatus: 'unreviewed',
        reviewedBy: null,
        reviewedAt: null,
        justificationNotes: null,
        teamNotes: null,
        priority: null,
        impactType: null,
        // Developer fields
        developerStatus: 'unresolved',
        developerAssigned: null,
        developerNotes: null,
        resolutionType: null,
        resolutionComments: null,
        developerQuestion: null,
        developerCheckedAt: null,
      })
      .where(eq(redFlags.id, id))
      .returning();

    return result[0];
  }
}
