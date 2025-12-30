import { eq, and, desc, asc, sql, count, or, isNull, ne, gte, lt } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { complianceIssues, ComplianceIssue, IssueType } from '../schema/compliance-issues';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { ReviewStatus, ImpactType, DeveloperStatus, ResolutionType, Developer } from '../schema/red-flags';
import { StateCode } from '../schema/constants';
import { DeveloperStatusCounts } from './red-flags.repository';

export interface UpdateComplianceIssueReviewInput {
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  justificationNotes?: string;
  teamNotes?: string;
  severity?: number;
  impactType?: string;
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
    // Summary metadata
    summary: string | null;
    sectionType: string | null;
    hasForm: boolean | null;
    hasIbr: boolean | null;
  };
}

export interface ComplianceIssueFilterOptions {
  state: StateCode;
  status?: ReviewStatus | 'all';
  issueType?: IssueType | 'all';
  severity?: 'high' | 'medium' | 'low' | 'all';
  requiredByStatute?: boolean | 'all';
  requirementFound?: boolean | 'all';
}

export interface ComplianceIssuePaginationOptions {
  state: StateCode;
  page: number;
  pageSize: number;
  sortBy?: 'issueType' | 'createdAt' | 'reviewedAt' | 'severity' | 'developerCheckedAt';
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
    // Get current record to check if we need to preserve original severity
    const current = await this.getById(id);
    if (!current) return undefined;

    // Build update data
    const updateData: Partial<ComplianceIssue> = {
      reviewStatus: data.reviewStatus,
      reviewedBy: data.reviewedBy ?? null,
      reviewedAt: new Date(),
      justificationNotes: data.justificationNotes ?? null,
      teamNotes: data.teamNotes ?? null,
      impactType: data.impactType ?? null,
    };

    // If reviewer is changing severity and original hasn't been preserved yet, save it
    if (data.severity !== undefined && current.originalSeverity === null && current.severity !== null) {
      updateData.originalSeverity = current.severity;
    }

    // Update severity if provided
    if (data.severity !== undefined) {
      updateData.severity = data.severity;
    }

    const result = await this.db
      .update(complianceIssues)
      .set(updateData)
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

      // Severity filter (high=7-10, medium=4-6, low=1-3)
      if (filters.severity && filters.severity !== 'all') {
        if (filters.severity === 'high') {
          conditions.push(gte(complianceIssues.severity, 7));
        } else if (filters.severity === 'medium') {
          conditions.push(and(gte(complianceIssues.severity, 4), lt(complianceIssues.severity, 7))!);
        } else if (filters.severity === 'low') {
          conditions.push(lt(complianceIssues.severity, 4));
        }
      }

      // Required by statute filter
      if (filters.requiredByStatute !== undefined && filters.requiredByStatute !== 'all') {
        conditions.push(eq(complianceIssues.requiredByStatute, filters.requiredByStatute));
      }

