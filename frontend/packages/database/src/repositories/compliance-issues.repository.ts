import { eq, and, desc, asc, sql, count, or, isNull, ne } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { complianceIssues, ComplianceIssue, IssueType } from '../schema/compliance-issues';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { ReviewStatus, ImpactType, DeveloperStatus, ResolutionType, Developer } from '../schema/red-flags';
import { StateCode } from '../schema/constants';
import { DeveloperStatusCounts } from './red-flags.repository';

export interface UpdateComplianceIssueReviewInput {
  reviewStatus: ReviewStatus;
  reviewedBy: string;
  justificationNotes?: string;
  teamNotes?: string;
  priority?: number;
  impactType?: ImpactType;
}

export interface UpdateComplianceIssueDeveloperInput {
  developerStatus: DeveloperStatus;
  developerAssigned: Developer;
  developerNotes?: string;
  resolutionType?: ResolutionType;
  resolutionComments?: string;
  developerQuestion?: string;
}

export interface ComplianceIssueWithContext extends ComplianceIssue {
  regulation: {
    id: number;
    title: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
    url: string | null;
  };
}

export interface ComplianceIssueFilterOptions {
  state: StateCode;
  status?: ReviewStatus | 'all';
  issueType?: IssueType | 'all';
}

export interface ComplianceIssuePaginationOptions {
  state: StateCode;
  page: number;
  pageSize: number;
  sortBy?: 'issueType' | 'createdAt' | 'reviewedAt';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<ComplianceIssueFilterOptions, 'state'>;
}

export interface PaginatedComplianceIssuesResult {
  data: ComplianceIssueWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ComplianceIssueStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

export interface ComplianceIssueStats {
  total: number;
  byType: Record<string, number>;
  unreviewed: number;
}

export class ComplianceIssuesRepository extends BaseRepository {
  async getById(id: number): Promise<ComplianceIssue | undefined> {
    const result = await this.db
      .select()
      .from(complianceIssues)
      .where(eq(complianceIssues.id, id))
      .limit(1);

    return result[0];
  }

  async getByDocumentId(documentId: number): Promise<ComplianceIssue[]> {
    return this.db
      .select()
      .from(complianceIssues)
      .where(eq(complianceIssues.documentId, documentId))
      .orderBy(asc(complianceIssues.issueType));
  }

