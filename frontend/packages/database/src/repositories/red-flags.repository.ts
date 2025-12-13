import { eq, and, desc, asc, sql, count, gte, lt, or, isNull } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { redFlags, RedFlag, ReviewStatus, ImpactType, REVIEW_STATUSES } from '../schema/red-flags';
import { analyses } from '../schema/analyses';
import { regulatoryDocuments } from '../schema/regulatory-documents';

export interface UpdateRedFlagReviewInput {
  reviewStatus: ReviewStatus;
  reviewedBy: string;
  reviewerNotes?: string;
  priority?: number;
  impactType?: ImpactType;
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
  };
}

export interface RedFlagFilterOptions {
  status?: ReviewStatus | 'all';
  severity?: 'high' | 'medium' | 'low';
  category?: string;
}

export interface RedFlagPaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: 'severity' | 'category' | 'reviewedAt';
  sortOrder?: 'asc' | 'desc';
  filters?: RedFlagFilterOptions;
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
  false_positive: number;
  needs_context: number;
  deferred: number;
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
        reviewerNotes: data.reviewerNotes ?? null,
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
  async getCategories(): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ category: redFlags.category })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .where(eq(analyses.isCurrent, true))
      .orderBy(asc(redFlags.category));

    return result.map(r => r.category);
  }

  /**
   * Get counts by review status for progress display
   */
  async getCountsByStatus(): Promise<ReviewStatusCounts> {
    const result = await this.db
      .select({
        status: redFlags.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .where(eq(analyses.isCurrent, true))
      .groupBy(redFlags.reviewStatus);

    // Initialize counts with zeros
    const counts: ReviewStatusCounts = {
      unreviewed: 0,
      confirmed: 0,
      false_positive: 0,
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
    const { page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(analyses.isCurrent, true),
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
    }[sortBy];

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

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
        reviewerNotes: redFlags.reviewerNotes,
        priority: redFlags.priority,
        impactType: redFlags.impactType,
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationUrl: regulatoryDocuments.url,
      })
      .from(redFlags)
      .innerJoin(analyses, eq(redFlags.analysisId, analyses.id))
      .innerJoin(regulatoryDocuments, eq(analyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(orderByClause)
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
      reviewerNotes: row.reviewerNotes,
      priority: row.priority,
      impactType: row.impactType,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
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
}
