import { eq, and, desc, asc, sql, count, gte, lt, or, isNull, isNotNull, ne, inArray, type SQL } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { barrierIssues, type BarrierIssue } from '../schema/barrier-issues';
import { barrierAnalyses } from '../schema/barrier-analyses';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { guidanceDocuments } from '../schema/guidance-documents';
import { type JurisdictionCode, normalizeJurisdiction } from '../schema/constants';
import type { SeverityDistribution } from './compliance-issues.repository';

const SEVERITY_HIGH_MIN = 7;
const SEVERITY_MEDIUM_MIN = 4;

export interface BarrierIssueWithContext extends BarrierIssue {
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
    content: string | null;
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

export type BarrierSource = 'regulation' | 'guidance' | 'all';

export interface BarrierFilterOptions {
  jurisdiction: JurisdictionCode;
  status?: string;
  severity?: 'high' | 'medium' | 'low';
  /** Filter by multiple severity levels (multi-select). Takes precedence over severity when provided. */
  severities?: ('high' | 'medium' | 'low')[];
  category?: string;
  /** Filter by multiple categories (multi-select). Takes precedence over category when provided. */
  categories?: string[];
  source?: BarrierSource;
  /** Filter by NYCRR/NJAC part numbers (e.g., ['418', '413']) */
  parts?: string[];
  /** Filter by section types (e.g., ['requirements', 'penalties']) */
  sectionTypes?: string[];
  /** Full-text search over explanation + tags using tsvector */
  search?: string;
  /** Filter by complexity levels (e.g., ['HIGH', 'MEDIUM']) */
  complexities?: string[];
  /** Filter by verbatim flag */
  isVerbatim?: boolean;
}

export interface BarrierPaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'severity' | 'category' | 'reviewedAt' | 'developerCheckedAt' | 'confidence';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<BarrierFilterOptions, 'jurisdiction'>;
}

