import { eq, and, desc, asc, sql, count, gte, lt, or, isNull, ne } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { jenaiIssues, type JenAIIssue } from '../schema/jenai-issues';
import { jenaiAnalyses } from '../schema/jenai-analyses';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import type { StateCode } from '../schema/constants';

export interface JenAIIssueWithContext extends JenAIIssue {
  regulation: {
    id: number;
    title: string | null;
    content: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    url: string | null;
    summary: string | null;
    sectionType: string | null;
    hasForm: boolean | null;
    hasIbr: boolean | null;
  };
}

export interface JenAIFilterOptions {
  state: StateCode;
  status?: string;
  severity?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface JenAIPaginationOptions {
  state: StateCode;
  page: number;
  pageSize: number;
  sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt' | 'confidence';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<JenAIFilterOptions, 'state'>;
}

export interface PaginatedJenAIResult {
  data: JenAIIssueWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JenAIReviewStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

export interface JenAIDeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

export interface UpdateJenAIReviewInput {
  reviewStatus: string;
  reviewedBy: string;
  justificationNotes?: string;
  teamNotes?: string;
  priority?: number;
  impactType?: string;
}

export interface UpdateJenAIDeveloperInput {
  developerStatus: string;
  developerAssigned: string;
  developerNotes?: string;
  resolutionType?: string;
  resolutionComments?: string;
  developerQuestion?: string;
}

export class JenAIRepository extends BaseRepository {
  async getById(id: number): Promise<JenAIIssue | undefined> {
    const result = await this.db
      .select()
      .from(jenaiIssues)
      .where(eq(jenaiIssues.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Get all unique categories with counts for a given state
   */
  async getCategories(state: StateCode): Promise<{ category: string; count: number }[]> {
    const result = await this.db
      .select({
        category: jenaiIssues.category,
        count: sql<number>`count(*)::int`,
      })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(eq(regulatoryDocuments.state, state.toUpperCase()))
      .groupBy(jenaiIssues.category)
      .orderBy(asc(jenaiIssues.category));

    return result;
  }

  /**
   * Get counts by review status for progress display
   */
  async getCountsByStatus(state: StateCode): Promise<JenAIReviewStatusCounts> {
    const result = await this.db
      .select({
        status: jenaiIssues.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(eq(regulatoryDocuments.state, state.toUpperCase()))
      .groupBy(jenaiIssues.reviewStatus);

    const counts: JenAIReviewStatusCounts = {
      unreviewed: 0,
      confirmed: 0,
      rejected_clear_fp: 0,
      rejected_not_obvious_bad: 0,
      needs_context: 0,
      deferred: 0,
      total: 0,
    };

    for (const row of result) {
      const status = (row.status ?? 'unreviewed') as keyof Omit<JenAIReviewStatusCounts, 'total'>;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get counts by developer status for progress display
   */
  async getDeveloperStatusCounts(state: StateCode): Promise<JenAIDeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: jenaiIssues.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(and(
        eq(regulatoryDocuments.state, state.toUpperCase()),
        ne(jenaiIssues.reviewStatus, 'unreviewed')
      ))
      .groupBy(jenaiIssues.developerStatus);

    const counts: JenAIDeveloperStatusCounts = {
      unresolved: 0,
      resolved: 0,
      pending: 0,
      backlogged: 0,
      need_more_info: 0,
      total: 0,
    };

    for (const row of result) {
      const status = (row.status ?? 'unresolved') as keyof Omit<JenAIDeveloperStatusCounts, 'total'>;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get paginated JenAI issues with regulation context for review queue
   */
  async getAllPaginated(
    options: JenAIPaginationOptions
  ): Promise<PaginatedJenAIResult> {
    const { state, page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [
      eq(regulatoryDocuments.state, state.toUpperCase()),
    ];

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'unreviewed') {
          conditions.push(
            or(
              eq(jenaiIssues.reviewStatus, 'unreviewed'),
              isNull(jenaiIssues.reviewStatus)
            )!
          );
        } else {
          conditions.push(eq(jenaiIssues.reviewStatus, filters.status));
        }
      }

      if (filters.severity === 'high') {
        conditions.push(gte(jenaiIssues.severity, 7));
      } else if (filters.severity === 'medium') {
        conditions.push(and(gte(jenaiIssues.severity, 4), lt(jenaiIssues.severity, 7))!);
      } else if (filters.severity === 'low') {
        conditions.push(lt(jenaiIssues.severity, 4));
      }

      if (filters.category) {
        conditions.push(eq(jenaiIssues.category, filters.category));
      }
    }

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(whereClause);

    const sortColumn = {
      severity: jenaiIssues.severity,
      category: jenaiIssues.category,
      reviewedAt: jenaiIssues.reviewedAt,
      developerCheckedAt: jenaiIssues.developerCheckedAt,
      confidence: jenaiIssues.confidence,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(jenaiIssues.id);

    const results = await this.db
      .select({
        id: jenaiIssues.id,
        analysisId: jenaiIssues.analysisId,
        documentId: jenaiIssues.documentId,
        category: jenaiIssues.category,
        explanation: jenaiIssues.explanation,
        severity: jenaiIssues.severity,
        complexity: jenaiIssues.complexity,
        confidence: jenaiIssues.confidence,
        matchedPhrases: jenaiIssues.matchedPhrases,
        implementationApproach: jenaiIssues.implementationApproach,
        effortEstimate: jenaiIssues.effortEstimate,
        textExamples: jenaiIssues.textExamples,
        discoveredInTier: jenaiIssues.discoveredInTier,
        confirmedInTier: jenaiIssues.confirmedInTier,
        tier2Revised: jenaiIssues.tier2Revised,
        reviewStatus: jenaiIssues.reviewStatus,
        reviewedBy: jenaiIssues.reviewedBy,
        reviewedAt: jenaiIssues.reviewedAt,
        justificationNotes: jenaiIssues.justificationNotes,
        teamNotes: jenaiIssues.teamNotes,
        priority: jenaiIssues.priority,
        impactType: jenaiIssues.impactType,
        developerStatus: jenaiIssues.developerStatus,
        developerAssigned: jenaiIssues.developerAssigned,
        developerNotes: jenaiIssues.developerNotes,
        resolutionType: jenaiIssues.resolutionType,
        resolutionComments: jenaiIssues.resolutionComments,
        developerQuestion: jenaiIssues.developerQuestion,
        developerCheckedAt: jenaiIssues.developerCheckedAt,
        createdAt: jenaiIssues.createdAt,
        updatedAt: jenaiIssues.updatedAt,
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
        regulationContent: regulatoryDocuments.content,
      })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    const data: JenAIIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      analysisId: Number(row.analysisId),
      documentId: Number(row.documentId),
      category: row.category,
      explanation: row.explanation,
      severity: row.severity,
      complexity: row.complexity,
      confidence: row.confidence,
      matchedPhrases: row.matchedPhrases,
      implementationApproach: row.implementationApproach,
      effortEstimate: row.effortEstimate,
      textExamples: row.textExamples,
      discoveredInTier: row.discoveredInTier,
      confirmedInTier: row.confirmedInTier,
      tier2Revised: row.tier2Revised,
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        content: row.regulationContent,
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
   * Update review fields on a JenAI issue
   */
  async updateReview(id: number, data: UpdateJenAIReviewInput): Promise<JenAIIssue | undefined> {
    const result = await this.db
      .update(jenaiIssues)
      .set({
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        justificationNotes: data.justificationNotes ?? null,
        teamNotes: data.teamNotes ?? null,
        priority: data.priority ?? null,
        impactType: data.impactType ?? null,
      })
      .where(eq(jenaiIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Update developer fields on a JenAI issue
   */
  async updateDeveloperStatus(id: number, data: UpdateJenAIDeveloperInput): Promise<JenAIIssue | undefined> {
    const result = await this.db
      .update(jenaiIssues)
      .set({
        developerStatus: data.developerStatus,
        developerAssigned: data.developerAssigned,
        developerNotes: data.developerNotes ?? null,
        resolutionType: data.resolutionType ?? null,
        resolutionComments: data.resolutionComments ?? null,
        developerQuestion: data.developerQuestion ?? null,
        developerCheckedAt: new Date(),
      })
      .where(eq(jenaiIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get paginated reviewed JenAI issues for developer mode
   */
  async getReviewedPaginated(
    options: JenAIPaginationOptions & {
      developerStatus?: string;
      developerAssigned?: string;
    }
  ): Promise<PaginatedJenAIResult> {
    const { state, page, pageSize, sortBy = 'reviewedAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [
      eq(regulatoryDocuments.state, state.toUpperCase()),
      ne(jenaiIssues.reviewStatus, 'unreviewed'),
    ];

    if (developerStatus && developerStatus !== 'all') {
      conditions.push(eq(jenaiIssues.developerStatus, developerStatus));
    }

    if (developerAssigned) {
      conditions.push(eq(jenaiIssues.developerAssigned, developerAssigned));
    }

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(jenaiIssues.reviewStatus, filters.status));
      }

      if (filters.severity === 'high') {
        conditions.push(gte(jenaiIssues.severity, 7));
      } else if (filters.severity === 'medium') {
        conditions.push(and(gte(jenaiIssues.severity, 4), lt(jenaiIssues.severity, 7))!);
      } else if (filters.severity === 'low') {
        conditions.push(lt(jenaiIssues.severity, 4));
      }

      if (filters.category) {
        conditions.push(eq(jenaiIssues.category, filters.category));
      }
    }

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(whereClause);

    const sortColumn = {
      severity: jenaiIssues.severity,
      category: jenaiIssues.category,
      reviewedAt: jenaiIssues.reviewedAt,
      developerCheckedAt: jenaiIssues.developerCheckedAt,
      confidence: jenaiIssues.confidence,
    }[sortBy] ?? jenaiIssues.reviewedAt;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(jenaiIssues.id);

    const results = await this.db
      .select({
        id: jenaiIssues.id,
        analysisId: jenaiIssues.analysisId,
        documentId: jenaiIssues.documentId,
        category: jenaiIssues.category,
        explanation: jenaiIssues.explanation,
        severity: jenaiIssues.severity,
        complexity: jenaiIssues.complexity,
        confidence: jenaiIssues.confidence,
        matchedPhrases: jenaiIssues.matchedPhrases,
        implementationApproach: jenaiIssues.implementationApproach,
        effortEstimate: jenaiIssues.effortEstimate,
        textExamples: jenaiIssues.textExamples,
        discoveredInTier: jenaiIssues.discoveredInTier,
        confirmedInTier: jenaiIssues.confirmedInTier,
        tier2Revised: jenaiIssues.tier2Revised,
        reviewStatus: jenaiIssues.reviewStatus,
        reviewedBy: jenaiIssues.reviewedBy,
        reviewedAt: jenaiIssues.reviewedAt,
        justificationNotes: jenaiIssues.justificationNotes,
        teamNotes: jenaiIssues.teamNotes,
        priority: jenaiIssues.priority,
        impactType: jenaiIssues.impactType,
        developerStatus: jenaiIssues.developerStatus,
        developerAssigned: jenaiIssues.developerAssigned,
        developerNotes: jenaiIssues.developerNotes,
        resolutionType: jenaiIssues.resolutionType,
        resolutionComments: jenaiIssues.resolutionComments,
        developerQuestion: jenaiIssues.developerQuestion,
        developerCheckedAt: jenaiIssues.developerCheckedAt,
        createdAt: jenaiIssues.createdAt,
        updatedAt: jenaiIssues.updatedAt,
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
        regulationContent: regulatoryDocuments.content,
      })
      .from(jenaiIssues)
      .innerJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    const data: JenAIIssueWithContext[] = results.map(row => ({
      id: Number(row.id),
      analysisId: Number(row.analysisId),
      documentId: Number(row.documentId),
      category: row.category,
      explanation: row.explanation,
      severity: row.severity,
      complexity: row.complexity,
      confidence: row.confidence,
      matchedPhrases: row.matchedPhrases,
      implementationApproach: row.implementationApproach,
      effortEstimate: row.effortEstimate,
      textExamples: row.textExamples,
      discoveredInTier: row.discoveredInTier,
      confirmedInTier: row.confirmedInTier,
      tier2Revised: row.tier2Revised,
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        content: row.regulationContent,
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
}
