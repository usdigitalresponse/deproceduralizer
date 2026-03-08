import { eq, and, desc, asc, sql, count, gte, lt, or, isNull, isNotNull, ne } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { jenaiIssues, type JenAIIssue } from '../schema/jenai-issues';
import { jenaiAnalyses } from '../schema/jenai-analyses';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { guidanceDocuments } from '../schema/guidance-documents';
import { type JurisdictionCode, normalizeJurisdiction } from '../schema/constants';
import type { SeverityDistribution } from './compliance-issues.repository';

const SEVERITY_HIGH_MIN = 7;
const SEVERITY_MEDIUM_MIN = 4;

export interface JenAIIssueWithContext extends JenAIIssue {
  regulation: {
    id: number;
    title: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    url: string | null;
    summary: string | null;
    sectionType: string | null;
    hasForm: boolean | null;
    hasIbr: boolean | null;
  } | null;
  guidance: {
    id: number;
    title: string | null;
    agency: string | null;
    docType: string | null;
    url: string | null;
    year: number | null;
    datePublished: string | null;
    status: string | null;
    policyCategory: string | null;
    supersedes: string[] | null;
    supersededBy: string | null;
    revisionOf: string | null;
  } | null;
  sourceType: 'regulation' | 'guidance';
}

export type JenAISource = 'regulation' | 'guidance' | 'all';

export interface JenAIFilterOptions {
  jurisdiction: JurisdictionCode;
  status?: string;
  severity?: 'high' | 'medium' | 'low';
  category?: string;
  source?: JenAISource;
}

