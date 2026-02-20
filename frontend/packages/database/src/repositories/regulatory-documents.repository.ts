import { eq, and, desc, asc, inArray, ilike, or, sql, count } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { regulatoryDocuments, RegulatoryDocument } from '../schema/regulatory-documents';
import { analyses } from '../schema/analyses';
import { redFlags } from '../schema/red-flags';
import { complianceIssues } from '../schema/compliance-issues';
import { StateCode, normalizeState } from '../schema/constants';

// content is omitted from list queries for performance, only fetched in getByIdWithAnalysis
export interface RegulationWithAnalysis extends Omit<RegulatoryDocument, 'content'> {
  content?: string | null; // Optional - only present when fetched via getByIdWithAnalysis
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
    justificationNotes: string | null;
    teamNotes: string | null;
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
  // Display-optimized fields
  shortTitle: string | null;
  levelIdentifier: string | null;
  citation: string | null;
  // NYCRR fields
  nycrrTitle: number | null;
  nycrrPart: string | null;
  nycrrSection: string | null;
  nycrrChapter: string | null;
  nycrrSubpart: string | null;
  // NJAC fields
  njacTitle: string | null;
  njacChapter: string | null;
  njacSubchapter: string | null;
  njacSection: string | null;
  state: string | null;
  // Aggregated data
  hasAnalysis: boolean;
  totalFlags: number;
  maxSeverity: number | null;
  hasDefinitions: boolean;
  childCount: number;
  // Compliance issue counts
  complianceIssueCount: number;           // Direct issues on this document
  totalComplianceIssues: number;          // Combined (own + descendants)
  // AI-generated summary metadata
  summary: string | null;
  sectionType: string | null;
  keywords: string[] | null;
  hasForm: boolean | null;
  hasIbr: boolean | null;
  // Cross-reference count
  crossReferenceCount: number;            // Outgoing cross-references from this document
  // Filter-aware counts (when filters applied)
  matchingChildCount: number;      // Direct children matching filter
  matchingDescendantCount: number; // All descendants matching filter
}

export interface HierarchyFilterOptions {
  state: StateCode; // Required - filter by state
  hasAnalysis?: boolean;
  hasFlags?: boolean;
  severity?: 'high' | 'medium' | 'low';
  hasDefinitions?: boolean;
  hasComplianceIssues?: boolean;
  search?: string; // Text search on title
  // AI-generated metadata filters
  sectionType?: string; // Filter by section type category
  hasForm?: boolean; // Filter by has_form flag
  hasIbr?: boolean; // Filter by has_ibr (incorporation by reference) flag
  keyword?: string; // Search within keywords array
}

