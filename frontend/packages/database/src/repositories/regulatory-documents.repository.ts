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
  category?: string; // Filter by red flag category
  summarySearch?: string; // Text search in summary
  explanationSearch?: string; // Text search in explanations
}

// Hierarchy browsing interfaces
export interface HierarchyNode {
  id: number;
  title: string;
  hierarchyLevel: string | null;
  hierarchyPath: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  nycrrSection: string | null;
  // Aggregated data
  hasAnalysis: boolean;
  totalFlags: number;
  maxSeverity: number | null;
  hasDefinitions: boolean;
  childCount: number;
  // Filter-aware counts (when filters applied)
  matchingChildCount: number;      // Direct children matching filter
  matchingDescendantCount: number; // All descendants matching filter
}

export interface HierarchyFilterOptions {
  hasAnalysis?: boolean;
  hasFlags?: boolean;
  severity?: 'high' | 'medium' | 'low';
  hasDefinitions?: boolean;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'maxSeverity' | 'numFlags' | 'title' | 'overallComplexity' | 'hasImplementationIssues' | 'requiresTechnicalReview' | 'hasReportingRequirement' | 'summary';
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
      // Category filter - documents with a red flag of this category
      if (filters.category) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM red_flags rf
            WHERE rf.analysis_id = ${analyses.id}
            AND rf.category = ${filters.category}
          )`
        );
      }
      // Summary text search
      if (filters.summarySearch) {
        conditions.push(ilike(analyses.summary, `%${filters.summarySearch}%`));
      }
      // Explanation text search - search in red_flags explanations
      if (filters.explanationSearch) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM red_flags rf
            WHERE rf.analysis_id = ${analyses.id}
            AND rf.explanation ILIKE ${'%' + filters.explanationSearch + '%'}
          )`
        );
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
      summary: analyses.summary,
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

  // ========================================
  // Hierarchy browsing methods
  // ========================================

  /**
   * Get root-level documents (titles) for the hierarchy tree
   * When filters are applied, only returns titles that have matching descendants
   */
  async getHierarchyRoots(filters?: HierarchyFilterOptions): Promise<HierarchyNode[]> {
    // Build filter conditions for descendants
    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const filterClause = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    // When filters are active, only show titles with matching descendants
    const hasFilters = filterConditions.length > 0;

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        rd.title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        COALESCE(child_stats.has_analysis, false) as "hasAnalysis",
        COALESCE(child_stats.total_flags, 0)::int as "totalFlags",
        child_stats.max_severity as "maxSeverity",
        COALESCE(child_stats.has_definitions, false) as "hasDefinitions",
        COALESCE(total_stats.total_child_count, 0)::int as "childCount",
        COALESCE(child_stats.matching_child_count, 0)::int as "matchingChildCount",
        COALESCE(descendant_stats.matching_descendant_count, 0)::int as "matchingDescendantCount"
      FROM regulatory_documents rd
      -- Total children (unfiltered) for context
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as total_child_count
        FROM regulatory_documents child
        WHERE child.parent_id = rd.id
      ) total_stats ON true
      -- Direct children matching filter
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT child.id)::int as matching_child_count,
          BOOL_OR(a.id IS NOT NULL) as has_analysis,
          SUM(COALESCE(a.num_flags, 0))::int as total_flags,
          MAX(a.max_severity) as max_severity,
          BOOL_OR(EXISTS (
            SELECT 1 FROM definitions d WHERE d.document_id = child.id
          )) as has_definitions
        FROM regulatory_documents child
        LEFT JOIN analyses a ON a.document_id = child.id AND a.is_current = true
        WHERE child.parent_id = rd.id
        ${filterClause}
      ) child_stats ON true
      -- All descendants matching filter (using hierarchy_path)
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT descendant.id)::int as matching_descendant_count
        FROM regulatory_documents descendant
        LEFT JOIN analyses a ON a.document_id = descendant.id AND a.is_current = true
        WHERE descendant.hierarchy_path LIKE rd.hierarchy_path || '.%'
        ${filterClause}
      ) descendant_stats ON true
      WHERE rd.hierarchy_level = 'title'
        ${hasFilters ? sql`AND (child_stats.matching_child_count > 0 OR descendant_stats.matching_descendant_count > 0)` : sql``}
      ORDER BY rd.nycrr_title NULLS LAST, rd.title
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get children of a specific document in the hierarchy
   */
  async getHierarchyChildren(parentId: number, filters?: HierarchyFilterOptions): Promise<HierarchyNode[]> {
    // Build filter conditions
    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const filterClause = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;
    const hasFilters = filterConditions.length > 0;

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        rd.title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        COALESCE(a.id IS NOT NULL, false) as "hasAnalysis",
        COALESCE(a.num_flags, 0)::int as "totalFlags",
        a.max_severity as "maxSeverity",
        EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = rd.id) as "hasDefinitions",
        COALESCE(total_stats.total_child_count, 0)::int as "childCount",
        COALESCE(child_stats.matching_child_count, 0)::int as "matchingChildCount",
        COALESCE(descendant_stats.matching_descendant_count, 0)::int as "matchingDescendantCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      -- Total children (unfiltered)
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as total_child_count
        FROM regulatory_documents grandchild
        WHERE grandchild.parent_id = rd.id
      ) total_stats ON true
      -- Matching direct children
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT grandchild.id)::int as matching_child_count
        FROM regulatory_documents grandchild
        LEFT JOIN analyses ga ON ga.document_id = grandchild.id AND ga.is_current = true
        WHERE grandchild.parent_id = rd.id
        ${filterClause}
      ) child_stats ON true
      -- Matching descendants at any depth
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT descendant.id)::int as matching_descendant_count
        FROM regulatory_documents descendant
        LEFT JOIN analyses da ON da.document_id = descendant.id AND da.is_current = true
        WHERE descendant.hierarchy_path LIKE rd.hierarchy_path || '.%'
        ${filterClause}
      ) descendant_stats ON true
      WHERE rd.parent_id = ${parentId}
      ${filterClause}
      ORDER BY
        rd.nycrr_part::int NULLS LAST,
        rd.nycrr_section NULLS LAST,
        rd.title
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get orphan documents (no parent, but not a title; or null hierarchy_level)
   */
  async getOrphanDocuments(filters?: HierarchyFilterOptions): Promise<HierarchyNode[]> {
    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const filterClause = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        rd.title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        COALESCE(a.id IS NOT NULL, false) as "hasAnalysis",
        COALESCE(a.num_flags, 0)::int as "totalFlags",
        a.max_severity as "maxSeverity",
        EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = rd.id) as "hasDefinitions",
        0 as "childCount",
        0 as "matchingChildCount",
        0 as "matchingDescendantCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      WHERE (
        (rd.parent_id IS NULL AND rd.hierarchy_level IS DISTINCT FROM 'title')
        OR rd.hierarchy_level IS NULL
      )
      ${filterClause}
      ORDER BY
        rd.nycrr_title NULLS LAST,
        rd.nycrr_part NULLS LAST,
        rd.title
      LIMIT 1000
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get hierarchy statistics by level
   */
  async getHierarchyStats(filters?: HierarchyFilterOptions): Promise<{
    level: string;
    count: number;
    analyzedCount: number;
    flaggedCount: number;
  }[]> {
    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const filterClause = filterConditions.length > 0
      ? sql`WHERE ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    const results = await this.db.execute(sql`
      SELECT
        COALESCE(rd.hierarchy_level, 'unlinked') as level,
        COUNT(*)::int as count,
        COUNT(a.id)::int as "analyzedCount",
        COUNT(CASE WHEN a.num_flags > 0 THEN 1 END)::int as "flaggedCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      ${filterClause}
      GROUP BY rd.hierarchy_level
      ORDER BY count DESC
    `);

    return results.rows as unknown as {
      level: string;
      count: number;
      analyzedCount: number;
      flaggedCount: number;
    }[];
  }

  /**
   * Build filter conditions for hierarchy queries
   */
  private buildHierarchyFilterConditions(filters?: HierarchyFilterOptions) {
    const conditions: ReturnType<typeof sql>[] = [];

    if (!filters) return conditions;

    if (filters.hasAnalysis === true) {
      conditions.push(sql`a.id IS NOT NULL`);
    } else if (filters.hasAnalysis === false) {
      conditions.push(sql`a.id IS NULL`);
    }

    if (filters.hasFlags === true) {
      conditions.push(sql`a.num_flags > 0`);
    } else if (filters.hasFlags === false) {
      conditions.push(sql`(a.num_flags = 0 OR a.num_flags IS NULL)`);
    }

    if (filters.severity === 'high') {
      conditions.push(sql`a.max_severity >= 7`);
    } else if (filters.severity === 'medium') {
      conditions.push(sql`a.max_severity >= 4 AND a.max_severity < 7`);
    } else if (filters.severity === 'low') {
      conditions.push(sql`a.max_severity >= 1 AND a.max_severity < 4`);
    }

    if (filters.hasDefinitions === true) {
      conditions.push(sql`EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = rd.id)`);
    } else if (filters.hasDefinitions === false) {
      conditions.push(sql`NOT EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = rd.id)`);
    }

    return conditions;
  }
}
