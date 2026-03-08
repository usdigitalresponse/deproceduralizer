import { eq, and, desc, asc, ilike, or, sql, count } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { regulatoryDocuments, RegulatoryDocument } from '../schema/regulatory-documents';
import { JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

// content is omitted from list queries for performance, only fetched in getByIdWithAnalysis
export interface RegulationWithAnalysis extends Omit<RegulatoryDocument, 'content'> {
  content?: string | null; // Optional - only present when fetched via getByIdWithAnalysis
  summary: string | null;
}

export interface FilterOptions {
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
  jurisdiction: string | null;
  // Aggregated data
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
  jurisdiction: JurisdictionCode; // Required - filter by jurisdiction
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
  jurisdiction: JurisdictionCode; // Required - filter by jurisdiction
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'title' | 'summary';
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
  windowDays: number;
}

export interface DashboardStats {
  totalDocuments: number;
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
        jurisdiction: regulatoryDocuments.jurisdiction,
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
      })
      .from(regulatoryDocuments)
      .orderBy(desc(regulatoryDocuments.id));

    return results;
  }

  async getAllWithAnalysisPaginated(
    options: PaginationOptions
  ): Promise<PaginatedResult<RegulationWithAnalysis>> {
    const { jurisdiction, page, pageSize, search, sortBy = 'title', sortOrder = 'desc' } = options;
    const offset = (page - 1) * pageSize;

    // Build conditions array
    const conditions: ReturnType<typeof eq>[] = [];

    // Always filter by jurisdiction
    conditions.push(eq(regulatoryDocuments.jurisdiction, normalizeJurisdiction(jurisdiction)));

    // Add search condition if provided
    if (search) {
      conditions.push(
        or(
          ilike(regulatoryDocuments.title, `%${search}%`),
          ilike(regulatoryDocuments.summary, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build the sort order
    const sortColumn = {
      title: regulatoryDocuments.title,
      summary: regulatoryDocuments.summary,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(regulatoryDocuments.id); // Tiebreaker for consistent ordering

    // Get total count for pagination
    const countQuery = this.db
      .select({ count: count() })
      .from(regulatoryDocuments);

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
        jurisdiction: regulatoryDocuments.jurisdiction,
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
      })
      .from(regulatoryDocuments)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    if (whereClause) {
      query.where(whereClause);
    }

    const data = await query;

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
        jurisdiction: regulatoryDocuments.jurisdiction,
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
      })
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.id, id))
      .limit(1);

    if (results.length === 0) return null;

    return results[0];
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
    const { jurisdiction } = filters;
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    // Build filter conditions for descendants
    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const filterClause = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    // When filters are active (beyond just jurisdiction), only show titles with matching descendants
    const hasContentFilters = filterConditions.length > 0;

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        -- Format root titles as "TITLE [number] - [name]"
        CASE
          WHEN rd.jurisdiction = 'NY' AND rd.nycrr_title IS NOT NULL AND rd.nycrr_title_name IS NOT NULL THEN
            'TITLE ' || rd.nycrr_title || ' - ' || rd.nycrr_title_name
          WHEN rd.jurisdiction = 'NJ' AND rd.njac_title IS NOT NULL AND rd.njac_title_name IS NOT NULL THEN
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
        rd.jurisdiction,
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
          BOOL_OR(EXISTS (
            SELECT 1 FROM definitions d WHERE d.document_id = child.id
          )) as has_definitions
        FROM regulatory_documents child
        WHERE child.parent_id = rd.id
        ${filterClause}
      ) child_stats ON true
      -- All descendants matching filter (using hierarchy_path)
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT descendant.id)::int as matching_descendant_count
        FROM regulatory_documents descendant
        WHERE descendant.hierarchy_path LIKE rd.hierarchy_path || ' > %'
        ${filterClause}
      ) descendant_stats ON true
      WHERE rd.hierarchy_level = 'title'
        AND rd.jurisdiction = ${jurisdictionUpper}
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
    const filterConditionsA = this.buildHierarchyFilterConditions(filters, '', 'rd');
    const filterConditionsGa = this.buildHierarchyFilterConditions(filters, '', 'grandchild');
    const filterConditionsDa = this.buildHierarchyFilterConditions(filters, '', 'descendant');

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
        rd.jurisdiction,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
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
        WHERE grandchild.parent_id = rd.id
        ${filterClauseGa}
      ) child_stats ON true
      -- Matching descendants at any depth
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT descendant.id)::int as matching_descendant_count
        FROM regulatory_documents descendant
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
    const { jurisdiction } = filters;
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

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
        rd.jurisdiction,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
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
      WHERE rd.jurisdiction = ${jurisdictionUpper}
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
  }[]> {
    const { jurisdiction } = filters;
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    const filterConditions = this.buildHierarchyFilterConditions(filters);
    const additionalFilters = filterConditions.length > 0
      ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
      : sql``;

    const results = await this.db.execute(sql`
      SELECT
        COALESCE(rd.hierarchy_level, 'unlinked') as level,
        COUNT(*)::int as count
      FROM regulatory_documents rd
      WHERE rd.jurisdiction = ${jurisdictionUpper}
      ${additionalFilters}
      GROUP BY rd.hierarchy_level
      ORDER BY count DESC
    `);

    return results.rows as unknown as {
      level: string;
      count: number;
    }[];
  }

  /**
   * Build filter conditions for hierarchy queries
   * @param filters - The filter options to apply
   * @param _unused - Unused parameter (kept for API compatibility)
   * @param docAlias - The SQL alias for the regulatory_documents table (default: 'rd')
   */
  private buildHierarchyFilterConditions(
    filters?: HierarchyFilterOptions,
    _unused: string = '',
    docAlias: string = 'rd'
  ) {
    const conditions: ReturnType<typeof sql>[] = [];

    if (!filters) return conditions;

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
  async getHierarchyRootsFast(jurisdiction: JurisdictionCode): Promise<HierarchyNode[]> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    const results = await this.db.execute(sql`
      SELECT
        rd.id,
        -- Format root titles as "TITLE [number] - [name]"
        CASE
          WHEN rd.jurisdiction = 'NY' AND rd.nycrr_title IS NOT NULL AND rd.nycrr_title_name IS NOT NULL THEN
            'TITLE ' || rd.nycrr_title || ' - ' || rd.nycrr_title_name
          WHEN rd.jurisdiction = 'NJ' AND rd.njac_title IS NOT NULL AND rd.njac_title_name IS NOT NULL THEN
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
        rd.jurisdiction,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
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
      WHERE rd.hierarchy_level = 'title'
        AND rd.jurisdiction = ${jurisdictionUpper}
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
        rd.jurisdiction,
        rd.summary,
        rd.section_type as "sectionType",
        rd.keywords,
        rd.has_form as "hasForm",
        rd.has_ibr as "hasIbr",
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
    jurisdiction: string | null;
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
        rd.jurisdiction
      FROM regulatory_documents rd
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
      jurisdiction: string | null;
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
    jurisdiction: string | null;
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
          rd.jurisdiction,
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
          rd.jurisdiction,
          rd.parent_id as "parentId",
          a.depth + 1
        FROM regulatory_documents rd
        INNER JOIN ancestors a ON rd.id = a."parentId"
        WHERE a.depth < 20  -- Safety limit to prevent infinite loops
      )
      SELECT id, title, "hierarchyLevel", "shortTitle", summary, "levelIdentifier", "citation",
             "nycrrTitle", "nycrrPart", "nycrrChapter", "njacTitle", "njacChapter", "njacSubchapter", jurisdiction
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
      jurisdiction: string | null;
    }[];
  }

  // ========================================
  // Dashboard statistics methods
  // ========================================

  /**
   * Get aggregate statistics for the dashboard
   * @param jurisdiction - Optional jurisdiction filter. If not provided, returns stats for all jurisdictions.
   */
  async getDashboardStats(jurisdiction?: JurisdictionCode): Promise<DashboardStats> {
    const jurisdictionCondition = jurisdiction
      ? sql`WHERE rd.jurisdiction = ${normalizeJurisdiction(jurisdiction)}`
      : sql``;

    // Get document counts
    const docStats = await this.db.execute(sql`
      SELECT
        COUNT(*)::int as "totalDocuments"
      FROM regulatory_documents rd
      ${jurisdictionCondition}
    `);

    // Get compliance issue counts (only LLM-confirmed issues where requirement_found = TRUE)
    const complianceStats = await this.db.execute(sql`
      SELECT
        COUNT(DISTINCT cia.id)::int as "total",
        COUNT(DISTINCT CASE WHEN cia.review_status = 'unreviewed' OR cia.review_status IS NULL THEN cia.id END)::int as "unreviewed"
      FROM compliance_issue_analyses cia
      WHERE cia.requirement_found = TRUE
      ${jurisdiction ? sql`AND cia.jurisdiction = ${normalizeJurisdiction(jurisdiction)}` : sql``}
    `);

    // Get compliance issues by type (only LLM-confirmed issues)
    const complianceByType = await this.db.execute(sql`
      SELECT
        cia.issue_type as "issueType",
        COUNT(*)::int as "count"
      FROM compliance_issue_analyses cia
      WHERE cia.requirement_found = TRUE
      ${jurisdiction ? sql`AND cia.jurisdiction = ${normalizeJurisdiction(jurisdiction)}` : sql``}
      GROUP BY cia.issue_type
    `);

    const docRow = docStats.rows[0] as {
      totalDocuments: number;
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
  async getAllJurisdictionStats(): Promise<Record<JurisdictionCode, DashboardStats>> {
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
  async getRecentActivity(jurisdiction?: JurisdictionCode, windowDays = 7): Promise<RecentActivity> {
    const jurisdictionCondition = jurisdiction
      ? sql`AND cia.jurisdiction = ${normalizeJurisdiction(jurisdiction)}`
      : sql``;

    const cutoff = sql`NOW() - ${sql.raw(`INTERVAL '${windowDays} days'`)}`;

    const issueResult = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE cia.created_at >= ${cutoff} AND cia.requirement_found = TRUE)::int AS "newIssues",
        COUNT(*) FILTER (WHERE cia.reviewed_at >= ${cutoff})::int AS "issuesReviewed"
      FROM compliance_issue_analyses cia
      WHERE 1=1 ${jurisdictionCondition}
    `);

    const issueRow = issueResult.rows[0] as { newIssues: number; issuesReviewed: number };

    return {
      newIssues: issueRow.newIssues,
      issuesReviewed: issueRow.issuesReviewed,
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
  async getSectionTypeStats(jurisdiction: JurisdictionCode): Promise<{ sectionType: string; count: number }[]> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    const results = await this.db.execute(sql`
      SELECT
        LOWER(TRIM(section_type)) as "sectionType",
        COUNT(*)::int as count
      FROM regulatory_documents
      WHERE jurisdiction = ${jurisdictionUpper}
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
  async getMetadataStats(jurisdiction: JurisdictionCode): Promise<{
    withSummary: number;
    withForm: number;
    withIbr: number;
    total: number;
    bySectionType: Record<string, number>;
  }> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    // Get aggregate counts
    const statsResult = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE summary IS NOT NULL)::int as "withSummary",
        COUNT(*) FILTER (WHERE has_form = true)::int as "withForm",
        COUNT(*) FILTER (WHERE has_ibr = true)::int as "withIbr",
        COUNT(*)::int as total
      FROM regulatory_documents
      WHERE jurisdiction = ${jurisdictionUpper}
    `);

    // Get counts by section type
    const typeResult = await this.db.execute(sql`
      SELECT
        COALESCE(section_type, 'unknown') as "sectionType",
        COUNT(*)::int as count
      FROM regulatory_documents
      WHERE jurisdiction = ${jurisdictionUpper}
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
  async getTopKeywords(jurisdiction: JurisdictionCode, limit: number = 20): Promise<{ keyword: string; count: number }[]> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    const results = await this.db.execute(sql`
      SELECT
        REGEXP_REPLACE(LOWER(TRIM(keyword)), 's$', '') as keyword,
        COUNT(*)::int as count
      FROM regulatory_documents,
           UNNEST(keywords) as keyword
      WHERE jurisdiction = ${jurisdictionUpper}
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
  async getTopAppliesTo(jurisdiction: JurisdictionCode, limit: number = 20): Promise<{ entity: string; count: number }[]> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    const results = await this.db.execute(sql`
      SELECT
        entity,
        COUNT(*)::int as count
      FROM regulatory_documents,
           UNNEST(applies_to) as entity
      WHERE jurisdiction = ${jurisdictionUpper}
        AND applies_to IS NOT NULL
        AND array_length(applies_to, 1) > 0
      GROUP BY entity
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return results.rows as { entity: string; count: number }[];
  }
}
