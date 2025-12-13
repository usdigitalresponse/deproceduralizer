import { eq, and, desc, asc, inArray, ilike, or, sql, count } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { regulatoryDocuments, RegulatoryDocument } from '../schema/regulatory-documents';
import { analyses } from '../schema/analyses';
import { redFlags } from '../schema/red-flags';

export interface RegulationWithAnalysis extends RegulatoryDocument {
  hasImplementationIssues: boolean | null;
  overallComplexity: string | null;
  summary: string | null;
  requiresTechnicalReview: boolean | null;
  hasReportingRequirement: boolean | null;
  maxSeverity: number | null;
  numFlags: number | null;
  redFlags: Array<{
    id: number;
    category: string;
    explanation: string;
    severity: number;
    complexity: string;
    matchedPhrases: string[] | null;
    implementationApproach: string;
    effortEstimate: string | null;
    textExamples: string[] | null;
    reviewStatus: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewerNotes: string | null;
    priority: number | null;
    impactType: string | null;
  }>;
  /**
   * Pre-computed display strings for table columns.
   * Computed here in the repository to avoid recalculating on every React render
   * (e.g., during sorting, pagination, filtering in DataTable).
   */
  categories: string;
  explanations: string;
}

export interface FilterOptions {
  severity?: 'high' | 'medium' | 'low' | 'null'; // high=≥7, medium=4-6, low=1-3, null=not analyzed
  complexity?: 'LOW' | 'MEDIUM' | 'MEDIUM-HIGH' | 'HIGH' | 'null';
  hasFlags?: boolean;
  hasImplementationIssues?: boolean | 'null'; // null = not analyzed
  requiresTechnicalReview?: boolean | 'null';
  hasReportingRequirement?: boolean | 'null';
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'maxSeverity' | 'numFlags' | 'title' | 'overallComplexity' | 'hasImplementationIssues' | 'requiresTechnicalReview' | 'hasReportingRequirement';
  sortOrder?: 'asc' | 'desc';
  filters?: FilterOptions;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class RegulatoryDocumentsRepository extends BaseRepository {
  async getAllWithAnalysis(): Promise<RegulationWithAnalysis[]> {
    const results = await this.db
      .select({
        id: regulatoryDocuments.id,
        sourceIndex: regulatoryDocuments.sourceIndex,
        type: regulatoryDocuments.type,
        state: regulatoryDocuments.state,
        title: regulatoryDocuments.title,
        url: regulatoryDocuments.url,
        urlType: regulatoryDocuments.urlType,
        content: regulatoryDocuments.content,
        createdAt: regulatoryDocuments.createdAt,
        parentId: regulatoryDocuments.parentId,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        hierarchyPath: regulatoryDocuments.hierarchyPath,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrSection: regulatoryDocuments.nycrrSection,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
        summary: analyses.summary,
        requiresTechnicalReview: analyses.requiresTechnicalReview,
        hasReportingRequirement: analyses.hasReportingRequirement,
        maxSeverity: analyses.maxSeverity,
        numFlags: analyses.numFlags,
      })
      .from(regulatoryDocuments)
      .leftJoin(
        analyses,
        and(
          eq(analyses.documentId, regulatoryDocuments.id),
          eq(analyses.isCurrent, true)
        )
      )
      .orderBy(desc(analyses.maxSeverity));

    // Get red flags for documents with analysis
    const analysisIds = results
      .filter(r => r.analysisId !== null)
      .map(r => r.analysisId as number);

    const flags = analysisIds.length > 0
      ? await this.db
          .select()
          .from(redFlags)
          .where(inArray(redFlags.analysisId, analysisIds))
      : [];

    const flagsByAnalysis = flags.reduce((acc, flag) => {
      const analysisId = Number(flag.analysisId);
      if (!acc[analysisId]) acc[analysisId] = [];
      acc[analysisId].push(flag);
      return acc;
    }, {} as Record<number, typeof flags>);

    return results.map(row => {
      const rowFlags = row.analysisId
        ? (flagsByAnalysis[Number(row.analysisId)] || []).map(flag => ({
            ...flag,
            id: Number(flag.id),
          }))
        : [];

      return {
        ...row,
        redFlags: rowFlags,
        // Pre-compute display strings to avoid recalculating on every table render
        categories: rowFlags.map(f => f.category).filter(Boolean).join(', '),
        explanations: rowFlags.map(f => f.explanation).filter(Boolean).join(' | '),
      };
    });
  }

  async getAllWithAnalysisPaginated(
    options: PaginationOptions
  ): Promise<PaginatedResult<RegulationWithAnalysis>> {
    const { page, pageSize, search, sortBy = 'maxSeverity', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build conditions array
    const conditions: ReturnType<typeof eq>[] = [];

    // Add search condition if provided
    if (search) {
      conditions.push(
        or(
          ilike(regulatoryDocuments.title, `%${search}%`),
          ilike(analyses.summary, `%${search}%`)
        )!
      );
    }

    // Add filter conditions
    if (filters) {
      // Severity filter with range comparisons
      if (filters.severity !== undefined) {
        if (filters.severity === 'null') {
          conditions.push(sql`${analyses.maxSeverity} IS NULL`);
        } else if (filters.severity === 'high') {
          conditions.push(sql`${analyses.maxSeverity} >= 7`);
        } else if (filters.severity === 'medium') {
          conditions.push(sql`${analyses.maxSeverity} >= 4 AND ${analyses.maxSeverity} < 7`);
        } else if (filters.severity === 'low') {
          conditions.push(sql`${analyses.maxSeverity} >= 1 AND ${analyses.maxSeverity} < 4`);
        }
      }
      // Complexity filter
      if (filters.complexity !== undefined) {
        if (filters.complexity === 'null') {
          conditions.push(sql`${analyses.overallComplexity} IS NULL`);
        } else {
          conditions.push(eq(analyses.overallComplexity, filters.complexity));
        }
      }
      // Flags filter
      if (filters.hasFlags === true) {
        conditions.push(sql`${analyses.numFlags} > 0`);
      } else if (filters.hasFlags === false) {
        conditions.push(
          or(
            sql`${analyses.numFlags} = 0`,
            sql`${analyses.numFlags} IS NULL`
          )!
        );
      }
      // Boolean filters with null support
      if (filters.hasImplementationIssues !== undefined) {
        if (filters.hasImplementationIssues === 'null') {
          conditions.push(sql`${analyses.hasImplementationIssues} IS NULL`);
        } else {
          conditions.push(eq(analyses.hasImplementationIssues, filters.hasImplementationIssues as boolean));
        }
      }
      if (filters.requiresTechnicalReview !== undefined) {
        if (filters.requiresTechnicalReview === 'null') {
          conditions.push(sql`${analyses.requiresTechnicalReview} IS NULL`);
        } else {
          conditions.push(eq(analyses.requiresTechnicalReview, filters.requiresTechnicalReview as boolean));
        }
      }
      if (filters.hasReportingRequirement !== undefined) {
        if (filters.hasReportingRequirement === 'null') {
          conditions.push(sql`${analyses.hasReportingRequirement} IS NULL`);
        } else {
          conditions.push(eq(analyses.hasReportingRequirement, filters.hasReportingRequirement as boolean));
        }
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build the sort order
    const sortColumn = {
      maxSeverity: analyses.maxSeverity,
      numFlags: analyses.numFlags,
      title: regulatoryDocuments.title,
      overallComplexity: analyses.overallComplexity,
      hasImplementationIssues: analyses.hasImplementationIssues,
      requiresTechnicalReview: analyses.requiresTechnicalReview,
      hasReportingRequirement: analyses.hasReportingRequirement,
    }[sortBy];

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get total count for pagination
    const countQuery = this.db
      .select({ count: count() })
      .from(regulatoryDocuments)
      .leftJoin(
        analyses,
        and(
          eq(analyses.documentId, regulatoryDocuments.id),
          eq(analyses.isCurrent, true)
        )
      );

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [{ count: total }] = await countQuery;

    // Get paginated results
    const query = this.db
      .select({
        id: regulatoryDocuments.id,
        sourceIndex: regulatoryDocuments.sourceIndex,
        type: regulatoryDocuments.type,
        state: regulatoryDocuments.state,
        title: regulatoryDocuments.title,
        url: regulatoryDocuments.url,
        urlType: regulatoryDocuments.urlType,
        content: regulatoryDocuments.content,
        createdAt: regulatoryDocuments.createdAt,
        parentId: regulatoryDocuments.parentId,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        hierarchyPath: regulatoryDocuments.hierarchyPath,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrSection: regulatoryDocuments.nycrrSection,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
        summary: analyses.summary,
        requiresTechnicalReview: analyses.requiresTechnicalReview,
        hasReportingRequirement: analyses.hasReportingRequirement,
        maxSeverity: analyses.maxSeverity,
        numFlags: analyses.numFlags,
      })
      .from(regulatoryDocuments)
      .leftJoin(
        analyses,
        and(
          eq(analyses.documentId, regulatoryDocuments.id),
          eq(analyses.isCurrent, true)
        )
      )
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    if (whereClause) {
      query.where(whereClause);
    }

    const results = await query;

    // Get red flags for the current page only
    const analysisIds = results
      .filter(r => r.analysisId !== null)
      .map(r => r.analysisId as number);

    const flags = analysisIds.length > 0
      ? await this.db
          .select()
          .from(redFlags)
          .where(inArray(redFlags.analysisId, analysisIds))
      : [];

    const flagsByAnalysis = flags.reduce((acc, flag) => {
      const analysisId = Number(flag.analysisId);
      if (!acc[analysisId]) acc[analysisId] = [];
      acc[analysisId].push(flag);
      return acc;
    }, {} as Record<number, typeof flags>);

    const data = results.map(row => {
      const rowFlags = row.analysisId
        ? (flagsByAnalysis[Number(row.analysisId)] || []).map(flag => ({
            ...flag,
            id: Number(flag.id),
          }))
        : [];

      return {
        ...row,
        redFlags: rowFlags,
        categories: rowFlags.map(f => f.category).filter(Boolean).join(', '),
        explanations: rowFlags.map(f => f.explanation).filter(Boolean).join(' | '),
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getByIdWithAnalysis(id: number): Promise<RegulationWithAnalysis | null> {
    const results = await this.db
      .select({
        id: regulatoryDocuments.id,
        sourceIndex: regulatoryDocuments.sourceIndex,
        type: regulatoryDocuments.type,
        state: regulatoryDocuments.state,
        title: regulatoryDocuments.title,
        url: regulatoryDocuments.url,
        urlType: regulatoryDocuments.urlType,
        content: regulatoryDocuments.content,
        createdAt: regulatoryDocuments.createdAt,
        parentId: regulatoryDocuments.parentId,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        hierarchyPath: regulatoryDocuments.hierarchyPath,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrSection: regulatoryDocuments.nycrrSection,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
        summary: analyses.summary,
        requiresTechnicalReview: analyses.requiresTechnicalReview,
        hasReportingRequirement: analyses.hasReportingRequirement,
        maxSeverity: analyses.maxSeverity,
        numFlags: analyses.numFlags,
      })
      .from(regulatoryDocuments)
      .leftJoin(
        analyses,
        and(
          eq(analyses.documentId, regulatoryDocuments.id),
          eq(analyses.isCurrent, true)
        )
      )
      .where(eq(regulatoryDocuments.id, id))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];

    // Get red flags for this document
    const flags = row.analysisId
      ? await this.db
          .select()
          .from(redFlags)
          .where(eq(redFlags.analysisId, row.analysisId))
      : [];

    const rowFlags = flags.map(flag => ({
      ...flag,
      id: Number(flag.id),
    }));

    return {
      ...row,
      redFlags: rowFlags,
      categories: rowFlags.map(f => f.category).filter(Boolean).join(', '),
      explanations: rowFlags.map(f => f.explanation).filter(Boolean).join(' | '),
    };
  }

  async getById(id: number): Promise<RegulatoryDocument | undefined> {
    const result = await this.db
      .select()
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.id, id))
      .limit(1);

    return result[0];
  }

  async getBySourceIndex(sourceIndex: number): Promise<RegulatoryDocument | undefined> {
    const result = await this.db
      .select()
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.sourceIndex, sourceIndex))
      .limit(1);

    return result[0];
  }
}