  async updateReview(id: number, data: UpdateComplianceIssueReviewInput): Promise<ComplianceIssue | undefined> {
    const result = await this.db
      .update(complianceIssues)
      .set({
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        justificationNotes: data.justificationNotes ?? null,
        teamNotes: data.teamNotes ?? null,
        priority: data.priority ?? null,
        impactType: data.impactType ?? null,
      })
      .where(eq(complianceIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get all unique issue types for filter dropdown
   */
  async getIssueTypes(state: StateCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ issueType: complianceIssues.issueType })
      .from(complianceIssues)
      .where(eq(complianceIssues.state, state.toUpperCase()))
      .orderBy(asc(complianceIssues.issueType));

    return result.map(r => r.issueType);
  }

  /**
   * Get counts by review status for progress display
   */
  async getCountsByStatus(state: StateCode): Promise<ComplianceIssueStatusCounts> {
    const result = await this.db
      .select({
        status: complianceIssues.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .where(eq(complianceIssues.state, state.toUpperCase()))
      .groupBy(complianceIssues.reviewStatus);

    // Initialize counts with zeros
    const counts: ComplianceIssueStatusCounts = {
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
        counts[status as keyof Omit<ComplianceIssueStatusCounts, 'total'>] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get counts by issue type
   */
  async getCountsByType(state: StateCode): Promise<Record<string, number>> {
    const result = await this.db
      .select({
        issueType: complianceIssues.issueType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .where(eq(complianceIssues.state, state.toUpperCase()))
      .groupBy(complianceIssues.issueType);

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.issueType] = row.count;
    }

    return counts;
  }

  /**
   * Get aggregate stats for dashboard
   */
  async getStatsByState(state?: StateCode): Promise<ComplianceIssueStats> {
    const conditions = state
      ? [eq(complianceIssues.state, state.toUpperCase())]
      : [];

    // Get total count
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get unreviewed count
    const [unreviewedResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .where(and(
        ...(conditions.length > 0 ? conditions : []),
        or(
          eq(complianceIssues.reviewStatus, 'unreviewed'),
          isNull(complianceIssues.reviewStatus)
        )
      ));

    // Get counts by type
    const typeResults = await this.db
      .select({
        issueType: complianceIssues.issueType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(complianceIssues.issueType);

    const byType: Record<string, number> = {};
    for (const row of typeResults) {
      byType[row.issueType] = row.count;
    }

    return {
      total: totalResult?.count ?? 0,
      byType,
      unreviewed: unreviewedResult?.count ?? 0,
    };
  }

  /**
   * Get paginated compliance issues with regulation context for review queue
   */
  async getAllPaginated(
    options: ComplianceIssuePaginationOptions
  ): Promise<PaginatedComplianceIssuesResult> {
    const { state, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssues.state, state.toUpperCase()),
    ];

    if (filters) {
      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'unreviewed') {
          conditions.push(
            or(
              eq(complianceIssues.reviewStatus, 'unreviewed'),
              isNull(complianceIssues.reviewStatus)
            )!
          );
        } else {
          conditions.push(eq(complianceIssues.reviewStatus, filters.status));
        }
      }

      // Issue type filter
      if (filters.issueType && filters.issueType !== 'all') {
        conditions.push(eq(complianceIssues.issueType, filters.issueType));
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Build sort column
    const sortColumn = {
      issueType: complianceIssues.issueType,
      createdAt: complianceIssues.createdAt,
      reviewedAt: complianceIssues.reviewedAt,
    }[sortBy];

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get paginated results with regulation context
    const results = await this.db
      .select({
        // Compliance issue fields
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        termMatched: complianceIssues.termMatched,
        context: complianceIssues.context,
        requirementQuote: complianceIssues.requirementQuote,
        fromStatute: complianceIssues.fromStatute,
        statuteCitation: complianceIssues.statuteCitation,
        llmConfirmed: complianceIssues.llmConfirmed,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        priority: complianceIssues.priority,
        impactType: complianceIssues.impactType,
        // Developer fields
        developerStatus: complianceIssues.developerStatus,
        developerAssigned: complianceIssues.developerAssigned,
        developerNotes: complianceIssues.developerNotes,
        resolutionType: complianceIssues.resolutionType,
        resolutionComments: complianceIssues.resolutionComments,
        developerQuestion: complianceIssues.developerQuestion,
        developerCheckedAt: complianceIssues.developerCheckedAt,
        state: complianceIssues.state,
        createdAt: complianceIssues.createdAt,
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationUrl: regulatoryDocuments.url,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    // Transform results to ComplianceIssueWithContext shape
    const data: ComplianceIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      documentId: Number(row.documentId),
      issueType: row.issueType,
      termMatched: row.termMatched,
      context: row.context,
      requirementQuote: row.requirementQuote,
      fromStatute: row.fromStatute,
      statuteCitation: row.statuteCitation,
      llmConfirmed: row.llmConfirmed,
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
      state: row.state,
      createdAt: row.createdAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        url: row.regulationUrl,
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
   * Update developer tracking fields for a compliance issue
   */
  async updateDeveloperStatus(id: number, data: UpdateComplianceIssueDeveloperInput): Promise<ComplianceIssue | undefined> {
    const result = await this.db
      .update(complianceIssues)
      .set({
        developerStatus: data.developerStatus,
        developerAssigned: data.developerAssigned,
        developerNotes: data.developerNotes ?? null,
        resolutionType: data.resolutionType ?? null,
        resolutionComments: data.resolutionComments ?? null,
        developerQuestion: data.developerQuestion ?? null,
        developerCheckedAt: new Date(),
      })
      .where(eq(complianceIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get counts by developer status for progress display
   */
  async getDeveloperStatusCounts(state: StateCode): Promise<DeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: complianceIssues.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .where(and(
        eq(complianceIssues.state, state.toUpperCase()),
        // Only count reviewed items
        ne(complianceIssues.reviewStatus, 'unreviewed')
      ))
      .groupBy(complianceIssues.developerStatus);

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
   * Get paginated reviewed compliance issues for developer mode
   */
  async getReviewedPaginated(
    options: ComplianceIssuePaginationOptions & {
      developerStatus?: DeveloperStatus | 'all';
      developerAssigned?: Developer;
    }
  ): Promise<PaginatedComplianceIssuesResult> {
    const { state, page, pageSize, sortBy = 'reviewedAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions - only reviewed items
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssues.state, state.toUpperCase()),
      ne(complianceIssues.reviewStatus, 'unreviewed'),
    ];

    // Developer status filter
    if (developerStatus && developerStatus !== 'all') {
      conditions.push(eq(complianceIssues.developerStatus, developerStatus));
    }

    // Developer assigned filter
    if (developerAssigned) {
      conditions.push(eq(complianceIssues.developerAssigned, developerAssigned));
    }

    if (filters) {
      // Status filter
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(complianceIssues.reviewStatus, filters.status));
      }

      // Issue type filter
      if (filters.issueType && filters.issueType !== 'all') {
        conditions.push(eq(complianceIssues.issueType, filters.issueType));
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Build sort column
    const sortColumn = {
      issueType: complianceIssues.issueType,
      createdAt: complianceIssues.createdAt,
      reviewedAt: complianceIssues.reviewedAt,
      developerCheckedAt: complianceIssues.developerCheckedAt,
    }[sortBy] ?? complianceIssues.reviewedAt;

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get paginated results with regulation context
    const results = await this.db
      .select({
        // Compliance issue fields
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        termMatched: complianceIssues.termMatched,
        context: complianceIssues.context,
        requirementQuote: complianceIssues.requirementQuote,
        fromStatute: complianceIssues.fromStatute,
        statuteCitation: complianceIssues.statuteCitation,
        llmConfirmed: complianceIssues.llmConfirmed,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        priority: complianceIssues.priority,
        impactType: complianceIssues.impactType,
        // Developer fields
        developerStatus: complianceIssues.developerStatus,
        developerAssigned: complianceIssues.developerAssigned,
        developerNotes: complianceIssues.developerNotes,
        resolutionType: complianceIssues.resolutionType,
        resolutionComments: complianceIssues.resolutionComments,
        developerQuestion: complianceIssues.developerQuestion,
        developerCheckedAt: complianceIssues.developerCheckedAt,
        state: complianceIssues.state,
        createdAt: complianceIssues.createdAt,
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationUrl: regulatoryDocuments.url,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    // Transform results to ComplianceIssueWithContext shape
    const data: ComplianceIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      documentId: Number(row.documentId),
      issueType: row.issueType,
      termMatched: row.termMatched,
      context: row.context,
      requirementQuote: row.requirementQuote,
      fromStatute: row.fromStatute,
      statuteCitation: row.statuteCitation,
      llmConfirmed: row.llmConfirmed,
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
      state: row.state,
      createdAt: row.createdAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        url: row.regulationUrl,
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
   * Get compliance issues that need more info, with reviewer's items first
   */
  async getNeedMoreInfoIssues(
    state: StateCode,
    options: {
      page: number;
      pageSize: number;
      reviewerName?: string;
    }
  ): Promise<PaginatedComplianceIssuesResult> {
    const { page, pageSize, reviewerName } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(complianceIssues.state, state.toUpperCase()),
      eq(complianceIssues.developerStatus, 'need_more_info'),
    ];

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Order: reviewer's items first, then by developerCheckedAt desc
    const orderBy = reviewerName
      ? [
          sql`CASE WHEN ${complianceIssues.reviewedBy} = ${reviewerName} THEN 0 ELSE 1 END`,
          desc(complianceIssues.developerCheckedAt),
        ]
      : [desc(complianceIssues.developerCheckedAt)];

    // Get paginated results
    const results = await this.db
      .select({
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        termMatched: complianceIssues.termMatched,
        context: complianceIssues.context,
        requirementQuote: complianceIssues.requirementQuote,
        fromStatute: complianceIssues.fromStatute,
        statuteCitation: complianceIssues.statuteCitation,
        llmConfirmed: complianceIssues.llmConfirmed,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        priority: complianceIssues.priority,
        impactType: complianceIssues.impactType,
        developerStatus: complianceIssues.developerStatus,
        developerAssigned: complianceIssues.developerAssigned,
        developerNotes: complianceIssues.developerNotes,
        resolutionType: complianceIssues.resolutionType,
        resolutionComments: complianceIssues.resolutionComments,
        developerQuestion: complianceIssues.developerQuestion,
        developerCheckedAt: complianceIssues.developerCheckedAt,
        state: complianceIssues.state,
        createdAt: complianceIssues.createdAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationUrl: regulatoryDocuments.url,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset);

    const data: ComplianceIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      documentId: Number(row.documentId),
      issueType: row.issueType,
      termMatched: row.termMatched,
      context: row.context,
      requirementQuote: row.requirementQuote,
      fromStatute: row.fromStatute,
      statuteCitation: row.statuteCitation,
      llmConfirmed: row.llmConfirmed,
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
      state: row.state,
      createdAt: row.createdAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        url: row.regulationUrl,
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
   * Get count of need_more_info issues, optionally filtered by reviewer
   */
  async getNeedMoreInfoCount(state: StateCode, reviewerName?: string): Promise<{ total: number; forReviewer: number }> {
    const baseConditions = [
      eq(complianceIssues.state, state.toUpperCase()),
      eq(complianceIssues.developerStatus, 'need_more_info'),
    ];

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .where(and(...baseConditions));

    // Get count for specific reviewer
    let forReviewer = 0;
    if (reviewerName) {
      const [{ count: reviewerCount }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(complianceIssues)
        .where(and(...baseConditions, eq(complianceIssues.reviewedBy, reviewerName)));
      forReviewer = reviewerCount;
    }

    return { total, forReviewer };
  }
}