export interface PaginatedBarrierResult {
  data: BarrierIssueWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BarrierReviewStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

export interface BarrierDeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

export interface BurdenRankingRow {
  analysisId: number;
  documentId: number | null;
  guidanceDocumentId: number | null;
  title: string | null;
  url: string | null;
  source: 'regulation' | 'guidance';
  adjustedBurden: number;
  compositeBurden: number;
  structuralClusterCount: number;
  maxSeverity: number;
  issueCount: number;
  categories: string[];
}

export interface PaginatedBurdenResult {
  data: BurdenRankingRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BurdenRankingOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'adjustedBurden' | 'compositeBurden' | 'maxSeverity' | 'issueCount';
  sortOrder?: 'asc' | 'desc';
  source?: 'regulation' | 'guidance' | 'all';
  /** @deprecated Use severities[] instead */
  minSeverity?: number;
  /** @deprecated Use categories[] instead */
  category?: string;
  severities?: ('high' | 'medium' | 'low')[];
  categories?: string[];
  parts?: string[];
  sectionTypes?: string[];
  search?: string;
}

export interface BurdenOverviewStats {
  totalAnalyzed: number;
  highBurdenCount: number;
  averageBurden: number;
  topStructuralCategory: string | null;
}

export interface UpdateBarrierReviewInput {
  reviewStatus: string;
  reviewedBy: string;
  justificationNotes?: string;
  teamNotes?: string;
  severity?: number;
  impactType?: string;
}

export interface UpdateBarrierDeveloperInput {
  developerStatus: string;
  developerAssigned: string;
  developerNotes?: string;
  resolutionType?: string;
  resolutionComments?: string;
  developerQuestion?: string;
}

export interface BurdenFilterOptions {
  source?: 'regulation' | 'guidance' | 'all';
  /** @deprecated Use severities[] instead */
  minSeverity?: number;
  /** @deprecated Use categories[] instead */
  category?: string;
  severities?: ('high' | 'medium' | 'low')[];
  categories?: string[];
  parts?: string[];
  sectionTypes?: string[];
  search?: string;
}

function sqlTextArrayBurden(values: string[]): SQL {
  return sql`ARRAY[${sql.join(values.map(v => sql`${v}`), sql`, `)}]::text[]`;
}

export function buildBurdenFilterFragments(options: BurdenFilterOptions, jurisdiction?: string) {
  const { source, minSeverity, category, severities, categories, parts, sectionTypes, search } = options;

  const sourceFilter = source === 'regulation' ? sql`AND ja.document_id IS NOT NULL`
    : source === 'guidance' ? sql`AND ja.guidance_document_id IS NOT NULL`
    : sql``;

  // Severity: multi-select takes precedence over legacy minSeverity
  let severityFilter: SQL;
  if (severities && severities.length > 0) {
    const conds: SQL[] = [];
    if (severities.includes('high')) conds.push(sql.raw(`ja.max_severity >= 7`));
    if (severities.includes('medium')) conds.push(sql.raw(`(ja.max_severity >= 4 AND ja.max_severity < 7)`));
    if (severities.includes('low')) conds.push(sql.raw(`(ja.max_severity < 4)`));
    severityFilter = conds.length > 0
      ? sql`AND (${sql.join(conds, sql` OR `)})`
      : sql``;
  } else {
    severityFilter = minSeverity ? sql`AND ja.max_severity >= ${minSeverity}` : sql``;
  }

  // Category: multi-select takes precedence over legacy single category
  let categoryFilter: SQL;
  if (categories && categories.length > 0) {
    categoryFilter = sql`AND EXISTS (SELECT 1 FROM barrier_issues ji2 WHERE ji2.analysis_id = ja.id AND ji2.category = ANY(${sqlTextArrayBurden(categories)}))`;
  } else if (category) {
    categoryFilter = sql`AND EXISTS (SELECT 1 FROM barrier_issues ji2 WHERE ji2.analysis_id = ja.id AND ji2.category = ANY(string_to_array(${category}, ',')))`;
  } else {
    categoryFilter = sql``;
  }

  // Part filter: uses jurisdiction to pick the right column
  let partsFilter: SQL;
  if (parts && parts.length > 0) {
    const partCol = jurisdiction?.toUpperCase() === 'NJ' ? 'rd.njac_part' : 'rd.nycrr_part';
    partsFilter = sql`AND ${sql.raw(partCol)} = ANY(${sqlTextArrayBurden(parts)})`;
  } else {
    partsFilter = sql``;
  }

  // Section type filter
  const sectionTypesFilter = sectionTypes && sectionTypes.length > 0
    ? sql`AND rd.section_type = ANY(${sqlTextArrayBurden(sectionTypes)})`
    : sql``;

  const searchFilter = search
    ? sql`AND (rd.title ILIKE ${'%' + search + '%'} OR gd.title ILIKE ${'%' + search + '%'})`
    : sql``;

  return { sourceFilter, severityFilter, categoryFilter, partsFilter, sectionTypesFilter, searchFilter };
}

export class BarrierRepository extends BaseRepository {
  async getById(id: number): Promise<BarrierIssue | undefined> {
    const result = await this.db
      .select()
      .from(barrierIssues)
      .where(eq(barrierIssues.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Get all unique categories with counts for a given state
   */
  async getCategories(jurisdiction: JurisdictionCode): Promise<{ category: string; count: number }[]> {
    const result = await this.db
      .select({
        category: barrierIssues.category,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .where(eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .groupBy(barrierIssues.category)
      .orderBy(asc(barrierIssues.category));

    return result;
  }

  /**
   * Get distinct part numbers with names and issue counts.
   * Returns nycrrPart/nycrrPartName for NY/NYC or njacPart/njacPartName for NJ.
   */
  async getParts(jurisdiction: JurisdictionCode): Promise<{ part: string; partName: string | null; count: number }[]> {
    const normalized = normalizeJurisdiction(jurisdiction);
    const isNJ = normalized === 'NJ';
    const partCol = isNJ ? regulatoryDocuments.njacPart : regulatoryDocuments.nycrrPart;
    const partNameCol = isNJ ? regulatoryDocuments.njacPartName : regulatoryDocuments.nycrrPartName;

    const result = await this.db
      .select({
        part: sql<string>`${partCol}::text`,
        partName: sql<string | null>`max(${partNameCol})`,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .innerJoin(regulatoryDocuments, eq(barrierIssues.documentId, regulatoryDocuments.id))
      .where(and(
        eq(barrierAnalyses.jurisdiction, normalized),
        isNotNull(partCol),
      ))
      .groupBy(partCol)
      .orderBy(asc(partCol));

    return result;
  }

  /**
   * Get distinct section types with issue counts.
   */
  async getSectionTypes(jurisdiction: JurisdictionCode): Promise<{ sectionType: string; count: number }[]> {
    const result = await this.db
      .select({
        sectionType: regulatoryDocuments.sectionType,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .innerJoin(regulatoryDocuments, eq(barrierIssues.documentId, regulatoryDocuments.id))
      .where(and(
        eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
        isNotNull(regulatoryDocuments.sectionType),
      ))
      .groupBy(regulatoryDocuments.sectionType)
      .orderBy(asc(regulatoryDocuments.sectionType));

    // Filter out null sectionType at runtime (TypeScript doesn't narrow from the SQL isNotNull)
    return result.filter((r): r is { sectionType: string; count: number } => r.sectionType !== null);
  }

  /**
   * Get counts by review status for progress display
   */
  async getCountsByStatus(jurisdiction: JurisdictionCode): Promise<BarrierReviewStatusCounts> {
    const result = await this.db
      .select({
        status: barrierIssues.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .where(eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .groupBy(barrierIssues.reviewStatus);

    const counts: BarrierReviewStatusCounts = {
      unreviewed: 0,
      confirmed: 0,
      rejected_clear_fp: 0,
      rejected_not_obvious_bad: 0,
      needs_context: 0,
      deferred: 0,
      total: 0,
    };

    for (const row of result) {
      const status = (row.status ?? 'unreviewed') as keyof Omit<BarrierReviewStatusCounts, 'total'>;
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
  async getDeveloperStatusCounts(jurisdiction: JurisdictionCode): Promise<BarrierDeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: barrierIssues.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .where(and(
        eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
        ne(barrierIssues.reviewStatus, 'unreviewed')
      ))
      .groupBy(barrierIssues.developerStatus);

    const counts: BarrierDeveloperStatusCounts = {
      unresolved: 0,
      resolved: 0,
      pending: 0,
      backlogged: 0,
      need_more_info: 0,
      total: 0,
    };

    for (const row of result) {
      const status = (row.status ?? 'unresolved') as keyof Omit<BarrierDeveloperStatusCounts, 'total'>;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get paginated Barrier issues with regulation context for review queue
   */
  async getAllPaginated(
    options: BarrierPaginationOptions
  ): Promise<PaginatedBarrierResult> {
    const { jurisdiction, page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;

    const conditions: ReturnType<typeof eq>[] = [
      eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
    ];

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'unreviewed') {
          conditions.push(
            or(
              eq(barrierIssues.reviewStatus, 'unreviewed'),
              isNull(barrierIssues.reviewStatus)
            )!
          );
        } else {
          conditions.push(eq(barrierIssues.reviewStatus, filters.status));
        }
      }

      this.applyCommonFilters(conditions, filters, jurisdiction);
    }

    return this.queryPaginated({
      conditions, sortBy, sortOrder, page, pageSize,
      needsDocJoinsForCount: this.filtersNeedDocJoins(filters),
    });
  }

  /**
   * Update review fields on a Barrier issue
   */
  async updateReview(id: number, data: UpdateBarrierReviewInput): Promise<BarrierIssue | undefined> {
    const result = await this.db
      .update(barrierIssues)
      .set({
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        justificationNotes: data.justificationNotes ?? null,
        teamNotes: data.teamNotes ?? null,
        ...(data.severity !== undefined ? { severity: data.severity } : {}),
        impactType: data.impactType ?? null,
      })
      .where(eq(barrierIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Update developer fields on a Barrier issue
   */
  async updateDeveloperStatus(id: number, data: UpdateBarrierDeveloperInput): Promise<BarrierIssue | undefined> {
    const result = await this.db
      .update(barrierIssues)
      .set({
        developerStatus: data.developerStatus,
        developerAssigned: data.developerAssigned,
        developerNotes: data.developerNotes ?? null,
        resolutionType: data.resolutionType ?? null,
        resolutionComments: data.resolutionComments ?? null,
        developerQuestion: data.developerQuestion ?? null,
        developerCheckedAt: new Date(),
      })
      .where(eq(barrierIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Reset a Barrier issue back to unreviewed state.
   * Clears all review and developer fields but preserves LLM-assigned severity.
   */
  async resetIssue(id: number): Promise<BarrierIssue | undefined> {
    const result = await this.db
      .update(barrierIssues)
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
      .where(eq(barrierIssues.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get paginated reviewed Barrier issues for developer mode
   */
  async getReviewedPaginated(
    options: BarrierPaginationOptions & {
      developerStatus?: string;
      developerAssigned?: string;
    }
  ): Promise<PaginatedBarrierResult> {
    const { jurisdiction, page, pageSize, sortBy = 'reviewedAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;

    const conditions: ReturnType<typeof eq>[] = [
      eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      ne(barrierIssues.reviewStatus, 'unreviewed'),
    ];

    if (developerStatus && developerStatus !== 'all') {
      conditions.push(eq(barrierIssues.developerStatus, developerStatus));
    }

    if (developerAssigned) {
      conditions.push(eq(barrierIssues.developerAssigned, developerAssigned));
    }

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(barrierIssues.reviewStatus, filters.status));
      }

      this.applyCommonFilters(conditions, filters, jurisdiction);
    }

    return this.queryPaginated({
      conditions, sortBy, sortOrder, page, pageSize,
      defaultSortFallback: barrierIssues.reviewedAt,
      needsDocJoinsForCount: this.filtersNeedDocJoins(filters),
    });
  }

  /**
   * Get severity distribution (high/medium/low) for Barrier issues.
   */
  async getSeverityDistribution(jurisdiction: JurisdictionCode): Promise<SeverityDistribution> {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ji.severity >= ${SEVERITY_HIGH_MIN})::int AS "high",
        COUNT(*) FILTER (WHERE ji.severity >= ${SEVERITY_MEDIUM_MIN} AND ji.severity < ${SEVERITY_HIGH_MIN})::int AS "medium",
        COUNT(*) FILTER (WHERE ji.severity >= 1 AND ji.severity < ${SEVERITY_MEDIUM_MIN})::int AS "low",
        COUNT(*)::int AS "total"
      FROM barrier_issues ji
      INNER JOIN barrier_analyses ja ON ji.analysis_id = ja.id
      WHERE ja.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
    `);

    const row = result.rows[0] as { high: number; medium: number; low: number; total: number };
    return { high: row.high, medium: row.medium, low: row.low, total: row.total };
  }

  /**
   * Get ranked documents by composite burden score with filtering and pagination.
   */
  async getBurdenRanking(options: BurdenRankingOptions): Promise<PaginatedBurdenResult> {
    const {
      jurisdiction,
      page,
      pageSize,
      sortBy = 'adjustedBurden',
      sortOrder = 'desc',
      source,
      minSeverity,
      category,
      severities,
      categories,
      parts,
      sectionTypes,
      search,
    } = options;

    const normalized = normalizeJurisdiction(jurisdiction);
    const offset = (page - 1) * pageSize;

    const { sourceFilter, severityFilter, categoryFilter, partsFilter, sectionTypesFilter, searchFilter } =
      buildBurdenFilterFragments({ source, minSeverity, category, severities, categories, parts, sectionTypes, search }, normalized);

    // Sort mapping
    const sortFragment = sortBy === 'maxSeverity' ? sql`r.max_severity`
      : sortBy === 'compositeBurden' ? sql`r.composite_burden`
      : sortBy === 'issueCount' ? sql`r.issue_count`
      : sql`r.adjusted_burden`;
    const dirFragment = sortOrder === 'asc' ? sql`ASC NULLS FIRST` : sql`DESC NULLS LAST`;

    const result = await this.db.execute(sql`
      SELECT r.*, (SELECT COUNT(*)::int FROM (
        SELECT ja.id
        FROM barrier_analyses ja
        LEFT JOIN regulatory_documents rd ON ja.document_id = rd.id
        LEFT JOIN guidance_documents gd ON ja.guidance_document_id = gd.id
        WHERE ja.jurisdiction = ${normalized}
          AND ja.adjusted_burden IS NOT NULL
          ${sourceFilter} ${severityFilter} ${categoryFilter} ${partsFilter} ${sectionTypesFilter} ${searchFilter}
      ) sub) AS total_count
      FROM (
        SELECT
          ja.id AS analysis_id,
          ja.document_id,
          ja.guidance_document_id,
          COALESCE(rd.title, gd.title) AS title,
          COALESCE(rd.url, gd.url) AS url,
          CASE WHEN ja.guidance_document_id IS NOT NULL THEN 'guidance' ELSE 'regulation' END AS source,
          ja.adjusted_burden,
          ja.composite_burden,
          ja.structural_cluster_count,
          ja.max_severity,
          (SELECT COUNT(*)::int FROM barrier_issues ji WHERE ji.analysis_id = ja.id) AS issue_count,
          (SELECT ARRAY_AGG(DISTINCT ji.category ORDER BY ji.category)
           FROM barrier_issues ji WHERE ji.analysis_id = ja.id) AS categories
        FROM barrier_analyses ja
        LEFT JOIN regulatory_documents rd ON ja.document_id = rd.id
        LEFT JOIN guidance_documents gd ON ja.guidance_document_id = gd.id
        WHERE ja.jurisdiction = ${normalized}
          AND ja.adjusted_burden IS NOT NULL
          ${sourceFilter} ${severityFilter} ${categoryFilter} ${partsFilter} ${sectionTypesFilter} ${searchFilter}
      ) r
      ORDER BY ${sortFragment} ${dirFragment}, r.analysis_id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const rows = result.rows as Array<Record<string, unknown>>;
    const total = rows.length > 0 ? (rows[0].total_count as number) : 0;

    const data: BurdenRankingRow[] = rows.map(row => ({
      analysisId: row.analysis_id as number,
      documentId: row.document_id as number | null,
      guidanceDocumentId: row.guidance_document_id as number | null,
      title: row.title as string | null,
      url: row.url as string | null,
      source: row.source as 'regulation' | 'guidance',
      adjustedBurden: row.adjusted_burden as number,
      compositeBurden: row.composite_burden as number,
      structuralClusterCount: row.structural_cluster_count as number,
      maxSeverity: row.max_severity as number,
      issueCount: row.issue_count as number,
      categories: (row.categories as string[]) ?? [],
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
   * Get aggregate overview stats for the burden index page.
   */
  async getBurdenOverviewStats(jurisdiction: JurisdictionCode): Promise<BurdenOverviewStats> {
    const normalized = normalizeJurisdiction(jurisdiction);

    const result = await this.db.execute(sql`
      SELECT
        COUNT(*)::int AS total_analyzed,
        COUNT(*) FILTER (WHERE adjusted_burden > 40)::int AS high_burden_count,
        COALESCE(ROUND(AVG(adjusted_burden)::numeric, 1), 0)::real AS average_burden
      FROM barrier_analyses
      WHERE jurisdiction = ${normalized}
        AND adjusted_burden IS NOT NULL
    `);

    const row = result.rows[0] as {
      total_analyzed: number;
      high_burden_count: number;
      average_burden: number;
    };

    // Find top structural category
    const catResult = await this.db.execute(sql`
      SELECT ji.category, COUNT(*)::int AS cnt
      FROM barrier_issues ji
      INNER JOIN barrier_analyses ja ON ji.analysis_id = ja.id
      WHERE ja.jurisdiction = ${normalized}
        AND ji.category IN ('ADMINISTRATIVE_BURDENS', 'MANDATED_STEPS_NOT_OUTCOMES',
          'REGULATORY_COMPLEXITY', 'ONE_SIZE_FITS_ALL', 'CASCADE_OF_RIGIDITY', 'UNFUNDED_MANDATE')
      GROUP BY ji.category
      ORDER BY cnt DESC
      LIMIT 1
    `);

    const topCat = catResult.rows[0] as { category: string } | undefined;

    return {
      totalAnalyzed: row.total_analyzed,
      highBurdenCount: row.high_burden_count,
      averageBurden: row.average_burden,
      topStructuralCategory: topCat?.category ?? null,
    };
  }

  /**
   * Get individual Barrier issues for a specific document (regulation or guidance).
   * Returns lightweight issue rows without document context (no JOINs).
   */
  async getByDocumentId(
    documentId: number,
    type: 'regulation' | 'guidance'
  ): Promise<BarrierIssue[]> {
    const docFilter = type === 'regulation'
      ? eq(barrierIssues.documentId, documentId)
      : eq(barrierIssues.guidanceDocumentId, documentId);

    return this.db
      .select()
      .from(barrierIssues)
      .where(docFilter)
      .orderBy(desc(barrierIssues.severity), asc(barrierIssues.id))
      .limit(50);
  }

  // ---------------------------------------------------------------------------
  // Analytics queries
  // ---------------------------------------------------------------------------

  /**
   * Get complexity distribution (HIGH/MEDIUM/LOW counts) for analytics.
   */
  async getComplexityDistribution(jurisdiction: JurisdictionCode): Promise<{ complexity: string; count: number }[]> {
    const result = await this.db
      .select({
        complexity: barrierIssues.complexity,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .where(and(
        eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
        isNotNull(barrierIssues.complexity),
      ))
      .groupBy(barrierIssues.complexity)
      .orderBy(asc(barrierIssues.complexity));

    return result.filter((r): r is { complexity: string; count: number } => r.complexity !== null);
  }

  /**
   * Get category × severity matrix for heatmap visualization.
   * Severity is bucketed into High (7+), Medium (4-6), Low (1-3).
   */
  async getCategorySeverityMatrix(jurisdiction: JurisdictionCode): Promise<{ category: string; severityBucket: string; count: number }[]> {
    const result = await this.db.execute(sql`
      SELECT
        ji.category,
        CASE
          WHEN ji.severity >= ${SEVERITY_HIGH_MIN} THEN 'High'
          WHEN ji.severity >= ${SEVERITY_MEDIUM_MIN} THEN 'Medium'
          ELSE 'Low'
        END AS severity_bucket,
        COUNT(*)::int AS count
      FROM barrier_issues ji
      INNER JOIN barrier_analyses ja ON ji.analysis_id = ja.id
      WHERE ja.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
      GROUP BY ji.category, severity_bucket
      ORDER BY ji.category, severity_bucket
    `);

    return (result.rows as { category: string; severity_bucket: string; count: number }[]).map(row => ({
      category: row.category,
      severityBucket: row.severity_bucket,
      count: row.count,
    }));
  }

  /**
   * Get source type breakdown (regulation vs guidance issue counts).
   */
  async getSourceTypeBreakdown(jurisdiction: JurisdictionCode): Promise<{ regulation: number; guidance: number }> {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ji.document_id IS NOT NULL AND ji.guidance_document_id IS NULL)::int AS regulation,
        COUNT(*) FILTER (WHERE ji.guidance_document_id IS NOT NULL)::int AS guidance
      FROM barrier_issues ji
      INNER JOIN barrier_analyses ja ON ji.analysis_id = ja.id
      WHERE ja.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
    `);

    const row = result.rows[0] as { regulation: number; guidance: number };
    return { regulation: row.regulation, guidance: row.guidance };
  }

  /**
   * Get review progress by category (category × review status counts).
   */
  async getReviewProgressByCategory(jurisdiction: JurisdictionCode): Promise<{ category: string; reviewStatus: string; count: number }[]> {
    const result = await this.db
      .select({
        category: barrierIssues.category,
        reviewStatus: sql<string>`COALESCE(${barrierIssues.reviewStatus}, 'unreviewed')`,
        count: sql<number>`count(*)::int`,
      })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .where(eq(barrierAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .groupBy(barrierIssues.category, barrierIssues.reviewStatus)
      .orderBy(asc(barrierIssues.category));

    return result;
  }

  /**
   * Get burden score distribution as histogram buckets (0-10, 10-20, ..., 50+).
   */
  async getBurdenScoreDistribution(jurisdiction: JurisdictionCode): Promise<{ bucket: string; count: number }[]> {
    const result = await this.db.execute(sql`
      SELECT
        CASE
          WHEN adjusted_burden < 10 THEN '0-10'
          WHEN adjusted_burden < 20 THEN '10-20'
          WHEN adjusted_burden < 30 THEN '20-30'
          WHEN adjusted_burden < 40 THEN '30-40'
          WHEN adjusted_burden < 50 THEN '40-50'
          ELSE '50+'
        END AS bucket,
        COUNT(*)::int AS count
      FROM barrier_analyses
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND adjusted_burden IS NOT NULL
      GROUP BY bucket
      ORDER BY MIN(adjusted_burden)
    `);

    return (result.rows as { bucket: string; count: number }[]).map(row => ({
      bucket: row.bucket,
      count: row.count,
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Apply common filter conditions (severity, category, source, part, sectionType).
   * Shared between getAllPaginated and getReviewedPaginated.
   */
  private applyCommonFilters(
    conditions: ReturnType<typeof eq>[],
    filters: Omit<BarrierFilterOptions, 'jurisdiction'>,
    jurisdiction: JurisdictionCode
  ): void {
    // Severity (multi-select takes precedence)
    if (filters.severities && filters.severities.length > 0) {
      const severityConditions = filters.severities.map(s => this.buildSeverityCondition(s));
      conditions.push(or(...severityConditions)!);
    } else if (filters.severity) {
      conditions.push(this.buildSeverityCondition(filters.severity));
    }

    if (filters.categories && filters.categories.length > 0) {
      conditions.push(inArray(barrierIssues.category, filters.categories));
    } else if (filters.category) {
      conditions.push(eq(barrierIssues.category, filters.category));
    }

    if (filters.source && filters.source !== 'all') {
      conditions.push(this.buildSourceCondition(filters.source));
    }

    if (filters.parts && filters.parts.length > 0) {
      conditions.push(this.buildPartCondition(jurisdiction, filters.parts));
    }

    if (filters.sectionTypes && filters.sectionTypes.length > 0) {
      conditions.push(inArray(regulatoryDocuments.sectionType, filters.sectionTypes));
    }

    if (filters.search) {
      conditions.push(
        sql`barrier_issues_search_tsvector(${barrierIssues.explanation}, ${barrierIssues.tags}) @@ plainto_tsquery('english', ${filters.search})`
      );
    }

    if (filters.complexities && filters.complexities.length > 0) {
      conditions.push(inArray(barrierIssues.complexity, filters.complexities));
    }

    if (filters.isVerbatim !== undefined) {
      conditions.push(eq(barrierIssues.isVerbatim, filters.isVerbatim));
    }
  }

  private filtersNeedDocJoins(filters?: Omit<BarrierFilterOptions, 'jurisdiction'>): boolean {
    return Boolean(
      filters?.parts?.length || filters?.sectionTypes?.length
    );
  }

  private buildSourceCondition(source: BarrierSource) {
    return source === 'regulation'
      ? isNotNull(barrierIssues.documentId)
      : isNotNull(barrierIssues.guidanceDocumentId);
  }

  private buildPartCondition(jurisdiction: JurisdictionCode, parts: string[]) {
    const normalized = normalizeJurisdiction(jurisdiction);
    if (normalized === 'NJ') {
      return inArray(regulatoryDocuments.njacPart, parts);
    }
    // NY/NYC: nycrrPart is varchar, direct inArray
    return inArray(regulatoryDocuments.nycrrPart, parts);
  }

  private buildSeverityCondition(severity: 'high' | 'medium' | 'low') {
    if (severity === 'high') return gte(barrierIssues.severity, SEVERITY_HIGH_MIN);
    if (severity === 'medium') return and(gte(barrierIssues.severity, SEVERITY_MEDIUM_MIN), lt(barrierIssues.severity, SEVERITY_HIGH_MIN))!;
    return lt(barrierIssues.severity, SEVERITY_MEDIUM_MIN);
  }

  private issueSelectFields() {
    return {
      id: barrierIssues.id,
      analysisId: barrierIssues.analysisId,
      documentId: barrierIssues.documentId,
      category: barrierIssues.category,
      explanation: barrierIssues.explanation,
      severity: barrierIssues.severity,
      complexity: barrierIssues.complexity,
      confidence: barrierIssues.confidence,
      matchedPhrases: barrierIssues.matchedPhrases,
      implementationApproach: barrierIssues.implementationApproach,
      effortEstimate: barrierIssues.effortEstimate,
      textExamples: barrierIssues.textExamples,
      reviewStatus: barrierIssues.reviewStatus,
      reviewedBy: barrierIssues.reviewedBy,
      reviewedAt: barrierIssues.reviewedAt,
      justificationNotes: barrierIssues.justificationNotes,
      teamNotes: barrierIssues.teamNotes,
      priority: barrierIssues.priority,
      impactType: barrierIssues.impactType,
      developerStatus: barrierIssues.developerStatus,
      developerAssigned: barrierIssues.developerAssigned,
      developerNotes: barrierIssues.developerNotes,
      resolutionType: barrierIssues.resolutionType,
      resolutionComments: barrierIssues.resolutionComments,
      developerQuestion: barrierIssues.developerQuestion,
      developerCheckedAt: barrierIssues.developerCheckedAt,
      guidanceDocumentId: barrierIssues.guidanceDocumentId,
      tags: barrierIssues.tags,
      isVerbatim: barrierIssues.isVerbatim,
      createdAt: barrierIssues.createdAt,
      updatedAt: barrierIssues.updatedAt,
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
      regulationContent: regulatoryDocuments.content,
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
    defaultSortFallback?: typeof barrierIssues.reviewedAt;
    needsDocJoinsForCount?: boolean;
  }): Promise<PaginatedBarrierResult> {
    const { conditions, sortBy, sortOrder, page, pageSize, defaultSortFallback, needsDocJoinsForCount } = options;
    const offset = (page - 1) * pageSize;
    const whereClause = and(...conditions);

    // When part/sectionType filters are active, count query needs doc JOINs
    const countQuery = this.db
      .select({ count: count() })
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id));

    if (needsDocJoinsForCount) {
      countQuery
        .leftJoin(regulatoryDocuments, eq(barrierIssues.documentId, regulatoryDocuments.id))
        .leftJoin(guidanceDocuments, eq(barrierIssues.guidanceDocumentId, guidanceDocuments.id));
    }

    const [{ count: total }] = await countQuery.where(whereClause);

    const sortColumn = {
      severity: barrierIssues.severity,
      category: barrierIssues.category,
      reviewedAt: barrierIssues.reviewedAt,
      developerCheckedAt: barrierIssues.developerCheckedAt,
      confidence: barrierIssues.confidence,
    }[sortBy] ?? defaultSortFallback ?? barrierIssues.severity;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const results = await this.db
      .select(this.issueSelectFields())
      .from(barrierIssues)
      .innerJoin(barrierAnalyses, eq(barrierIssues.analysisId, barrierAnalyses.id))
      .leftJoin(regulatoryDocuments, eq(barrierIssues.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(barrierIssues.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, asc(barrierIssues.id))
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
    regulationContent: string | null;
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
  }): BarrierIssueWithContext {
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
            content: row.regulationContent,
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