export interface JenAIPaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt' | 'confidence';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<JenAIFilterOptions, 'jurisdiction'>;
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
  severity?: number;
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
  async getCategories(jurisdiction: JurisdictionCode): Promise<{ category: string; count: number }[]> {
    const result = await this.db
      .select({
        category: jenaiIssues.category,
        count: sql<number>`count(*)::int`,
      })
      .from(jenaiIssues)
      .innerJoin(jenaiAnalyses, eq(jenaiIssues.analysisId, jenaiAnalyses.id))
      .where(eq(jenaiAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .groupBy(jenaiIssues.category)
      .orderBy(asc(jenaiIssues.category));

    return result;
  }

  /**
   * Get counts by review status for progress display
   */
  async getCountsByStatus(jurisdiction: JurisdictionCode): Promise<JenAIReviewStatusCounts> {
    const result = await this.db
      .select({
        status: jenaiIssues.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(jenaiIssues)
      .innerJoin(jenaiAnalyses, eq(jenaiIssues.analysisId, jenaiAnalyses.id))
      .where(eq(jenaiAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)))
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
  async getDeveloperStatusCounts(jurisdiction: JurisdictionCode): Promise<JenAIDeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: jenaiIssues.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(jenaiIssues)
      .innerJoin(jenaiAnalyses, eq(jenaiIssues.analysisId, jenaiAnalyses.id))
      .where(and(
        eq(jenaiAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
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
    const { jurisdiction, page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;

    const conditions: ReturnType<typeof eq>[] = [
      eq(jenaiAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
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

      if (filters.severity) {
        conditions.push(this.buildSeverityCondition(filters.severity));
      }

      if (filters.category) {
        conditions.push(eq(jenaiIssues.category, filters.category));
      }

      if (filters.source && filters.source !== 'all') {
        conditions.push(this.buildSourceCondition(filters.source));
      }
    }

    return this.queryPaginated({ conditions, sortBy, sortOrder, page, pageSize });
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
        ...(data.severity !== undefined ? { severity: data.severity } : {}),
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
   * Reset a JenAI issue back to unreviewed state.
   * Clears all review and developer fields but preserves LLM-assigned severity.
   */
  async resetIssue(id: number): Promise<JenAIIssue | undefined> {
    const result = await this.db
      .update(jenaiIssues)
      .set({
        reviewStatus: 'unreviewed',
        reviewedBy: null,
        reviewedAt: null,
        justificationNotes: null,
        teamNotes: null,
        impactType: null,
        developerStatus: 'unresolved',
        developerAssigned: null,
        developerNotes: null,
        resolutionType: null,
        resolutionComments: null,
        developerQuestion: null,
        developerCheckedAt: null,
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
    const { jurisdiction, page, pageSize, sortBy = 'reviewedAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;

    const conditions: ReturnType<typeof eq>[] = [
      eq(jenaiAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
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

      if (filters.severity) {
        conditions.push(this.buildSeverityCondition(filters.severity));
      }

      if (filters.category) {
        conditions.push(eq(jenaiIssues.category, filters.category));
      }

      if (filters.source && filters.source !== 'all') {
        conditions.push(this.buildSourceCondition(filters.source));
      }
    }

    return this.queryPaginated({
      conditions, sortBy, sortOrder, page, pageSize,
      defaultSortFallback: jenaiIssues.reviewedAt,
    });
  }

  /**
   * Get severity distribution (high/medium/low) for JenAI issues.
   */
  async getSeverityDistribution(jurisdiction: JurisdictionCode): Promise<SeverityDistribution> {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ji.severity >= ${SEVERITY_HIGH_MIN})::int AS "high",
        COUNT(*) FILTER (WHERE ji.severity >= ${SEVERITY_MEDIUM_MIN} AND ji.severity < ${SEVERITY_HIGH_MIN})::int AS "medium",
        COUNT(*) FILTER (WHERE ji.severity >= 1 AND ji.severity < ${SEVERITY_MEDIUM_MIN})::int AS "low",
        COUNT(*)::int AS "total"
      FROM jenai_issues ji
      INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
      WHERE ja.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
    `);

    const row = result.rows[0] as { high: number; medium: number; low: number; total: number };
    return { high: row.high, medium: row.medium, low: row.low, total: row.total };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildSourceCondition(source: JenAISource) {
    return source === 'regulation'
      ? isNotNull(jenaiIssues.documentId)
      : isNotNull(jenaiIssues.guidanceDocumentId);
  }

  private buildSeverityCondition(severity: 'high' | 'medium' | 'low') {
    if (severity === 'high') return gte(jenaiIssues.severity, SEVERITY_HIGH_MIN);
    if (severity === 'medium') return and(gte(jenaiIssues.severity, SEVERITY_MEDIUM_MIN), lt(jenaiIssues.severity, SEVERITY_HIGH_MIN))!;
    return lt(jenaiIssues.severity, SEVERITY_MEDIUM_MIN);
  }

  private issueSelectFields() {
    return {
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
      guidanceDocumentId: jenaiIssues.guidanceDocumentId,
      tags: jenaiIssues.tags,
      isVerbatim: jenaiIssues.isVerbatim,
      createdAt: jenaiIssues.createdAt,
      updatedAt: jenaiIssues.updatedAt,
      // Regulation fields (LEFT JOIN — null for guidance-backed rows)
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
      // Guidance fields (LEFT JOIN — null for regulation-backed rows)
      guidanceId: guidanceDocuments.id,
      guidanceTitle: guidanceDocuments.title,
      guidanceAgency: guidanceDocuments.agency,
      guidanceDocType: guidanceDocuments.docType,
      guidanceUrl: guidanceDocuments.url,
      guidanceYear: guidanceDocuments.year,
      guidanceDatePublished: guidanceDocuments.datePublished,
      guidanceStatus: guidanceDocuments.status,
      guidancePolicyCategory: guidanceDocuments.policyCategory,
      guidanceSupersedes: guidanceDocuments.supersedes,
      guidanceSupersededBy: guidanceDocuments.supersededBy,
      guidanceRevisionOf: guidanceDocuments.revisionOf,
    };
  }

  private async queryPaginated(options: {
    conditions: ReturnType<typeof eq>[];
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    page: number;
    pageSize: number;
    defaultSortFallback?: typeof jenaiIssues.reviewedAt;
  }): Promise<PaginatedJenAIResult> {
    const { conditions, sortBy, sortOrder, page, pageSize, defaultSortFallback } = options;
    const offset = (page - 1) * pageSize;
    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(jenaiIssues)
      .innerJoin(jenaiAnalyses, eq(jenaiIssues.analysisId, jenaiAnalyses.id))
      .where(whereClause);

    const sortColumn = {
      severity: jenaiIssues.severity,
      category: jenaiIssues.category,
      reviewedAt: jenaiIssues.reviewedAt,
      developerCheckedAt: jenaiIssues.developerCheckedAt,
      confidence: jenaiIssues.confidence,
    }[sortBy] ?? defaultSortFallback ?? jenaiIssues.severity;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const results = await this.db
      .select(this.issueSelectFields())
      .from(jenaiIssues)
      .innerJoin(jenaiAnalyses, eq(jenaiIssues.analysisId, jenaiAnalyses.id))
      .leftJoin(regulatoryDocuments, eq(jenaiIssues.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(jenaiIssues.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, asc(jenaiIssues.id))
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map(row => this.mapToIssueWithContext(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private mapToIssueWithContext(row: {
    id: number;
    analysisId: number;
    documentId: number | null;
    category: string;
    explanation: string;
    severity: number;
    complexity: string;
    confidence: number;
    matchedPhrases: string[] | null;
    implementationApproach: string | null;
    effortEstimate: string | null;
    textExamples: string[] | null;
    reviewStatus: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    justificationNotes: string | null;
    teamNotes: string | null;
    priority: number | null;
    impactType: string | null;
    developerStatus: string | null;
    developerAssigned: string | null;
    developerNotes: string | null;
    resolutionType: string | null;
    resolutionComments: string | null;
    developerQuestion: string | null;
    developerCheckedAt: Date | null;
    guidanceDocumentId: number | null;
    tags: string[] | null;
    isVerbatim: boolean | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    regulationId: number | null;
    regulationTitle: string | null;
    regulationNycrrTitle: number | null;
    regulationNycrrPart: string | null;
    regulationNycrrSection: string | null;
    regulationUrl: string | null;
    regulationSummary: string | null;
    regulationSectionType: string | null;
    regulationHasForm: boolean | null;
    regulationHasIbr: boolean | null;
    guidanceId: number | null;
    guidanceTitle: string | null;
    guidanceAgency: string | null;
    guidanceDocType: string | null;
    guidanceUrl: string | null;
    guidanceYear: number | null;
    guidanceDatePublished: string | null;
    guidanceStatus: string | null;
    guidancePolicyCategory: string | null;
    guidanceSupersedes: string[] | null;
    guidanceSupersededBy: string | null;
    guidanceRevisionOf: string | null;
  }): JenAIIssueWithContext {
    const isGuidance = row.guidanceDocumentId !== null;

    return {
      id: Number(row.id),
      analysisId: Number(row.analysisId),
      documentId: row.documentId ? Number(row.documentId) : null,
      category: row.category,
      explanation: row.explanation,
      severity: row.severity,
      complexity: row.complexity,
      confidence: row.confidence,
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
      guidanceDocumentId: row.guidanceDocumentId ?? null,
      tags: row.tags ?? [],
      isVerbatim: row.isVerbatim ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      regulation: row.regulationId !== null
        ? {
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
          }
        : null,
      guidance: isGuidance && row.guidanceId !== null
        ? {
            id: row.guidanceId,
            title: row.guidanceTitle,
            agency: row.guidanceAgency,
            docType: row.guidanceDocType,
            url: row.guidanceUrl,
            year: row.guidanceYear,
            datePublished: row.guidanceDatePublished,
            status: row.guidanceStatus,
            policyCategory: row.guidancePolicyCategory,
            supersedes: row.guidanceSupersedes,
            supersededBy: row.guidanceSupersededBy,
            revisionOf: row.guidanceRevisionOf,
          }
        : null,
      sourceType: isGuidance ? 'guidance' : 'regulation',
    };
  }
}