export interface PaginationOptions {
  state: StateCode; // Required - filter by state
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

export interface RecentActivity {
  newIssues: number;
  issuesReviewed: number;
  flagsReviewed: number;
  documentsAnalyzed: number;
  windowDays: number;
}

export interface DashboardStats {
  totalDocuments: number;
  analyzedDocuments: number;
  documentsWithFlags: number;
  totalFlags: number;
  flagsBySeverity: {
    high: number;   // severity >= 7
    medium: number; // severity 4-6
    low: number;    // severity 1-3
  };
  unreviewedFlags: number;
  complianceIssues: {
    total: number;
    byType: Record<string, number>;
    unreviewed: number;
  };
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
        // content omitted from list queries for performance - fetch via getByIdWithAnalysis
        createdAt: regulatoryDocuments.createdAt,
        parentId: regulatoryDocuments.parentId,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        hierarchyPath: regulatoryDocuments.hierarchyPath,
        // NYCRR columns
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrTitleName: regulatoryDocuments.nycrrTitleName,
        nycrrSubtitle: regulatoryDocuments.nycrrSubtitle,
        nycrrSubtitleName: regulatoryDocuments.nycrrSubtitleName,
        nycrrChapter: regulatoryDocuments.nycrrChapter,
        nycrrChapterName: regulatoryDocuments.nycrrChapterName,
        nycrrSubchapter: regulatoryDocuments.nycrrSubchapter,
        nycrrSubchapterName: regulatoryDocuments.nycrrSubchapterName,
        nycrrArticle: regulatoryDocuments.nycrrArticle,
        nycrrArticleName: regulatoryDocuments.nycrrArticleName,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrPartName: regulatoryDocuments.nycrrPartName,
        nycrrSubpart: regulatoryDocuments.nycrrSubpart,
        nycrrSubpartName: regulatoryDocuments.nycrrSubpartName,
        nycrrSection: regulatoryDocuments.nycrrSection,
        nycrrSectionName: regulatoryDocuments.nycrrSectionName,
        // NJAC columns
        njacTitle: regulatoryDocuments.njacTitle,
        njacTitleName: regulatoryDocuments.njacTitleName,
        njacSubtitle: regulatoryDocuments.njacSubtitle,
        njacSubtitleName: regulatoryDocuments.njacSubtitleName,
        njacChapter: regulatoryDocuments.njacChapter,
        njacChapterName: regulatoryDocuments.njacChapterName,
        njacSubchapter: regulatoryDocuments.njacSubchapter,
        njacSubchapterName: regulatoryDocuments.njacSubchapterName,
        njacArticle: regulatoryDocuments.njacArticle,
        njacArticleName: regulatoryDocuments.njacArticleName,
        njacPart: regulatoryDocuments.njacPart,
        njacPartName: regulatoryDocuments.njacPartName,
        njacSubpart: regulatoryDocuments.njacSubpart,
        njacSubpartName: regulatoryDocuments.njacSubpartName,
        njacSection: regulatoryDocuments.njacSection,
        njacSectionName: regulatoryDocuments.njacSectionName,
        // NJSA columns
        njsaTitle: regulatoryDocuments.njsaTitle,
        njsaTitleName: regulatoryDocuments.njsaTitleName,
        njsaChapter: regulatoryDocuments.njsaChapter,
        njsaSection: regulatoryDocuments.njsaSection,
        njsaSectionName: regulatoryDocuments.njsaSectionName,
        njsaCitation: regulatoryDocuments.njsaCitation,
        // RCNY columns
        rcnyTitle: regulatoryDocuments.rcnyTitle,
        rcnyTitleName: regulatoryDocuments.rcnyTitleName,
        rcnyChapter: regulatoryDocuments.rcnyChapter,
        rcnyChapterName: regulatoryDocuments.rcnyChapterName,
        rcnySection: regulatoryDocuments.rcnySection,
        rcnySectionName: regulatoryDocuments.rcnySectionName,
        // Display-optimized fields
        shortTitle: regulatoryDocuments.shortTitle,
        levelIdentifier: regulatoryDocuments.levelIdentifier,
        citation: regulatoryDocuments.citation,
        scrapedFromUrl: regulatoryDocuments.scrapedFromUrl,
        directChildCount: regulatoryDocuments.directChildCount,
        descendantCount: regulatoryDocuments.descendantCount,
        descendantFlagCount: regulatoryDocuments.descendantFlagCount,
        descendantMaxSeverity: regulatoryDocuments.descendantMaxSeverity,
        hasDescendantAnalysis: regulatoryDocuments.hasDescendantAnalysis,
        complianceIssueCount: regulatoryDocuments.complianceIssueCount,
        descendantComplianceIssueCount: regulatoryDocuments.descendantComplianceIssueCount,
        crossReferenceCount: regulatoryDocuments.crossReferenceCount,
        // Regulatory status
        regulatoryStatus: regulatoryDocuments.regulatoryStatus,
        recodifiedTo: regulatoryDocuments.recodifiedTo,
        // Analysis exclusion
        excludeFromAnalysis: regulatoryDocuments.excludeFromAnalysis,
        excludedAt: regulatoryDocuments.excludedAt,
        excludedBy: regulatoryDocuments.excludedBy,
        excludedReason: regulatoryDocuments.excludedReason,
        // AI-generated summary metadata
        summary: regulatoryDocuments.summary,
        sectionType: regulatoryDocuments.sectionType,
        keywords: regulatoryDocuments.keywords,
        appliesTo: regulatoryDocuments.appliesTo,
        hasForm: regulatoryDocuments.hasForm,
        hasIbr: regulatoryDocuments.hasIbr,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
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
    const { state, page, pageSize, search, sortBy = 'maxSeverity', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build conditions array
    const conditions: ReturnType<typeof eq>[] = [];

    // Always filter by state
    conditions.push(eq(regulatoryDocuments.state, normalizeState(state)));

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
      summary: regulatoryDocuments.summary,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(regulatoryDocuments.id); // Tiebreaker for consistent ordering

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
        // content omitted from list queries for performance - fetch via getByIdWithAnalysis
        createdAt: regulatoryDocuments.createdAt,
        parentId: regulatoryDocuments.parentId,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        hierarchyPath: regulatoryDocuments.hierarchyPath,
        // NYCRR columns
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrTitleName: regulatoryDocuments.nycrrTitleName,
        nycrrSubtitle: regulatoryDocuments.nycrrSubtitle,
        nycrrSubtitleName: regulatoryDocuments.nycrrSubtitleName,
        nycrrChapter: regulatoryDocuments.nycrrChapter,
        nycrrChapterName: regulatoryDocuments.nycrrChapterName,
        nycrrSubchapter: regulatoryDocuments.nycrrSubchapter,
        nycrrSubchapterName: regulatoryDocuments.nycrrSubchapterName,
        nycrrArticle: regulatoryDocuments.nycrrArticle,
        nycrrArticleName: regulatoryDocuments.nycrrArticleName,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrPartName: regulatoryDocuments.nycrrPartName,
        nycrrSubpart: regulatoryDocuments.nycrrSubpart,
        nycrrSubpartName: regulatoryDocuments.nycrrSubpartName,
        nycrrSection: regulatoryDocuments.nycrrSection,
        nycrrSectionName: regulatoryDocuments.nycrrSectionName,
        // NJAC columns
        njacTitle: regulatoryDocuments.njacTitle,
        njacTitleName: regulatoryDocuments.njacTitleName,
        njacSubtitle: regulatoryDocuments.njacSubtitle,
        njacSubtitleName: regulatoryDocuments.njacSubtitleName,
        njacChapter: regulatoryDocuments.njacChapter,
        njacChapterName: regulatoryDocuments.njacChapterName,
        njacSubchapter: regulatoryDocuments.njacSubchapter,
        njacSubchapterName: regulatoryDocuments.njacSubchapterName,
        njacArticle: regulatoryDocuments.njacArticle,
        njacArticleName: regulatoryDocuments.njacArticleName,
        njacPart: regulatoryDocuments.njacPart,
        njacPartName: regulatoryDocuments.njacPartName,
        njacSubpart: regulatoryDocuments.njacSubpart,
        njacSubpartName: regulatoryDocuments.njacSubpartName,
        njacSection: regulatoryDocuments.njacSection,
        njacSectionName: regulatoryDocuments.njacSectionName,
        // NJSA columns
        njsaTitle: regulatoryDocuments.njsaTitle,
        njsaTitleName: regulatoryDocuments.njsaTitleName,
        njsaChapter: regulatoryDocuments.njsaChapter,
        njsaSection: regulatoryDocuments.njsaSection,
        njsaSectionName: regulatoryDocuments.njsaSectionName,
        njsaCitation: regulatoryDocuments.njsaCitation,
        // RCNY columns
        rcnyTitle: regulatoryDocuments.rcnyTitle,
        rcnyTitleName: regulatoryDocuments.rcnyTitleName,
        rcnyChapter: regulatoryDocuments.rcnyChapter,
        rcnyChapterName: regulatoryDocuments.rcnyChapterName,
        rcnySection: regulatoryDocuments.rcnySection,
        rcnySectionName: regulatoryDocuments.rcnySectionName,
        // Display-optimized fields
        shortTitle: regulatoryDocuments.shortTitle,
        levelIdentifier: regulatoryDocuments.levelIdentifier,
        citation: regulatoryDocuments.citation,
        scrapedFromUrl: regulatoryDocuments.scrapedFromUrl,
        directChildCount: regulatoryDocuments.directChildCount,
        descendantCount: regulatoryDocuments.descendantCount,
        descendantFlagCount: regulatoryDocuments.descendantFlagCount,
        descendantMaxSeverity: regulatoryDocuments.descendantMaxSeverity,
        hasDescendantAnalysis: regulatoryDocuments.hasDescendantAnalysis,
        complianceIssueCount: regulatoryDocuments.complianceIssueCount,
        descendantComplianceIssueCount: regulatoryDocuments.descendantComplianceIssueCount,
        crossReferenceCount: regulatoryDocuments.crossReferenceCount,
        // Regulatory status
        regulatoryStatus: regulatoryDocuments.regulatoryStatus,
        recodifiedTo: regulatoryDocuments.recodifiedTo,
        // Analysis exclusion
        excludeFromAnalysis: regulatoryDocuments.excludeFromAnalysis,
        excludedAt: regulatoryDocuments.excludedAt,
        excludedBy: regulatoryDocuments.excludedBy,
        excludedReason: regulatoryDocuments.excludedReason,
        // AI-generated summary metadata
        summary: regulatoryDocuments.summary,
        sectionType: regulatoryDocuments.sectionType,
        keywords: regulatoryDocuments.keywords,
        appliesTo: regulatoryDocuments.appliesTo,
        hasForm: regulatoryDocuments.hasForm,
        hasIbr: regulatoryDocuments.hasIbr,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
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
      .orderBy(primarySort, secondarySort)
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
        // NYCRR columns
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrTitleName: regulatoryDocuments.nycrrTitleName,
        nycrrSubtitle: regulatoryDocuments.nycrrSubtitle,
        nycrrSubtitleName: regulatoryDocuments.nycrrSubtitleName,
        nycrrChapter: regulatoryDocuments.nycrrChapter,
        nycrrChapterName: regulatoryDocuments.nycrrChapterName,
        nycrrSubchapter: regulatoryDocuments.nycrrSubchapter,
        nycrrSubchapterName: regulatoryDocuments.nycrrSubchapterName,
        nycrrArticle: regulatoryDocuments.nycrrArticle,
        nycrrArticleName: regulatoryDocuments.nycrrArticleName,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrPartName: regulatoryDocuments.nycrrPartName,
        nycrrSubpart: regulatoryDocuments.nycrrSubpart,
        nycrrSubpartName: regulatoryDocuments.nycrrSubpartName,
        nycrrSection: regulatoryDocuments.nycrrSection,
        nycrrSectionName: regulatoryDocuments.nycrrSectionName,
        // NJAC columns
        njacTitle: regulatoryDocuments.njacTitle,
        njacTitleName: regulatoryDocuments.njacTitleName,
        njacSubtitle: regulatoryDocuments.njacSubtitle,
        njacSubtitleName: regulatoryDocuments.njacSubtitleName,
        njacChapter: regulatoryDocuments.njacChapter,
        njacChapterName: regulatoryDocuments.njacChapterName,
        njacSubchapter: regulatoryDocuments.njacSubchapter,
        njacSubchapterName: regulatoryDocuments.njacSubchapterName,
        njacArticle: regulatoryDocuments.njacArticle,
        njacArticleName: regulatoryDocuments.njacArticleName,
        njacPart: regulatoryDocuments.njacPart,
        njacPartName: regulatoryDocuments.njacPartName,
        njacSubpart: regulatoryDocuments.njacSubpart,
        njacSubpartName: regulatoryDocuments.njacSubpartName,
        njacSection: regulatoryDocuments.njacSection,
        njacSectionName: regulatoryDocuments.njacSectionName,
        // NJSA columns
        njsaTitle: regulatoryDocuments.njsaTitle,
        njsaTitleName: regulatoryDocuments.njsaTitleName,
        njsaChapter: regulatoryDocuments.njsaChapter,
        njsaSection: regulatoryDocuments.njsaSection,
        njsaSectionName: regulatoryDocuments.njsaSectionName,
        njsaCitation: regulatoryDocuments.njsaCitation,
        // RCNY columns
        rcnyTitle: regulatoryDocuments.rcnyTitle,
        rcnyTitleName: regulatoryDocuments.rcnyTitleName,
        rcnyChapter: regulatoryDocuments.rcnyChapter,
        rcnyChapterName: regulatoryDocuments.rcnyChapterName,
        rcnySection: regulatoryDocuments.rcnySection,
        rcnySectionName: regulatoryDocuments.rcnySectionName,
        // Display-optimized fields
        shortTitle: regulatoryDocuments.shortTitle,
        levelIdentifier: regulatoryDocuments.levelIdentifier,
        citation: regulatoryDocuments.citation,
        scrapedFromUrl: regulatoryDocuments.scrapedFromUrl,
        directChildCount: regulatoryDocuments.directChildCount,
        descendantCount: regulatoryDocuments.descendantCount,
        descendantFlagCount: regulatoryDocuments.descendantFlagCount,
        descendantMaxSeverity: regulatoryDocuments.descendantMaxSeverity,
        hasDescendantAnalysis: regulatoryDocuments.hasDescendantAnalysis,
        complianceIssueCount: regulatoryDocuments.complianceIssueCount,
        descendantComplianceIssueCount: regulatoryDocuments.descendantComplianceIssueCount,
        crossReferenceCount: regulatoryDocuments.crossReferenceCount,
        // Regulatory status
        regulatoryStatus: regulatoryDocuments.regulatoryStatus,
        recodifiedTo: regulatoryDocuments.recodifiedTo,
        // Analysis exclusion fields
        excludeFromAnalysis: regulatoryDocuments.excludeFromAnalysis,
        excludedAt: regulatoryDocuments.excludedAt,
        excludedBy: regulatoryDocuments.excludedBy,
        excludedReason: regulatoryDocuments.excludedReason,
        // AI-generated summary metadata
        summary: regulatoryDocuments.summary,
        sectionType: regulatoryDocuments.sectionType,
        keywords: regulatoryDocuments.keywords,
        appliesTo: regulatoryDocuments.appliesTo,
        hasForm: regulatoryDocuments.hasForm,
        hasIbr: regulatoryDocuments.hasIbr,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
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
  async getHierarchyRoots(filters: HierarchyFilterOptions): Promise<HierarchyNode[]> {
    const { state } = filters;
    const stateUpper = normalizeState(state);

    // Build filter conditions for descendants
    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const filterClause = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    // When filters are active (beyond just state), only show titles with matching descendants
    const hasContentFilters = filterConditions.length > 0;

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        -- Format root titles as "TITLE [number] - [name]"
        CASE
          WHEN rd.state = 'NY' AND rd.nycrr_title IS NOT NULL AND rd.nycrr_title_name IS NOT NULL THEN
            'TITLE ' || rd.nycrr_title || ' - ' || rd.nycrr_title_name
          WHEN rd.state = 'NJ' AND rd.njac_title IS NOT NULL AND rd.njac_title_name IS NOT NULL THEN
            'TITLE ' || rd.njac_title || ' - ' || rd.njac_title_name
          ELSE rd.title
        END as title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.short_title as "shortTitle",
        rd.level_identifier as "levelIdentifier",
        rd.citation as "citation",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        rd.nycrr_chapter as "nycrrChapter",
        rd.nycrr_subpart as "nycrrSubpart",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.njac_section as "njacSection",
        rd.state,
        COALESCE(child_stats.has_analysis, false) as "hasAnalysis",
        COALESCE(child_stats.total_flags, 0)::int as "totalFlags",
        child_stats.max_severity as "maxSeverity",
        COALESCE(child_stats.has_definitions, false) as "hasDefinitions",
        COALESCE(total_stats.total_child_count, 0)::int as "childCount",
        -- Compliance issue counts (not computed in slow path, default to 0)
        0 as "complianceIssueCount",
        0 as "totalComplianceIssues",
        -- Cross-reference count
        COALESCE(rd.cross_reference_count, 0)::int as "crossReferenceCount",
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
        WHERE descendant.hierarchy_path LIKE rd.hierarchy_path || ' > %'
        ${filterClause}
      ) descendant_stats ON true
      WHERE rd.hierarchy_level = 'title'
        AND rd.state = ${stateUpper}
        ${hasContentFilters ? sql`AND (child_stats.matching_child_count > 0 OR descendant_stats.matching_descendant_count > 0)` : sql``}
      ORDER BY
        -- Sort by numeric title, handling alphanumeric NJ titles like "10A"
        COALESCE(rd.nycrr_title, NULLIF(regexp_replace(rd.njac_title, '[^0-9]', '', 'g'), '')::int) NULLS LAST,
        -- Secondary sort by alpha suffix for NJ (e.g., "A" in "10A")
        regexp_replace(rd.njac_title, '[0-9]', '', 'g') NULLS LAST,
        rd.title
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get children of a specific document in the hierarchy
   * When filters are applied, returns children that either:
   * 1. Directly match the filter criteria, OR
   * 2. Have descendants that match (to preserve the path to matching items)
   */
  async getHierarchyChildren(parentId: number, filters: HierarchyFilterOptions): Promise<HierarchyNode[]> {
    // Note: State filtering is implicit through parent - children inherit parent's state
    // Build filter conditions with different aliases for different contexts
    const filterConditionsA = this.buildHierarchyFilterConditions(filters, 'a', 'rd');
    const filterConditionsGa = this.buildHierarchyFilterConditions(filters, 'ga', 'grandchild');
    const filterConditionsDa = this.buildHierarchyFilterConditions(filters, 'da', 'descendant');

    const filterClauseA = filterConditionsA.length > 0
      ? sql`AND ${sql.join(filterConditionsA, sql` AND `)}`
      : sql``;
    const filterClauseGa = filterConditionsGa.length > 0
      ? sql`AND ${sql.join(filterConditionsGa, sql` AND `)}`
      : sql``;
    const filterClauseDa = filterConditionsDa.length > 0
      ? sql`AND ${sql.join(filterConditionsDa, sql` AND `)}`
      : sql``;
    const hasFilters = filterConditionsA.length > 0;

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        rd.title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.short_title as "shortTitle",
        rd.level_identifier as "levelIdentifier",
        rd.citation as "citation",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        rd.nycrr_chapter as "nycrrChapter",
        rd.nycrr_subpart as "nycrrSubpart",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.njac_section as "njacSection",
        rd.state,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
        COALESCE(a.id IS NOT NULL, false) as "hasAnalysis",
        COALESCE(a.num_flags, 0)::int as "totalFlags",
        a.max_severity as "maxSeverity",
        EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = rd.id) as "hasDefinitions",
        COALESCE(total_stats.total_child_count, 0)::int as "childCount",
        -- Compliance issue counts (not computed in slow path, default to 0)
        0 as "complianceIssueCount",
        0 as "totalComplianceIssues",
        -- Cross-reference count
        COALESCE(rd.cross_reference_count, 0)::int as "crossReferenceCount",
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
      -- Matching direct children (grandchildren of original parent)
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT grandchild.id)::int as matching_child_count
        FROM regulatory_documents grandchild
        LEFT JOIN analyses ga ON ga.document_id = grandchild.id AND ga.is_current = true
        WHERE grandchild.parent_id = rd.id
        ${filterClauseGa}
      ) child_stats ON true
      -- Matching descendants at any depth
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT descendant.id)::int as matching_descendant_count
        FROM regulatory_documents descendant
        LEFT JOIN analyses da ON da.document_id = descendant.id AND da.is_current = true
        WHERE descendant.hierarchy_path LIKE rd.hierarchy_path || ' > %'
        ${filterClauseDa}
      ) descendant_stats ON true
      WHERE rd.parent_id = ${parentId}
      ${hasFilters ? sql`AND (
        -- Child directly matches the filter
        (1=1 ${filterClauseA})
        OR
        -- Child has descendants that match the filter
        descendant_stats.matching_descendant_count > 0
      )` : sql``}
      ORDER BY
        natural_sort_num(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_num(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
        natural_sort_num(regexp_replace(rd.title, '^[^0-9]*', '', 'g')) NULLS LAST,
        rd.title NULLS LAST
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get orphan documents (no parent, but not a title; or null hierarchy_level)
   */
  async getOrphanDocuments(filters: HierarchyFilterOptions): Promise<HierarchyNode[]> {
    const { state } = filters;
    const stateUpper = normalizeState(state);

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
        rd.short_title as "shortTitle",
        rd.level_identifier as "levelIdentifier",
        rd.citation as "citation",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        rd.nycrr_chapter as "nycrrChapter",
        rd.nycrr_subpart as "nycrrSubpart",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.njac_section as "njacSection",
        rd.state,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
        COALESCE(a.id IS NOT NULL, false) as "hasAnalysis",
        COALESCE(a.num_flags, 0)::int as "totalFlags",
        a.max_severity as "maxSeverity",
        EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = rd.id) as "hasDefinitions",
        0 as "childCount",
        -- Compliance issue counts (not computed in slow path, default to 0)
        0 as "complianceIssueCount",
        0 as "totalComplianceIssues",
        -- Cross-reference count
        COALESCE(rd.cross_reference_count, 0)::int as "crossReferenceCount",
        0 as "matchingChildCount",
        0 as "matchingDescendantCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      WHERE rd.state = ${stateUpper}
        AND (
          (rd.parent_id IS NULL AND rd.hierarchy_level IS DISTINCT FROM 'title')
          OR rd.hierarchy_level IS NULL
        )
      ${filterClause}
      ORDER BY
        COALESCE(rd.nycrr_title, natural_sort_num(rd.njac_title)) NULLS LAST,
        natural_sort_alpha(rd.njac_title) NULLS LAST,
        natural_sort_num(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_num(regexp_replace(rd.title, '^[^0-9]*', '', 'g')) NULLS LAST,
        rd.title NULLS LAST
      LIMIT 1000
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get hierarchy statistics by level
   */
  async getHierarchyStats(filters: HierarchyFilterOptions): Promise<{
    level: string;
    count: number;
    analyzedCount: number;
    flaggedCount: number;
  }[]> {
    const { state } = filters;
    const stateUpper = normalizeState(state);

    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const additionalFilters = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    const results = await this.db.execute(sql`
      SELECT
        COALESCE(rd.hierarchy_level, 'unlinked') as level,
        COUNT(*)::int as count,
        COUNT(a.id)::int as "analyzedCount",
        COUNT(CASE WHEN a.num_flags > 0 THEN 1 END)::int as "flaggedCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      WHERE rd.state = ${stateUpper}
      ${additionalFilters}
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
   * @param filters - The filter options to apply
   * @param analysisAlias - The SQL alias for the analyses table (default: 'a')
   * @param docAlias - The SQL alias for the regulatory_documents table (default: 'rd')
   */
  private buildHierarchyFilterConditions(
    filters?: HierarchyFilterOptions,
    analysisAlias: string = 'a',
    docAlias: string = 'rd'
  ) {
    const conditions: ReturnType<typeof sql>[] = [];

    if (!filters) return conditions;

    if (filters.hasAnalysis === true) {
      conditions.push(sql.raw(`${analysisAlias}.id IS NOT NULL`));
    } else if (filters.hasAnalysis === false) {
      conditions.push(sql.raw(`${analysisAlias}.id IS NULL`));
    }

    if (filters.hasFlags === true) {
      conditions.push(sql.raw(`${analysisAlias}.num_flags > 0`));
    } else if (filters.hasFlags === false) {
      conditions.push(sql.raw(`(${analysisAlias}.num_flags = 0 OR ${analysisAlias}.num_flags IS NULL)`));
    }

    if (filters.severity === 'high') {
      conditions.push(sql.raw(`${analysisAlias}.max_severity >= 7`));
    } else if (filters.severity === 'medium') {
      conditions.push(sql.raw(`${analysisAlias}.max_severity >= 4 AND ${analysisAlias}.max_severity < 7`));
    } else if (filters.severity === 'low') {
      conditions.push(sql.raw(`${analysisAlias}.max_severity >= 1 AND ${analysisAlias}.max_severity < 4`));
    }

    if (filters.hasDefinitions === true) {
      conditions.push(sql.raw(`EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = ${docAlias}.id)`));
    } else if (filters.hasDefinitions === false) {
      conditions.push(sql.raw(`NOT EXISTS (SELECT 1 FROM definitions d WHERE d.document_id = ${docAlias}.id)`));
    }

    if (filters.hasComplianceIssues === true) {
      // Use precomputed columns to include both direct and descendant compliance issues
      conditions.push(sql.raw(`(COALESCE(${docAlias}.compliance_issue_count, 0) > 0 OR COALESCE(${docAlias}.descendant_compliance_issue_count, 0) > 0)`));
    } else if (filters.hasComplianceIssues === false) {
      conditions.push(sql.raw(`(COALESCE(${docAlias}.compliance_issue_count, 0) = 0 AND COALESCE(${docAlias}.descendant_compliance_issue_count, 0) = 0)`));
    }

    // Text search on title (case-insensitive)
    if (filters.search) {
      // Use parameterized query to prevent SQL injection
      conditions.push(sql`${sql.raw(docAlias)}.title ILIKE ${'%' + filters.search + '%'}`);
    }

    // AI-generated metadata filters
    if (filters.sectionType && filters.sectionType !== 'all') {
      // Use parameterized query to prevent SQL injection
      conditions.push(sql`${sql.raw(docAlias)}.section_type = ${filters.sectionType}`);
    }

    if (filters.hasForm === true) {
      conditions.push(sql.raw(`${docAlias}.has_form = true`));
    } else if (filters.hasForm === false) {
      conditions.push(sql.raw(`(${docAlias}.has_form = false OR ${docAlias}.has_form IS NULL)`));
    }

    if (filters.hasIbr === true) {
      conditions.push(sql.raw(`${docAlias}.has_ibr = true`));
    } else if (filters.hasIbr === false) {
      conditions.push(sql.raw(`(${docAlias}.has_ibr = false OR ${docAlias}.has_ibr IS NULL)`));
    }

    if (filters.keyword) {
      // Search within keywords array using PostgreSQL array contains
      // Use parameterized query to prevent SQL injection
      conditions.push(sql`${filters.keyword} = ANY(${sql.raw(docAlias)}.keywords)`);
    }

    return conditions;
  }

  // ========================================
  // Fast hierarchy methods (using precomputed stats)
  // ========================================

  /**
   * Get root-level titles using precomputed stats (fast)
   * Only returns true root titles (parent_id IS NULL)
   * Uses precomputed descendant stats for instant load
   */
  async getHierarchyRootsFast(state: StateCode): Promise<HierarchyNode[]> {
    const stateUpper = normalizeState(state);

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        -- Format root titles as "TITLE [number] - [name]"
        CASE
          WHEN rd.state = 'NY' AND rd.nycrr_title IS NOT NULL AND rd.nycrr_title_name IS NOT NULL THEN
            'TITLE ' || rd.nycrr_title || ' - ' || rd.nycrr_title_name
          WHEN rd.state = 'NJ' AND rd.njac_title IS NOT NULL AND rd.njac_title_name IS NOT NULL THEN
            'TITLE ' || rd.njac_title || ' - ' || rd.njac_title_name
          ELSE rd.title
        END as title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.short_title as "shortTitle",
        rd.level_identifier as "levelIdentifier",
        rd.citation as "citation",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        rd.nycrr_chapter as "nycrrChapter",
        rd.nycrr_subpart as "nycrrSubpart",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.njac_section as "njacSection",
        rd.state,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
        -- Combine own analysis with precomputed descendant stats
        COALESCE(a.id IS NOT NULL OR rd.has_descendant_analysis, false) as "hasAnalysis",
        (COALESCE(a.num_flags, 0) + COALESCE(rd.descendant_flag_count, 0))::int as "totalFlags",
        GREATEST(a.max_severity, rd.descendant_max_severity) as "maxSeverity",
        false as "hasDefinitions",
        COALESCE(rd.direct_child_count, 0)::int as "childCount",
        -- Compliance issue counts
        COALESCE(rd.compliance_issue_count, 0)::int as "complianceIssueCount",
        (COALESCE(rd.compliance_issue_count, 0) + COALESCE(rd.descendant_compliance_issue_count, 0))::int as "totalComplianceIssues",
        -- Cross-reference count
        COALESCE(rd.cross_reference_count, 0)::int as "crossReferenceCount",
        0 as "matchingChildCount",
        COALESCE(rd.descendant_count, 0)::int as "matchingDescendantCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      WHERE rd.hierarchy_level = 'title'
        AND rd.state = ${stateUpper}
        AND rd.parent_id IS NULL
      ORDER BY
        -- Sort by numeric title, handling alphanumeric NJ titles like "10A"
        COALESCE(rd.nycrr_title, NULLIF(regexp_replace(rd.njac_title, '[^0-9]', '', 'g'), '')::int) NULLS LAST,
        -- Secondary sort by alpha suffix for NJ (e.g., "A" in "10A")
        regexp_replace(rd.njac_title, '[0-9]', '', 'g') NULLS LAST,
        rd.title
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get children using precomputed stats (fast)
   * Uses precomputed descendant stats for instant child load
   */
  async getHierarchyChildrenFast(parentId: number): Promise<HierarchyNode[]> {
    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        rd.title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.hierarchy_path as "hierarchyPath",
        rd.short_title as "shortTitle",
        rd.level_identifier as "levelIdentifier",
        rd.citation as "citation",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        rd.nycrr_chapter as "nycrrChapter",
        rd.nycrr_subpart as "nycrrSubpart",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.njac_section as "njacSection",
        rd.state,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
        -- Combine own analysis with precomputed descendant stats
        COALESCE(a.id IS NOT NULL OR rd.has_descendant_analysis, false) as "hasAnalysis",
        (COALESCE(a.num_flags, 0) + COALESCE(rd.descendant_flag_count, 0))::int as "totalFlags",
        GREATEST(a.max_severity, rd.descendant_max_severity) as "maxSeverity",
        false as "hasDefinitions",
        COALESCE(rd.direct_child_count, 0)::int as "childCount",
        -- Compliance issue counts
        COALESCE(rd.compliance_issue_count, 0)::int as "complianceIssueCount",
        (COALESCE(rd.compliance_issue_count, 0) + COALESCE(rd.descendant_compliance_issue_count, 0))::int as "totalComplianceIssues",
        -- Cross-reference count
        COALESCE(rd.cross_reference_count, 0)::int as "crossReferenceCount",
        0 as "matchingChildCount",
        COALESCE(rd.descendant_count, 0)::int as "matchingDescendantCount"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      WHERE rd.parent_id = ${parentId}
      ORDER BY
        natural_sort_num(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_num(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
        natural_sort_num(regexp_replace(rd.title, '^[^0-9]*', '', 'g')) NULLS LAST,
        rd.title NULLS LAST
    `);

    return results.rows as unknown as HierarchyNode[];
  }

  /**
   * Get direct children of a document
   * Returns basic info about children for display in detail views
   */
  async getDirectChildren(parentId: number): Promise<{
    id: number;
    title: string;
    hierarchyLevel: string | null;
    shortTitle: string | null;
    summary: string | null;
    levelIdentifier: string | null;
    citation: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrChapter: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
    state: string | null;
    hasAnalysis: boolean;
    maxSeverity: number | null;
    numFlags: number;
  }[]> {
    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        rd.title,
        rd.hierarchy_level as "hierarchyLevel",
        rd.short_title as "shortTitle",
        rd.summary,
        rd.level_identifier as "levelIdentifier",
        rd.citation as "citation",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_chapter as "nycrrChapter",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.state,
        COALESCE(a.id IS NOT NULL, false) as "hasAnalysis",
        a.max_severity as "maxSeverity",
        COALESCE(a.num_flags, 0)::int as "numFlags"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      WHERE rd.parent_id = ${parentId}
      ORDER BY
        natural_sort_num(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_part, rd.njac_chapter)) NULLS LAST,
        natural_sort_num(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
        natural_sort_alpha(COALESCE(rd.nycrr_section, rd.njac_subchapter, rd.njac_section)) NULLS LAST,
        natural_sort_num(regexp_replace(rd.title, '^[^0-9]*', '', 'g')) NULLS LAST,
        rd.title NULLS LAST
    `);

    return results.rows as unknown as {
      id: number;
      title: string;
      hierarchyLevel: string | null;
      shortTitle: string | null;
      summary: string | null;
      levelIdentifier: string | null;
      citation: string | null;
      nycrrTitle: number | null;
      nycrrPart: string | null;
      nycrrChapter: string | null;
      njacTitle: string | null;
      njacChapter: string | null;
      njacSubchapter: string | null;
      state: string | null;
      hasAnalysis: boolean;
      maxSeverity: number | null;
      numFlags: number;
    }[];
  }

  /**
   * Get the ancestor chain (breadcrumb path) for a document
   * Returns documents from root to immediate parent, ordered from root to current
   */
  async getAncestorChain(documentId: number): Promise<{
    id: number;
    title: string;
    hierarchyLevel: string | null;
    shortTitle: string | null;
    summary: string | null;
    levelIdentifier: string | null;
    citation: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrChapter: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
    state: string | null;
  }[]> {
    // Use a recursive CTE to walk up the parent chain
    const results = await this.db.execute(sql`
      WITH RECURSIVE ancestors AS (
        -- Start with the document's parent
        SELECT
          rd.id,
          rd.title,
          rd.hierarchy_level as "hierarchyLevel",
          rd.short_title as "shortTitle",
          rd.summary,
          rd.level_identifier as "levelIdentifier",
          rd.citation as "citation",
          rd.nycrr_title as "nycrrTitle",
          rd.nycrr_part as "nycrrPart",
          rd.nycrr_chapter as "nycrrChapter",
          rd.njac_title as "njacTitle",
          rd.njac_chapter as "njacChapter",
          rd.njac_subchapter as "njacSubchapter",
          rd.state,
          rd.parent_id as "parentId",
          1 as depth
        FROM regulatory_documents rd
        WHERE rd.id = (SELECT parent_id FROM regulatory_documents WHERE id = ${documentId})

        UNION ALL

        -- Recursively get parents
        SELECT
          rd.id,
          rd.title,
          rd.hierarchy_level as "hierarchyLevel",
          rd.short_title as "shortTitle",
          rd.summary,
          rd.level_identifier as "levelIdentifier",
          rd.citation as "citation",
          rd.nycrr_title as "nycrrTitle",
          rd.nycrr_part as "nycrrPart",
          rd.nycrr_chapter as "nycrrChapter",
          rd.njac_title as "njacTitle",
          rd.njac_chapter as "njacChapter",
          rd.njac_subchapter as "njacSubchapter",
          rd.state,
          rd.parent_id as "parentId",
          a.depth + 1
        FROM regulatory_documents rd
        INNER JOIN ancestors a ON rd.id = a."parentId"
        WHERE a.depth < 20  -- Safety limit to prevent infinite loops
      )
      SELECT id, title, "hierarchyLevel", "shortTitle", summary, "levelIdentifier", "citation",
             "nycrrTitle", "nycrrPart", "nycrrChapter", "njacTitle", "njacChapter", "njacSubchapter", state
      FROM ancestors
      ORDER BY depth DESC  -- Root first
    `);

    return results.rows as unknown as {
      id: number;
      title: string;
      hierarchyLevel: string | null;
      shortTitle: string | null;
      summary: string | null;
      levelIdentifier: string | null;
      citation: string | null;
      nycrrTitle: number | null;
      nycrrPart: string | null;
      nycrrChapter: string | null;
      njacTitle: string | null;
      njacChapter: string | null;
      njacSubchapter: string | null;
      state: string | null;
    }[];
  }

  // ========================================
  // Dashboard statistics methods
  // ========================================

  /**
   * Get aggregate statistics for the dashboard
   * @param state - Optional state filter. If not provided, returns stats for all states.
   */
  async getDashboardStats(state?: StateCode): Promise<DashboardStats> {
    const stateCondition = state
      ? sql`WHERE rd.state = ${normalizeState(state)}`
      : sql``;

    const stateConditionWithAnd = state
      ? sql`AND rd.state = ${normalizeState(state)}`
      : sql``;

    // Get document counts
    const docStats = await this.db.execute(sql`
      SELECT
        COUNT(*)::int as "totalDocuments",
        COUNT(a.id)::int as "analyzedDocuments",
        COUNT(CASE WHEN a.num_flags > 0 THEN 1 END)::int as "documentsWithFlags"
      FROM regulatory_documents rd
      LEFT JOIN analyses a ON a.document_id = rd.id AND a.is_current = true
      ${stateCondition}
    `);

    // Get flag counts by severity
    const flagStats = await this.db.execute(sql`
      SELECT
        COUNT(*)::int as "totalFlags",
        COUNT(CASE WHEN rf.severity >= 7 THEN 1 END)::int as "highSeverity",
        COUNT(CASE WHEN rf.severity >= 4 AND rf.severity < 7 THEN 1 END)::int as "mediumSeverity",
        COUNT(CASE WHEN rf.severity >= 1 AND rf.severity < 4 THEN 1 END)::int as "lowSeverity",
        COUNT(CASE WHEN rf.review_status = 'unreviewed' OR rf.review_status IS NULL THEN 1 END)::int as "unreviewedFlags"
      FROM red_flags rf
      JOIN analyses a ON a.id = rf.analysis_id AND a.is_current = true
      JOIN regulatory_documents rd ON rd.id = a.document_id
      ${stateCondition}
    `);

    // Get compliance issue counts (only LLM-confirmed issues where requirement_found = TRUE)
    const complianceStats = await this.db.execute(sql`
      SELECT
        COUNT(DISTINCT cia.id)::int as "total",
        COUNT(DISTINCT CASE WHEN cia.review_status = 'unreviewed' OR cia.review_status IS NULL THEN cia.id END)::int as "unreviewed"
      FROM compliance_issue_analyses cia
      WHERE cia.requirement_found = TRUE
      ${state ? sql`AND cia.state = ${normalizeState(state)}` : sql``}
    `);

    // Get compliance issues by type (only LLM-confirmed issues)
    const complianceByType = await this.db.execute(sql`
      SELECT
        cia.issue_type as "issueType",
        COUNT(*)::int as "count"
      FROM compliance_issue_analyses cia
      WHERE cia.requirement_found = TRUE
      ${state ? sql`AND cia.state = ${normalizeState(state)}` : sql``}
      GROUP BY cia.issue_type
    `);

    const docRow = docStats.rows[0] as {
      totalDocuments: number;
      analyzedDocuments: number;
      documentsWithFlags: number;
    };

    const flagRow = flagStats.rows[0] as {
      totalFlags: number;
      highSeverity: number;
      mediumSeverity: number;
      lowSeverity: number;
      unreviewedFlags: number;
    };

    const complianceRow = complianceStats.rows[0] as {
      total: number;
      unreviewed: number;
    };

    // Build byType map from compliance type rows
    const byType: Record<string, number> = {};
    for (const row of complianceByType.rows as { issueType: string; count: number }[]) {
      byType[row.issueType] = row.count;
    }

    return {
      totalDocuments: docRow.totalDocuments,
      analyzedDocuments: docRow.analyzedDocuments,
      documentsWithFlags: docRow.documentsWithFlags,
      totalFlags: flagRow.totalFlags,
      flagsBySeverity: {
        high: flagRow.highSeverity,
        medium: flagRow.mediumSeverity,
        low: flagRow.lowSeverity,
      },
      unreviewedFlags: flagRow.unreviewedFlags,
      complianceIssues: {
        total: complianceRow.total,
        byType,
        unreviewed: complianceRow.unreviewed,
      },
    };
  }

  /**
   * Get stats for all states at once (for state selector cards)
   */
  async getAllStateStats(): Promise<Record<StateCode, DashboardStats>> {
    const [nyStats, njStats, nycStats] = await Promise.all([
      this.getDashboardStats('ny'),
      this.getDashboardStats('nj'),
      this.getDashboardStats('nyc'),
    ]);

    return {
      ny: nyStats,
      nj: njStats,
      nyc: nycStats,
    };
  }

  /**
   * Get recent activity counts for the dashboard.
   * Counts events within the last `windowDays` days.
   */
  async getRecentActivity(state?: StateCode, windowDays = 7): Promise<RecentActivity> {
    const stateCondition = state
      ? sql`AND cia.state = ${normalizeState(state)}`
      : sql``;

    const flagStateCondition = state
      ? sql`AND rd.state = ${normalizeState(state)}`
      : sql``;

    const docStateCondition = state
      ? sql`AND rd.state = ${normalizeState(state)}`
      : sql``;

    const cutoff = sql`NOW() - ${sql.raw(`INTERVAL '${windowDays} days'`)}`;

    const [issueResult, flagResult, docResult] = await Promise.all([
      // New issues confirmed + issues reviewed in window
      this.db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE cia.created_at >= ${cutoff} AND cia.requirement_found = TRUE)::int AS "newIssues",
          COUNT(*) FILTER (WHERE cia.reviewed_at >= ${cutoff})::int AS "issuesReviewed"
        FROM compliance_issue_analyses cia
        WHERE 1=1 ${stateCondition}
      `),
      // Red flags reviewed in window
      this.db.execute(sql`
        SELECT
          COUNT(*)::int AS "flagsReviewed"
        FROM red_flags rf
        JOIN analyses a ON a.id = rf.analysis_id AND a.is_current = true
        JOIN regulatory_documents rd ON rd.id = a.document_id
        WHERE rf.reviewed_at >= ${cutoff} ${flagStateCondition}
      `),
      // Documents analyzed in window
      this.db.execute(sql`
        SELECT
          COUNT(*)::int AS "documentsAnalyzed"
        FROM analyses a
        JOIN regulatory_documents rd ON rd.id = a.document_id
        WHERE a.analyzed_at >= ${cutoff} AND a.is_current = true ${docStateCondition}
      `),
    ]);

    const issueRow = issueResult.rows[0] as { newIssues: number; issuesReviewed: number };
    const flagRow = flagResult.rows[0] as { flagsReviewed: number };
    const docRow = docResult.rows[0] as { documentsAnalyzed: number };

    return {
      newIssues: issueRow.newIssues,
      issuesReviewed: issueRow.issuesReviewed,
      flagsReviewed: flagRow.flagsReviewed,
      documentsAnalyzed: docRow.documentsAnalyzed,
      windowDays,
    };
  }

  // ========================================
  // AI-generated metadata statistics
  // ========================================

  /**
   * Get document counts grouped by section_type.
   * Normalizes section types by lowercasing and trimming whitespace.
   */
  async getSectionTypeStats(state: StateCode): Promise<{ sectionType: string; count: number }[]> {
    const stateUpper = normalizeState(state);

    const results = await this.db.execute(sql`
      SELECT
        LOWER(TRIM(section_type)) as "sectionType",
        COUNT(*)::int as count
      FROM regulatory_documents
      WHERE state = ${stateUpper}
        AND section_type IS NOT NULL
        AND TRIM(section_type) != ''
      GROUP BY LOWER(TRIM(section_type))
      ORDER BY count DESC
    `);

    return results.rows as { sectionType: string; count: number }[];
  }

  /**
   * Get aggregate metadata statistics for a state
   */
  async getMetadataStats(state: StateCode): Promise<{
    withSummary: number;
    withForm: number;
    withIbr: number;
    total: number;
    bySectionType: Record<string, number>;
  }> {
    const stateUpper = normalizeState(state);

    // Get aggregate counts
    const statsResult = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE summary IS NOT NULL)::int as "withSummary",
        COUNT(*) FILTER (WHERE has_form = true)::int as "withForm",
        COUNT(*) FILTER (WHERE has_ibr = true)::int as "withIbr",
        COUNT(*)::int as total
      FROM regulatory_documents
      WHERE state = ${stateUpper}
    `);

    // Get counts by section type
    const typeResult = await this.db.execute(sql`
      SELECT
        COALESCE(section_type, 'unknown') as "sectionType",
        COUNT(*)::int as count
      FROM regulatory_documents
      WHERE state = ${stateUpper}
      GROUP BY section_type
    `);

    const statsRow = statsResult.rows[0] as {
      withSummary: number;
      withForm: number;
      withIbr: number;
      total: number;
    };

    const bySectionType: Record<string, number> = {};
    for (const row of typeResult.rows as { sectionType: string; count: number }[]) {
      bySectionType[row.sectionType] = row.count;
    }

    return {
      ...statsRow,
      bySectionType,
    };
  }

  /**
   * Get most common keywords across all documents in a state.
   * Normalizes keywords by: lowercasing, trimming whitespace, removing trailing 's' for plurals.
   */
  async getTopKeywords(state: StateCode, limit: number = 20): Promise<{ keyword: string; count: number }[]> {
    const stateUpper = normalizeState(state);

    const results = await this.db.execute(sql`
      SELECT
        REGEXP_REPLACE(LOWER(TRIM(keyword)), 's$', '') as keyword,
        COUNT(*)::int as count
      FROM regulatory_documents,
           UNNEST(keywords) as keyword
      WHERE state = ${stateUpper}
        AND keywords IS NOT NULL
        AND array_length(keywords, 1) > 0
        AND TRIM(keyword) != ''
        AND keyword IS NOT NULL
      GROUP BY REGEXP_REPLACE(LOWER(TRIM(keyword)), 's$', '')
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return results.rows as { keyword: string; count: number }[];
  }

  /**
   * Get most common applies_to values across all documents in a state
   */
  async getTopAppliesTo(state: StateCode, limit: number = 20): Promise<{ entity: string; count: number }[]> {
    const stateUpper = normalizeState(state);

    const results = await this.db.execute(sql`
      SELECT
        entity,
        COUNT(*)::int as count
      FROM regulatory_documents,
           UNNEST(applies_to) as entity
      WHERE state = ${stateUpper}
        AND applies_to IS NOT NULL
        AND array_length(applies_to, 1) > 0
      GROUP BY entity
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return results.rows as { entity: string; count: number }[];
  }
}