      // Requirement found filter (LLM confirmation)
      if (filters.requirementFound !== undefined && filters.requirementFound !== 'all') {
        conditions.push(eq(complianceIssues.requirementFound, filters.requirementFound));
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
      severity: complianceIssues.severity,
      developerCheckedAt: complianceIssues.developerCheckedAt,
    }[sortBy] ?? complianceIssues.createdAt;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(complianceIssues.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context
    const results = await this.db
      .select({
        // Compliance issue fields
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        matchedPattern: complianceIssues.matchedPattern,
        matchedContext: complianceIssues.matchedContext,
        url: complianceIssues.url,
        requirementFound: complianceIssues.requirementFound,
        requirementText: complianceIssues.requirementText,
        isVerbatim: complianceIssues.isVerbatim,
        requiredByStatute: complianceIssues.requiredByStatute,
        severity: complianceIssues.severity,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        statuteCitation: complianceIssues.statuteCitation,
        impactAssessment: complianceIssues.impactAssessment,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        originalSeverity: complianceIssues.originalSeverity,
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
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform results to ComplianceIssueWithContext shape
    const data: ComplianceIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      documentId: Number(row.documentId),
      issueType: row.issueType,
      matchedPattern: row.matchedPattern,
      matchedContext: row.matchedContext,
      url: row.url,
      requirementFound: row.requirementFound,
      requirementText: row.requirementText,
      isVerbatim: row.isVerbatim,
      requiredByStatute: row.requiredByStatute,
      severity: row.severity,
      occurrenceNumber: row.occurrenceNumber,
      statuteCitation: row.statuteCitation,
      impactAssessment: row.impactAssessment,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalSeverity: row.originalSeverity,
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
    const { state, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;
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
      severity: complianceIssues.severity,
      developerCheckedAt: complianceIssues.developerCheckedAt,
    }[sortBy] ?? complianceIssues.createdAt;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(complianceIssues.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context
    const results = await this.db
      .select({
        // Compliance issue fields
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        matchedPattern: complianceIssues.matchedPattern,
        matchedContext: complianceIssues.matchedContext,
        url: complianceIssues.url,
        requirementFound: complianceIssues.requirementFound,
        requirementText: complianceIssues.requirementText,
        isVerbatim: complianceIssues.isVerbatim,
        requiredByStatute: complianceIssues.requiredByStatute,
        severity: complianceIssues.severity,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        statuteCitation: complianceIssues.statuteCitation,
        impactAssessment: complianceIssues.impactAssessment,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        originalSeverity: complianceIssues.originalSeverity,
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
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform results to ComplianceIssueWithContext shape
    const data: ComplianceIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      documentId: Number(row.documentId),
      issueType: row.issueType,
      matchedPattern: row.matchedPattern,
      matchedContext: row.matchedContext,
      url: row.url,
      requirementFound: row.requirementFound,
      requirementText: row.requirementText,
      isVerbatim: row.isVerbatim,
      requiredByStatute: row.requiredByStatute,
      severity: row.severity,
      occurrenceNumber: row.occurrenceNumber,
      statuteCitation: row.statuteCitation,
      impactAssessment: row.impactAssessment,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalSeverity: row.originalSeverity,
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
   * Get compliance issues that need more info
   */
  async getNeedMoreInfoIssues(
    state: StateCode,
    options: {
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedComplianceIssuesResult> {
    const { page, pageSize } = options;
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

    // Order by developerCheckedAt desc
    const orderBy = [desc(complianceIssues.developerCheckedAt)];

    // Get paginated results
    const results = await this.db
      .select({
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        matchedPattern: complianceIssues.matchedPattern,
        matchedContext: complianceIssues.matchedContext,
        url: complianceIssues.url,
        requirementFound: complianceIssues.requirementFound,
        requirementText: complianceIssues.requirementText,
        isVerbatim: complianceIssues.isVerbatim,
        requiredByStatute: complianceIssues.requiredByStatute,
        severity: complianceIssues.severity,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        statuteCitation: complianceIssues.statuteCitation,
        impactAssessment: complianceIssues.impactAssessment,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        originalSeverity: complianceIssues.originalSeverity,
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
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
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
      matchedPattern: row.matchedPattern,
      matchedContext: row.matchedContext,
      url: row.url,
      requirementFound: row.requirementFound,
      requirementText: row.requirementText,
      isVerbatim: row.isVerbatim,
      requiredByStatute: row.requiredByStatute,
      severity: row.severity,
      occurrenceNumber: row.occurrenceNumber,
      statuteCitation: row.statuteCitation,
      impactAssessment: row.impactAssessment,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalSeverity: row.originalSeverity,
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
   * Get count of need_more_info issues
   */
  async getNeedMoreInfoCount(state: StateCode): Promise<{ total: number }> {
    const baseConditions = [
      eq(complianceIssues.state, state.toUpperCase()),
      eq(complianceIssues.developerStatus, 'need_more_info'),
    ];

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .where(and(...baseConditions));

    return { total };
  }

  /**
   * Clear all review and developer fields, returning item to unreviewed queue.
   * Restores severity to original value if it was changed.
   */
  async clearForReview(id: number): Promise<ComplianceIssue | undefined> {
    // Get current record to check original severity
    const current = await this.getById(id);
    if (!current) return undefined;

    // Restore severity from originalSeverity if it was changed
    const restoredSeverity = current.originalSeverity ?? current.severity;

    const result = await this.db
      .update(complianceIssues)
      .set({
        // Review fields
        reviewStatus: 'unreviewed',
        reviewedBy: null,
        reviewedAt: null,
        justificationNotes: null,
        teamNotes: null,
        severity: restoredSeverity,
        originalSeverity: null,
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
      .where(eq(complianceIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get a smart batch of compliance issues for suggestion mode.
   * Groups items by the specified grouping mode and returns a batch with metadata.
   */
  async getSuggestionBatch(options: {
    state: StateCode;
    batchSize: number;
    excludeIds: number[];
    groupingMode: 'issue_type' | 'section' | 'combined';
    focus?: {
      issueType?: string;
      section?: string;
      pattern?: string;
    };
    /** Issue types to avoid when selecting a new group (for diversity) */
    recentIssueTypes?: string[];
  }): Promise<{
    data: ComplianceIssueWithContext[];
    groupingMode: 'issue_type' | 'section' | 'combined';
    focus: { issueType?: string; section?: string; pattern?: string };
    remainingInFocus: number;
    nextGroupingMode: 'issue_type' | 'section' | 'combined';
    totalUnreviewed: number;
  }> {
    const { state, batchSize, excludeIds, groupingMode, focus, recentIssueTypes } = options;

    // Base conditions: LLM confirmed + unreviewed + exclude shown IDs
    const baseConditions = [
      eq(complianceIssues.state, state.toUpperCase()),
      eq(complianceIssues.requirementFound, true),
      or(
        eq(complianceIssues.reviewStatus, 'unreviewed'),
        isNull(complianceIssues.reviewStatus)
      )!,
    ];

    // Exclude already-shown IDs
    if (excludeIds.length > 0) {
      baseConditions.push(
        sql`${complianceIssues.id} NOT IN (${sql.raw(excludeIds.join(','))})`
      );
    }

    // Get total unreviewed count (for progress display)
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .where(and(...baseConditions));
    const totalUnreviewed = totalResult?.count ?? 0;

    // Determine the next grouping mode in the cycle
    const modeOrder: Array<'issue_type' | 'section' | 'combined'> = ['issue_type', 'section', 'combined'];
    const currentIndex = modeOrder.indexOf(groupingMode);
    const nextGroupingMode = modeOrder[(currentIndex + 1) % modeOrder.length];

    // If no items left, return empty
    if (totalUnreviewed === 0) {
      return {
        data: [],
        groupingMode,
        focus: {},
        remainingInFocus: 0,
        nextGroupingMode,
        totalUnreviewed: 0,
      };
    }

    // Determine focus based on grouping mode
    let selectedFocus: { issueType?: string; section?: string; pattern?: string } = {};
    let focusConditions = [...baseConditions];

    if (groupingMode === 'issue_type') {
      // Group by issue_type, pick randomly from top groups (weighted by count)
      if (focus?.issueType) {
        selectedFocus.issueType = focus.issueType;
      } else {
        // Build conditions for group selection, excluding recent issue types for diversity
        const groupSelectionConditions = [...baseConditions];
        if (recentIssueTypes && recentIssueTypes.length > 0) {
          groupSelectionConditions.push(
            sql`${complianceIssues.issueType} NOT IN (${sql.raw(recentIssueTypes.map(t => `'${t}'`).join(','))})`
          );
        }

        // Get top 5 issue types by count for random selection
        let typeGroups = await this.db
          .select({
            issueType: complianceIssues.issueType,
            count: sql<number>`count(*)::int`,
          })
          .from(complianceIssues)
          .where(and(...groupSelectionConditions))
          .groupBy(complianceIssues.issueType)
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        // If no results (all types were recent), fall back to any type
        if (typeGroups.length === 0 && recentIssueTypes && recentIssueTypes.length > 0) {
          typeGroups = await this.db
            .select({
              issueType: complianceIssues.issueType,
              count: sql<number>`count(*)::int`,
            })
            .from(complianceIssues)
            .where(and(...baseConditions))
            .groupBy(complianceIssues.issueType)
            .orderBy(desc(sql`count(*)`))
            .limit(5);
        }

        if (typeGroups.length > 0) {
          // Weighted random selection: larger groups have higher probability
          const totalCount = typeGroups.reduce((sum, g) => sum + g.count, 0);
          const random = Math.random() * totalCount;
          let cumulative = 0;
          for (const group of typeGroups) {
            cumulative += group.count;
            if (random <= cumulative) {
              selectedFocus.issueType = group.issueType;
              break;
            }
          }
          // Fallback to first if somehow not selected
          if (!selectedFocus.issueType) {
            selectedFocus.issueType = typeGroups[0].issueType;
          }
        }
      }

      if (selectedFocus.issueType) {
        focusConditions.push(eq(complianceIssues.issueType, selectedFocus.issueType));
      }
    } else if (groupingMode === 'section') {
      // Group by section (using njacTitle or nycrrTitle as section identifier)
      if (focus?.section) {
        selectedFocus.section = focus.section;
      } else {
        // Get top 5 sections by count for random selection
        const sectionGroups = await this.db
          .select({
            section: sql<string>`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`,
            count: sql<number>`count(*)::int`,
          })
          .from(complianceIssues)
          .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
          .where(and(...baseConditions))
          .groupBy(sql`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`)
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        if (sectionGroups.length > 0) {
          // Weighted random selection: larger sections have higher probability
          const validGroups = sectionGroups.filter(g => g.section != null);
          if (validGroups.length > 0) {
            const totalCount = validGroups.reduce((sum, g) => sum + g.count, 0);
            const random = Math.random() * totalCount;
            let cumulative = 0;
            for (const group of validGroups) {
              cumulative += group.count;
              if (random <= cumulative) {
                selectedFocus.section = group.section;
                break;
              }
            }
            // Fallback to first if somehow not selected
            if (!selectedFocus.section) {
              selectedFocus.section = validGroups[0].section;
            }
          }
        }
      }

      if (selectedFocus.section) {
        focusConditions.push(
          or(
            eq(regulatoryDocuments.njacTitle, selectedFocus.section),
            sql`${regulatoryDocuments.nycrrTitle}::text = ${selectedFocus.section}`
          )!
        );
      }
    } else {
      // Combined: group by section + issue_type
      if (focus?.issueType && focus?.section) {
        selectedFocus = { issueType: focus.issueType, section: focus.section };
      } else {
        // Build conditions for group selection, excluding recent issue types for diversity
        const groupSelectionConditions = [...baseConditions];
        if (recentIssueTypes && recentIssueTypes.length > 0) {
          groupSelectionConditions.push(
            sql`${complianceIssues.issueType} NOT IN (${sql.raw(recentIssueTypes.map(t => `'${t}'`).join(','))})`
          );
        }

        // Get top 5 section + issue_type combos for random selection
        let combinedGroups = await this.db
          .select({
            issueType: complianceIssues.issueType,
            section: sql<string>`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`,
            count: sql<number>`count(*)::int`,
          })
          .from(complianceIssues)
          .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
          .where(and(...groupSelectionConditions))
          .groupBy(
            complianceIssues.issueType,
            sql`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`
          )
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        // If no results (all types were recent), fall back to any type
        if (combinedGroups.length === 0 && recentIssueTypes && recentIssueTypes.length > 0) {
          combinedGroups = await this.db
            .select({
              issueType: complianceIssues.issueType,
              section: sql<string>`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`,
              count: sql<number>`count(*)::int`,
            })
            .from(complianceIssues)
            .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
            .where(and(...baseConditions))
            .groupBy(
              complianceIssues.issueType,
              sql`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`
            )
            .orderBy(desc(sql`count(*)`))
            .limit(5);
        }

        if (combinedGroups.length > 0) {
          // Weighted random selection: larger combos have higher probability
          const totalCount = combinedGroups.reduce((sum, g) => sum + g.count, 0);
          const random = Math.random() * totalCount;
          let cumulative = 0;
          for (const group of combinedGroups) {
            cumulative += group.count;
            if (random <= cumulative) {
              selectedFocus = {
                issueType: group.issueType,
                section: group.section ?? undefined,
              };
              break;
            }
          }
          // Fallback to first if somehow not selected
          if (!selectedFocus.issueType) {
            selectedFocus = {
              issueType: combinedGroups[0].issueType,
              section: combinedGroups[0].section ?? undefined,
            };
          }
        }
      }

      if (selectedFocus.issueType) {
        focusConditions.push(eq(complianceIssues.issueType, selectedFocus.issueType));
      }
      if (selectedFocus.section) {
        focusConditions.push(
          or(
            eq(regulatoryDocuments.njacTitle, selectedFocus.section),
            sql`${regulatoryDocuments.nycrrTitle}::text = ${selectedFocus.section}`
          )!
        );
      }
    }

    // Get count of items matching the focus (for "remaining" display)
    const whereClause = and(...focusConditions);
    const [focusCountResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause);
    const remainingInFocus = focusCountResult?.count ?? 0;

    // Get the batch of items
    const results = await this.db
      .select({
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        matchedPattern: complianceIssues.matchedPattern,
        matchedContext: complianceIssues.matchedContext,
        url: complianceIssues.url,
        requirementFound: complianceIssues.requirementFound,
        requirementText: complianceIssues.requirementText,
        isVerbatim: complianceIssues.isVerbatim,
        requiredByStatute: complianceIssues.requiredByStatute,
        severity: complianceIssues.severity,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        statuteCitation: complianceIssues.statuteCitation,
        impactAssessment: complianceIssues.impactAssessment,
        reviewStatus: complianceIssues.reviewStatus,
        reviewedBy: complianceIssues.reviewedBy,
        reviewedAt: complianceIssues.reviewedAt,
        justificationNotes: complianceIssues.justificationNotes,
        teamNotes: complianceIssues.teamNotes,
        originalSeverity: complianceIssues.originalSeverity,
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
        regulationSummary: regulatoryDocuments.summary,
        regulationSectionType: regulatoryDocuments.sectionType,
        regulationHasForm: regulatoryDocuments.hasForm,
        regulationHasIbr: regulatoryDocuments.hasIbr,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      // Order by severity (high first) with random tiebreaker for same-severity items
      .orderBy(desc(complianceIssues.severity), sql`RANDOM()`)
      .limit(batchSize);

    // Transform results to ComplianceIssueWithContext shape
    const data: ComplianceIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      documentId: Number(row.documentId),
      issueType: row.issueType,
      matchedPattern: row.matchedPattern,
      matchedContext: row.matchedContext,
      url: row.url,
      requirementFound: row.requirementFound,
      requirementText: row.requirementText,
      isVerbatim: row.isVerbatim,
      requiredByStatute: row.requiredByStatute,
      severity: row.severity,
      occurrenceNumber: row.occurrenceNumber,
      statuteCitation: row.statuteCitation,
      impactAssessment: row.impactAssessment,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalSeverity: row.originalSeverity,
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
        summary: row.regulationSummary,
        sectionType: row.regulationSectionType,
        hasForm: row.regulationHasForm,
        hasIbr: row.regulationHasIbr,
      },
    }));

    return {
      data,
      groupingMode,
      focus: selectedFocus,
      remainingInFocus,
      nextGroupingMode,
      totalUnreviewed,
    };
  }
}
