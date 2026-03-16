import { eq, and, desc, asc, sql, count, ilike, or, gte, lte, inArray } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { guidanceDocuments } from '../schema/guidance-documents';
import { complianceIssues } from '../schema/compliance-issues';
import { jenaiIssues } from '../schema/jenai-issues';
import { crossReferences } from '../schema/cross-references';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { JurisdictionCode, normalizeJurisdiction } from '../schema/constants';
// Note: policyCategory values are from POLICY_CATEGORIES, status from GUIDANCE_STATUSES
// in ../schema/guidance-documents.ts. Drizzle infers text() as string, not the union type.

export interface GuidanceDocumentListItem {
  id: number;
  catalogId: string | null;
  canonicalRef: string | null;
  title: string;
  agency: string;
  docType: string | null;
  policyCategory: string | null;
  status: string | null;
  year: number | null;
  url: string | null;
  complianceIssueCount: number;
  jenaiIssueCount: number;
  fleschReadingEase: number | null;
  excludeFromAnalysis: boolean | null;
}

export interface GuidanceDocumentDetail {
  id: number;
  catalogId: string | null;
  canonicalRef: string | null;
  title: string;
  agency: string;
  agencyDivision: string | null;
  docType: string | null;
  domain: string | null;
  policyCategory: string | null;
  isAttachment: boolean | null;
  datePublished: string | null;
  dateEffective: string | null;
  dateRevised: string | null;
  dateExpires: string | null;
  year: number | null;
  content: string | null;
  url: string | null;
  fileFormat: string | null;
  status: string | null;
  supersedes: string[] | null;
  supersededBy: string | null;
  revisionOf: string | null;
  senderName: string | null;
  senderTitle: string | null;
  distributionTo: string[] | null;
  programs: string[] | null;
  citesRegulations: string[] | null;
  citesFederal: string[] | null;
  citesDocuments: string[] | null;
  jurisdiction: string | null;
  summary: string | null;
  sectionType: string | null;
  keywords: string[] | null;
  appliesTo: string[] | null;
  hasForm: boolean | null;
  hasIbr: boolean | null;
  targetAudience: string[] | null;
  audienceDirection: string | null;
  audienceExpertise: string | null;
  audienceExplanation: string | null;
  complianceIssueCount: number;
  // Analysis exclusion
  excludeFromAnalysis: boolean | null;
  excludedAt: Date | null;
  excludedBy: string | null;
  excludedReason: string | null;
  // Readability metrics
  fleschKincaidGrade: number | null;
  fleschReadingEase: number | null;
  gunningFog: number | null;
  automatedReadabilityIndex: number | null;
  colemanLiauIndex: number | null;
  smogIndex: number | null;
  daleChallReadabilityScore: number | null;
  linsearWriteFormula: number | null;
  readingGradeLevel: string | null;
  difficultWordCount: number | null;
  wordCount: number | null;
  sentenceCount: number | null;
}

export interface GuidanceOverviewStats {
  total: number;
  byAgency: Array<{ agency: string; count: number }>;
  byDocType: Array<{ docType: string; count: number }>;
  byPolicyCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byYear: Array<{ year: number; count: number }>;
  byAudienceDirection: Array<{ audienceDirection: string; count: number }>;
}

export interface GuidancePaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'title' | 'agency' | 'year' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  filters?: {
    agency?: string;
    docType?: string;
    policyCategory?: string;
    status?: string;
    yearFrom?: number;
    yearTo?: number;
    search?: string;
    audienceDirection?: string;
    sectionType?: string;
    hasForm?: boolean;
    hasIbr?: boolean;
  };
}

export interface PaginatedGuidanceResult {
  data: GuidanceDocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LineageNode {
  id: number;
  canonicalRef: string;
  title: string;
  status: string | null;
  agency: string;
  year: number | null;
  isCurrent: boolean;
}

export interface DocumentLineage {
  chain: LineageNode[];     // ordered oldest → newest
  currentIndex: number;     // position of viewed doc in chain
}

interface LineageDoc {
  id: number;
  canonicalRef: string | null;
  title: string;
  agency: string;
  status: string | null;
  year: number | null;
  supersedes: string[] | null;
  supersededBy: string | null;
  revisionOf: string | null;
  datePublished: string | null;
  jurisdiction: string | null;
}

export interface SupersedureLink {
  canonicalRef: string;
  id: number | null;
  title: string | null;
  status: string | null;
  relationship: 'supersedes' | 'superseded_by' | 'revision_of';
}

export interface GuidanceCitationStats {
  docsWithCitations: number;
  totalDocs: number;
  topCitedRegulations: Array<{
    regulationId: number;
    citation: string | null;
    title: string | null;
    guidanceCount: number;
  }>;
  citationsByAgency: Array<{
    agency: string;
    totalCitations: number;
    docsWithCitations: number;
    totalDocs: number;
  }>;
}

export interface ResolvedRegulationCitation {
  citationText: string;
  regulationId: number | null;
  regulationTitle: string | null;
}

export interface LineageFamilyMember {
  id: number;
  canonicalRef: string;
  title: string;
  status: string | null;
  year: number | null;
}

export interface DocumentFamily {
  familyId: string;               // canonicalRef of oldest member
  members: LineageFamilyMember[];  // ordered oldest → newest
  chainLength: number;
  currentActiveId: number | null;  // id of the active member (if any)
  agency: string;
}

export interface LineageStats {
  docsWithLineage: number;        // has supersedes/supersededBy/revisionOf
  supersededCount: number;        // status = 'superseded'
  orphanedReferences: number;     // refs pointing to non-existent docs
  totalFamilies: number;          // total count before truncation
  families: DocumentFamily[];     // grouped revision chains (top 50 by chain length)
}


export interface GuidanceReadabilityStats {
  docsWithMetrics: number;
  totalDocs: number;
  avgFleschReadingEase: number | null;
  avgFleschKincaidGrade: number | null;
  avgGunningFog: number | null;
  avgAutomatedReadabilityIndex: number | null;
  avgColemanLiauIndex: number | null;
  avgSmogIndex: number | null;
  avgDaleChallScore: number | null;
  avgLinsearWriteFormula: number | null;
  avgWordCount: number | null;
  avgSentenceCount: number | null;
  avgDifficultWordPct: number | null;
  gradeDistribution: Array<{ grade: string; count: number }>;
  readingEaseByAgency: Array<{
    agency: string;
    avgReadingEase: number;
    avgGradeLevel: number;
    docCount: number;
  }>;
  audienceTags: Array<{ tag: string; count: number }>;
}

export interface ReadabilityByAgencyRow {
  agency: string;
  avgReadingEase: number;
  avgGradeLevel: number;
  docCount: number;
}

export interface ReadabilityCrossCutStats {
  /** Readability averages grouped by audience_direction (public/government/both) */
  byDirection: Array<{
    direction: string;
    avgReadingEase: number;
    avgGradeLevel: number;
    avgComplianceIssues: number;
    avgJenaiSeverity: number | null;
    docCount: number;
  }>;
  /** Readability averages grouped by audience_expertise (lay/specialized/mixed) */
  byExpertise: Array<{
    expertise: string;
    avgReadingEase: number;
    avgGradeLevel: number;
    avgComplianceIssues: number;
    avgJenaiSeverity: number | null;
    docCount: number;
  }>;
  /** Readability averages grouped by target_audience tag (unnested) */
  byAudienceTag: Array<{
    tag: string;
    avgReadingEase: number;
    avgGradeLevel: number;
    avgComplianceIssues: number;
    avgJenaiSeverity: number | null;
    docCount: number;
  }>;
  /** Compliance issue counts grouped by readability bucket */
  complianceByReadability: Array<{
    bucket: string;
    avgComplianceIssues: number;
    docCount: number;
  }>;
  /** JenAI avg severity grouped by readability bucket */
  jenaiByReadability: Array<{
    bucket: string;
    avgSeverity: number;
    docCount: number;
  }>;
}

export type GuidanceGroupByDimension = 'agency' | 'docType' | 'policyCategory';

export interface GuidanceGroupRow {
  groupKey: string;
  documentCount: number;
  complianceIssueCount: number;
  jenaiIssueCount: number;
  yearMin: number | null;
  yearMax: number | null;
  avgFleschReadingEase: number | null;
  avgFleschKincaidGrade: number | null;
}

export interface PaginatedGuidanceGroupResult {
  data: GuidanceGroupRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GuidanceGroupDocumentsResult {
  documents: GuidanceDocumentListItem[];
  byYear: Array<{
    year: number | null;
    documents: GuidanceDocumentListItem[];
  }>;
}

export class GuidanceDocumentsRepository extends BaseRepository {
  private buildFilterConditions(
    jurisdiction: JurisdictionCode,
    filters?: GuidancePaginationOptions['filters']
  ): ReturnType<typeof eq>[] {
    const conditions: ReturnType<typeof eq>[] = [
      eq(guidanceDocuments.jurisdiction, normalizeJurisdiction(jurisdiction)),
    ];

    if (filters) {
      if (filters.agency) {
        conditions.push(eq(guidanceDocuments.agency, filters.agency));
      }
      if (filters.docType) {
        conditions.push(eq(guidanceDocuments.docType, filters.docType));
      }
      if (filters.policyCategory) {
        conditions.push(eq(guidanceDocuments.policyCategory, filters.policyCategory));
      }
      if (filters.status) {
        conditions.push(eq(guidanceDocuments.status, filters.status));
      }
      if (filters.yearFrom) {
        conditions.push(gte(guidanceDocuments.year, filters.yearFrom));
      }
      if (filters.yearTo) {
        conditions.push(lte(guidanceDocuments.year, filters.yearTo));
      }
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(guidanceDocuments.title, searchTerm),
            ilike(guidanceDocuments.canonicalRef, searchTerm),
            ilike(guidanceDocuments.agency, searchTerm)
          )!
        );
      }
      if (filters.audienceDirection) {
        conditions.push(eq(guidanceDocuments.audienceDirection, filters.audienceDirection));
      }
      if (filters.sectionType) {
        conditions.push(eq(guidanceDocuments.sectionType, filters.sectionType));
      }
      if (filters.hasForm) {
        conditions.push(eq(guidanceDocuments.hasForm, true));
      }
      if (filters.hasIbr) {
        conditions.push(eq(guidanceDocuments.hasIbr, true));
      }
    }

    return conditions;
  }

  async getAllPaginated(options: GuidancePaginationOptions): Promise<PaginatedGuidanceResult> {
    const { jurisdiction, page, pageSize, sortBy = 'title', sortOrder = 'asc', filters } = options;
    const offset = (page - 1) * pageSize;

    const conditions = this.buildFilterConditions(jurisdiction, filters);
    const whereClause = and(...conditions);

    // Subquery for compliance issue count
    const issueCountSq = this.db
      .select({
        guidanceDocumentId: complianceIssues.guidanceDocumentId,
        count: sql<number>`count(*)::int`.as('issue_count'),
      })
      .from(complianceIssues)
      .groupBy(complianceIssues.guidanceDocumentId)
      .as('issue_counts');

    // Subquery for JenAI issue count
    const jenaiCountSq = this.db
      .select({
        guidanceDocumentId: jenaiIssues.guidanceDocumentId,
        count: sql<number>`count(*)::int`.as('jenai_count'),
      })
      .from(jenaiIssues)
      .groupBy(jenaiIssues.guidanceDocumentId)
      .as('jenai_counts');

    // Build sort column
    const sortColumn = {
      title: guidanceDocuments.title,
      agency: guidanceDocuments.agency,
      year: guidanceDocuments.year,
      status: guidanceDocuments.status,
      createdAt: guidanceDocuments.createdAt,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(guidanceDocuments.id);

    // Run count and data queries in parallel
    const [countResult, results] = await Promise.all([
      this.db.select({ count: count() }).from(guidanceDocuments).where(whereClause),
      this.db
        .select({
          id: guidanceDocuments.id,
          catalogId: guidanceDocuments.catalogId,
          canonicalRef: guidanceDocuments.canonicalRef,
          title: guidanceDocuments.title,
          agency: guidanceDocuments.agency,
          docType: guidanceDocuments.docType,
          policyCategory: guidanceDocuments.policyCategory,
          status: guidanceDocuments.status,
          year: guidanceDocuments.year,
          url: guidanceDocuments.url,
          complianceIssueCount: sql<number>`coalesce(${issueCountSq.count}, 0)`.mapWith(Number),
          jenaiIssueCount: sql<number>`coalesce(${jenaiCountSq.count}, 0)`.mapWith(Number),
          fleschReadingEase: guidanceDocuments.fleschReadingEase,
          excludeFromAnalysis: guidanceDocuments.excludeFromAnalysis,
        })
        .from(guidanceDocuments)
        .leftJoin(issueCountSq, eq(guidanceDocuments.id, issueCountSq.guidanceDocumentId))
        .leftJoin(jenaiCountSq, eq(guidanceDocuments.id, jenaiCountSq.guidanceDocumentId))
        .where(whereClause)
        .orderBy(primarySort, secondarySort)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = countResult[0].count;
    return {
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(id: number): Promise<GuidanceDocumentDetail | undefined> {
    const issueCountResult = this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .where(eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id));

    const results = await this.db
      .select({
        id: guidanceDocuments.id,
        catalogId: guidanceDocuments.catalogId,
        canonicalRef: guidanceDocuments.canonicalRef,
        title: guidanceDocuments.title,
        agency: guidanceDocuments.agency,
        agencyDivision: guidanceDocuments.agencyDivision,
        docType: guidanceDocuments.docType,
        domain: guidanceDocuments.domain,
        policyCategory: guidanceDocuments.policyCategory,
        isAttachment: guidanceDocuments.isAttachment,
        datePublished: guidanceDocuments.datePublished,
        dateEffective: guidanceDocuments.dateEffective,
        dateRevised: guidanceDocuments.dateRevised,
        dateExpires: guidanceDocuments.dateExpires,
        year: guidanceDocuments.year,
        content: guidanceDocuments.content,
        url: guidanceDocuments.url,
        fileFormat: guidanceDocuments.fileFormat,
        status: guidanceDocuments.status,
        supersedes: guidanceDocuments.supersedes,
        supersededBy: guidanceDocuments.supersededBy,
        revisionOf: guidanceDocuments.revisionOf,
        senderName: guidanceDocuments.senderName,
        senderTitle: guidanceDocuments.senderTitle,
        distributionTo: guidanceDocuments.distributionTo,
        programs: guidanceDocuments.programs,
        citesRegulations: guidanceDocuments.citesRegulations,
        citesFederal: guidanceDocuments.citesFederal,
        citesDocuments: guidanceDocuments.citesDocuments,
        jurisdiction: guidanceDocuments.jurisdiction,
        summary: guidanceDocuments.summary,
        sectionType: guidanceDocuments.sectionType,
        keywords: guidanceDocuments.keywords,
        appliesTo: guidanceDocuments.appliesTo,
        hasForm: guidanceDocuments.hasForm,
        hasIbr: guidanceDocuments.hasIbr,
        targetAudience: guidanceDocuments.targetAudience,
        audienceDirection: guidanceDocuments.audienceDirection,
        audienceExpertise: guidanceDocuments.audienceExpertise,
        audienceExplanation: guidanceDocuments.audienceExplanation,
        complianceIssueCount: sql<number>`(${issueCountResult})`.mapWith(Number),
        excludeFromAnalysis: guidanceDocuments.excludeFromAnalysis,
        excludedAt: guidanceDocuments.excludedAt,
        excludedBy: guidanceDocuments.excludedBy,
        excludedReason: guidanceDocuments.excludedReason,
        fleschKincaidGrade: guidanceDocuments.fleschKincaidGrade,
        fleschReadingEase: guidanceDocuments.fleschReadingEase,
        gunningFog: guidanceDocuments.gunningFog,
        automatedReadabilityIndex: guidanceDocuments.automatedReadabilityIndex,
        colemanLiauIndex: guidanceDocuments.colemanLiauIndex,
        smogIndex: guidanceDocuments.smogIndex,
        daleChallReadabilityScore: guidanceDocuments.daleChallReadabilityScore,
        linsearWriteFormula: guidanceDocuments.linsearWriteFormula,
        readingGradeLevel: guidanceDocuments.readingGradeLevel,
        difficultWordCount: guidanceDocuments.difficultWordCount,
        wordCount: guidanceDocuments.wordCount,
        sentenceCount: guidanceDocuments.sentenceCount,
      })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.id, id))
      .limit(1);

    return results[0];
  }

  async getOverviewStats(jurisdiction: JurisdictionCode): Promise<GuidanceOverviewStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const baseCondition = eq(guidanceDocuments.jurisdiction, stateUpper);

    // Run all aggregate queries in parallel
    const [totalResult, byAgency, byDocType, byPolicyCategory, byStatus, byYear, byAudienceDirection] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(guidanceDocuments)
        .where(baseCondition),
      this.db
        .select({
          agency: guidanceDocuments.agency,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(baseCondition)
        .groupBy(guidanceDocuments.agency)
        .orderBy(desc(sql`count(*)`)),
      this.db
        .select({
          docType: guidanceDocuments.docType,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(baseCondition)
        .groupBy(guidanceDocuments.docType)
        .orderBy(desc(sql`count(*)`)),
      this.db
        .select({
          category: sql<string>`CASE WHEN ${guidanceDocuments.policyCategory} IS NULL OR LOWER(${guidanceDocuments.policyCategory}) = 'unclassified' THEN 'Unclassified' ELSE ${guidanceDocuments.policyCategory} END`,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(baseCondition)
        .groupBy(sql`CASE WHEN ${guidanceDocuments.policyCategory} IS NULL OR LOWER(${guidanceDocuments.policyCategory}) = 'unclassified' THEN 'Unclassified' ELSE ${guidanceDocuments.policyCategory} END`)
        .orderBy(desc(sql`count(*)`)),
      this.db
        .select({
          status: guidanceDocuments.status,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(baseCondition)
        .groupBy(guidanceDocuments.status)
        .orderBy(desc(sql`count(*)`)),
      this.db
        .select({
          year: guidanceDocuments.year,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(and(baseCondition, sql`${guidanceDocuments.year} IS NOT NULL`))
        .groupBy(guidanceDocuments.year)
        .orderBy(desc(guidanceDocuments.year)),
      this.db
        .select({
          audienceDirection: guidanceDocuments.audienceDirection,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(and(baseCondition, sql`${guidanceDocuments.audienceDirection} IS NOT NULL`))
        .groupBy(guidanceDocuments.audienceDirection)
        .orderBy(desc(sql`count(*)`)),
    ]);

    const total = totalResult[0].count;

    return {
      total,
      byAgency: byAgency.map(row => ({
        agency: row.agency,
        count: row.count,
      })),
      byDocType: byDocType.map(row => ({
        docType: row.docType || 'Unknown',
        count: row.count,
      })),
      byPolicyCategory: byPolicyCategory.map(row => ({
        category: row.category,
        count: row.count,
      })),
      byStatus: byStatus.map(row => ({
        status: row.status || 'Unknown',
        count: row.count,
      })),
      byYear: byYear
        .filter((row): row is typeof row & { year: number } => row.year !== null)
        .map(row => ({
          year: row.year,
          count: row.count,
        })),
      byAudienceDirection: byAudienceDirection.map(row => ({
        audienceDirection: row.audienceDirection || 'Unknown',
        count: row.count,
      })),
    };
  }

  async getAgencies(jurisdiction: JurisdictionCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ agency: guidanceDocuments.agency })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .orderBy(asc(guidanceDocuments.agency));

    return result.map(r => r.agency);
  }

  async getDocTypes(jurisdiction: JurisdictionCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ docType: guidanceDocuments.docType })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .orderBy(asc(guidanceDocuments.docType));

    return result
      .map(r => r.docType)
      .filter((dt): dt is string => dt !== null);
  }

  async getSupersedureChain(docId: number): Promise<SupersedureLink[]> {
    // Get the document to find its supersedes/supersededBy/revisionOf refs
    const [doc] = await this.db
      .select({
        supersedes: guidanceDocuments.supersedes,
        supersededBy: guidanceDocuments.supersededBy,
        revisionOf: guidanceDocuments.revisionOf,
      })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.id, docId))
      .limit(1);

    if (!doc) return [];

    const links: SupersedureLink[] = [];
    const refsToResolve: Array<{ ref: string; relationship: SupersedureLink['relationship'] }> = [];

    if (doc.supersedes) {
      for (const ref of doc.supersedes) {
        refsToResolve.push({ ref, relationship: 'supersedes' });
      }
    }
    if (doc.supersededBy) {
      refsToResolve.push({ ref: doc.supersededBy, relationship: 'superseded_by' });
    }
    if (doc.revisionOf) {
      refsToResolve.push({ ref: doc.revisionOf, relationship: 'revision_of' });
    }

    if (refsToResolve.length === 0) return [];

    // Batch-resolve all canonical refs in a single query
    const allRefs = refsToResolve.map(r => r.ref);
    const resolved = await this.db
      .select({
        canonicalRef: guidanceDocuments.canonicalRef,
        id: guidanceDocuments.id,
        title: guidanceDocuments.title,
        status: guidanceDocuments.status,
      })
      .from(guidanceDocuments)
      .where(inArray(guidanceDocuments.canonicalRef, allRefs));

    const refMap = new Map(resolved.map(r => [r.canonicalRef, r]));

    for (const { ref, relationship } of refsToResolve) {
      const match = refMap.get(ref);
      links.push({
        canonicalRef: ref,
        id: match?.id ?? null,
        title: match?.title ?? null,
        status: match?.status ?? null,
        relationship,
      });
    }

    return links;
  }

  async getCitationCoverageStats(jurisdiction: JurisdictionCode): Promise<GuidanceCitationStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const baseCondition = eq(guidanceDocuments.jurisdiction, stateUpper);

    const [totalResult, withCitationsResult, topCitedResult, byAgencyResult] = await Promise.all([
      // Total docs
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(guidanceDocuments)
        .where(baseCondition),

      // Docs with citations (cites_regulations is non-empty)
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(guidanceDocuments)
        .where(and(
          baseCondition,
          sql`${guidanceDocuments.citesRegulations} IS NOT NULL AND array_length(${guidanceDocuments.citesRegulations}, 1) > 0`
        )),

      // Top cited regulations (via cross_references)
      this.db.execute<{
        regulation_id: number;
        citation: string | null;
        title: string | null;
        guidance_count: number;
      }>(sql`
        SELECT
          rd.id as regulation_id,
          rd.citation,
          COALESCE(rd.short_title, rd.title) as title,
          COUNT(DISTINCT cr.source_guidance_id)::int as guidance_count
        FROM cross_references cr
        JOIN regulatory_documents rd ON cr.target_document_id = rd.id
        WHERE cr.jurisdiction = ${stateUpper}
          AND cr.source_guidance_id IS NOT NULL
          AND cr.target_document_id IS NOT NULL
          AND cr.is_resolved = true
        GROUP BY rd.id, rd.citation, rd.short_title, rd.title
        ORDER BY guidance_count DESC
        LIMIT 20
      `),

      // Citations by agency
      this.db.execute<{
        agency: string;
        total_citations: number;
        docs_with_citations: number;
        total_docs: number;
      }>(sql`
        SELECT
          gd.agency,
          COALESCE(SUM(array_length(gd.cites_regulations, 1)), 0)::int as total_citations,
          COUNT(*) FILTER (WHERE gd.cites_regulations IS NOT NULL AND array_length(gd.cites_regulations, 1) > 0)::int as docs_with_citations,
          COUNT(*)::int as total_docs
        FROM guidance_documents gd
        WHERE gd.jurisdiction = ${stateUpper}
        GROUP BY gd.agency
        ORDER BY total_citations DESC
      `),
    ]);

    return {
      totalDocs: totalResult[0].count,
      docsWithCitations: withCitationsResult[0].count,
      topCitedRegulations: topCitedResult.rows.map(row => ({
        regulationId: row.regulation_id,
        citation: row.citation,
        title: row.title,
        guidanceCount: row.guidance_count,
      })),
      citationsByAgency: byAgencyResult.rows.map(row => ({
        agency: row.agency,
        totalCitations: row.total_citations,
        docsWithCitations: row.docs_with_citations,
        totalDocs: row.total_docs,
      })),
    };
  }

  async getFullLineage(docId: number): Promise<DocumentLineage> {
    const startDoc = await this.getLineageFields(docId);
    if (!startDoc || !startDoc.canonicalRef) {
      return { chain: [], currentIndex: -1 };
    }

    // Collect all lineage docs by walking both directions
    const visited = new Map<string, LineageDoc>(); // canonicalRef → doc
    visited.set(startDoc.canonicalRef, startDoc);

    let frontier = new Set<string>([startDoc.canonicalRef]);
    const MAX_HOPS = 10;

    for (let hop = 0; hop < MAX_HOPS && frontier.size > 0; hop++) {
      const nextFrontier = new Set<string>();

      // Gather all refs pointed to by frontier docs (forward refs)
      const forwardRefs: string[] = [];
      for (const ref of frontier) {
        const doc = visited.get(ref);
        if (!doc) continue;
        if (doc.supersedes) {
          for (const s of doc.supersedes) {
            if (!visited.has(s)) forwardRefs.push(s);
          }
        }
        if (doc.revisionOf && !visited.has(doc.revisionOf)) {
          forwardRefs.push(doc.revisionOf);
        }
        if (doc.supersededBy && !visited.has(doc.supersededBy)) {
          forwardRefs.push(doc.supersededBy);
        }
      }

      // Resolve forward refs and reverse lookup in parallel
      const uniqueForwardRefs = forwardRefs.length > 0 ? [...new Set(forwardRefs)] : [];
      const frontierRefs = [...frontier];
      const jurisdiction = startDoc.jurisdiction ?? undefined;

      const [resolved, reverseResults] = await Promise.all([
        uniqueForwardRefs.length > 0 ? this.resolveCanonicalRefs(uniqueForwardRefs, jurisdiction) : [],
        this.findReferencingDocs(frontierRefs, jurisdiction),
      ]);

      for (const doc of resolved) {
        if (doc.canonicalRef && !visited.has(doc.canonicalRef)) {
          visited.set(doc.canonicalRef, doc);
          nextFrontier.add(doc.canonicalRef);
        }
      }
      for (const doc of reverseResults) {
        if (doc.canonicalRef && !visited.has(doc.canonicalRef)) {
          visited.set(doc.canonicalRef, doc);
          nextFrontier.add(doc.canonicalRef);
        }
      }

      frontier = nextFrontier;
    }

    // If only the starting doc was found, return single-element chain
    if (visited.size <= 1) {
      return {
        chain: [{
          id: startDoc.id,
          canonicalRef: startDoc.canonicalRef,
          title: startDoc.title,
          status: startDoc.status,
          agency: startDoc.agency,
          year: startDoc.year,
          isCurrent: true,
        }],
        currentIndex: 0,
      };
    }

    const chain = this.sortLineageChain(visited, startDoc.canonicalRef);
    const currentIndex = chain.findIndex(n => n.canonicalRef === startDoc.canonicalRef);

    return { chain, currentIndex };
  }

  private async getLineageFields(docId: number): Promise<LineageDoc | undefined> {
    const results = await this.db
      .select({
        id: guidanceDocuments.id,
        canonicalRef: guidanceDocuments.canonicalRef,
        title: guidanceDocuments.title,
        agency: guidanceDocuments.agency,
        status: guidanceDocuments.status,
        year: guidanceDocuments.year,
        supersedes: guidanceDocuments.supersedes,
        supersededBy: guidanceDocuments.supersededBy,
        revisionOf: guidanceDocuments.revisionOf,
        datePublished: guidanceDocuments.datePublished,
        jurisdiction: guidanceDocuments.jurisdiction,
      })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.id, docId))
      .limit(1);

    return results[0];
  }

  private async resolveCanonicalRefs(refs: string[], jurisdiction?: string): Promise<LineageDoc[]> {
    if (refs.length === 0) return [];
    const conditions = jurisdiction
      ? and(inArray(guidanceDocuments.canonicalRef, refs), eq(guidanceDocuments.jurisdiction, jurisdiction))
      : inArray(guidanceDocuments.canonicalRef, refs);
    return this.db
      .select({
        id: guidanceDocuments.id,
        canonicalRef: guidanceDocuments.canonicalRef,
        title: guidanceDocuments.title,
        agency: guidanceDocuments.agency,
        status: guidanceDocuments.status,
        year: guidanceDocuments.year,
        supersedes: guidanceDocuments.supersedes,
        supersededBy: guidanceDocuments.supersededBy,
        revisionOf: guidanceDocuments.revisionOf,
        datePublished: guidanceDocuments.datePublished,
        jurisdiction: guidanceDocuments.jurisdiction,
      })
      .from(guidanceDocuments)
      .where(conditions);
  }

  private async findReferencingDocs(refs: string[], jurisdiction?: string): Promise<LineageDoc[]> {
    if (refs.length === 0) return [];

    const jurisdictionClause = jurisdiction
      ? sql`AND jurisdiction = ${jurisdiction}`
      : sql``;

    // Build a proper SQL array literal — Drizzle binds JS arrays as scalars,
    // which causes "malformed array literal" when cast with ::text[]
    const refsArray = sql`ARRAY[${sql.join(refs.map(r => sql`${r}`), sql`, `)}]::text[]`;

    const result = await this.db.execute<{
      id: number;
      canonical_ref: string | null;
      title: string;
      agency: string;
      status: string | null;
      year: number | null;
      supersedes: string[] | null;
      superseded_by: string | null;
      revision_of: string | null;
      date_published: string | null;
      jurisdiction: string | null;
    }>(sql`
      SELECT id, canonical_ref, title, agency, status, year,
             supersedes, superseded_by, revision_of, date_published, jurisdiction
      FROM guidance_documents
      WHERE (supersedes && ${refsArray}
         OR superseded_by = ANY(${refsArray})
         OR revision_of = ANY(${refsArray}))
        ${jurisdictionClause}
    `);

    return result.rows.map(row => ({
      id: row.id,
      canonicalRef: row.canonical_ref,
      title: row.title,
      agency: row.agency,
      status: row.status,
      year: row.year,
      supersedes: row.supersedes,
      supersededBy: row.superseded_by,
      revisionOf: row.revision_of,
      datePublished: row.date_published,
      jurisdiction: row.jurisdiction,
    }));
  }

  private sortLineageChain(nodes: Map<string, LineageDoc>, startRef: string): LineageNode[] {
    // Build a directed graph: edges go from predecessor → successor
    const adjacency = new Map<string, Set<string>>(); // ref → set of successor refs
    const inDegree = new Map<string, number>();

    for (const ref of nodes.keys()) {
      adjacency.set(ref, new Set());
      inDegree.set(ref, 0);
    }

    for (const [ref, doc] of nodes) {
      // supersedes means this doc replaced those docs, so predecessors → this doc
      if (doc.supersedes) {
        for (const predRef of doc.supersedes) {
          if (nodes.has(predRef)) {
            adjacency.get(predRef)!.add(ref);
            inDegree.set(ref, (inDegree.get(ref) ?? 0) + 1);
          }
        }
      }
      // revisionOf means this doc is a revision of predRef, so predRef → this doc
      if (doc.revisionOf && nodes.has(doc.revisionOf)) {
        adjacency.get(doc.revisionOf)!.add(ref);
        inDegree.set(ref, (inDegree.get(ref) ?? 0) + 1);
      }
      // supersededBy means this doc was superseded by successorRef, so this doc → successorRef
      if (doc.supersededBy && nodes.has(doc.supersededBy)) {
        adjacency.get(ref)!.add(doc.supersededBy);
        inDegree.set(doc.supersededBy, (inDegree.get(doc.supersededBy) ?? 0) + 1);
      }
    }

    // Topological sort (Kahn's algorithm) with date tiebreakers
    const queue: string[] = [];
    for (const [ref, degree] of inDegree) {
      if (degree === 0) queue.push(ref);
    }

    // Sort initial queue by year, then datePublished (oldest first)
    queue.sort((a, b) => this.compareByDate(nodes.get(a)!, nodes.get(b)!));

    const sorted: string[] = [];
    while (queue.length > 0) {
      const ref = queue.shift()!;
      sorted.push(ref);

      const successors = adjacency.get(ref);
      if (successors) {
        for (const succ of successors) {
          const newDegree = (inDegree.get(succ) ?? 1) - 1;
          inDegree.set(succ, newDegree);
          if (newDegree === 0) {
            queue.push(succ);
            // Re-sort to maintain date ordering among available nodes
            queue.sort((a, b) => this.compareByDate(nodes.get(a)!, nodes.get(b)!));
          }
        }
      }
    }

    // If there were cycles, add any remaining nodes sorted by date
    if (sorted.length < nodes.size) {
      const sortedSet = new Set(sorted);
      const remaining = [...nodes.keys()].filter(ref => !sortedSet.has(ref));
      remaining.sort((a, b) => this.compareByDate(nodes.get(a)!, nodes.get(b)!));
      sorted.push(...remaining);
    }

    return sorted.map(ref => {
      const doc = nodes.get(ref)!;
      return {
        id: doc.id,
        canonicalRef: ref,
        title: doc.title,
        status: doc.status,
        agency: doc.agency,
        year: doc.year,
        isCurrent: ref === startRef,
      };
    });
  }

  private compareByDate(a: LineageDoc, b: LineageDoc): number {
    // Compare by year first (nulls last)
    if (a.year !== b.year) {
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return a.year - b.year;
    }
    // Then by datePublished
    if (a.datePublished !== b.datePublished) {
      if (a.datePublished === null) return 1;
      if (b.datePublished === null) return -1;
      return a.datePublished.localeCompare(b.datePublished);
    }
    return 0;
  }

  async getResolvedCitedRegulations(guidanceDocId: number): Promise<ResolvedRegulationCitation[]> {
    // Get the guidance document's cites_regulations array
    const [doc] = await this.db
      .select({ citesRegulations: guidanceDocuments.citesRegulations })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.id, guidanceDocId))
      .limit(1);

    if (!doc?.citesRegulations || doc.citesRegulations.length === 0) return [];

    // Get all resolved cross-references from this guidance doc to regulations
    const resolvedRefs = await this.db
      .select({
        rawText: crossReferences.rawText,
        targetDocumentId: crossReferences.targetDocumentId,
        targetTitle: regulatoryDocuments.title,
      })
      .from(crossReferences)
      .leftJoin(regulatoryDocuments, eq(crossReferences.targetDocumentId, regulatoryDocuments.id))
      .where(
        and(
          eq(crossReferences.sourceGuidanceId, guidanceDocId),
          sql`${crossReferences.targetDocumentId} IS NOT NULL`
        )
      );

    // Build a map from raw_text → resolved regulation
    const refMap = new Map<string, { regulationId: number; title: string | null }>();
    for (const ref of resolvedRefs) {
      if (ref.targetDocumentId !== null) {
        refMap.set(ref.rawText, {
          regulationId: ref.targetDocumentId,
          title: ref.targetTitle,
        });
      }
    }

    // Match each citation text against the resolved refs
    return doc.citesRegulations.map(citationText => {
      // Try exact match first
      const match = refMap.get(citationText);
      if (match) {
        return {
          citationText,
          regulationId: match.regulationId,
          regulationTitle: match.title,
        };
      }

      // Try partial match (citation text contained in raw_text or vice versa)
      for (const [rawText, resolved] of refMap) {
        if (rawText.includes(citationText) || citationText.includes(rawText)) {
          return {
            citationText,
            regulationId: resolved.regulationId,
            regulationTitle: resolved.title,
          };
        }
      }

      return {
        citationText,
        regulationId: null,
        regulationTitle: null,
      };
    });
  }

  async getLineageStats(jurisdiction: JurisdictionCode): Promise<LineageStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    // 1. Count superseded + fetch all docs with lineage fields in parallel
    const [supersededResult, lineageDocsResult] = await Promise.all([
      this.db.execute<{ count: number }>(sql`
        SELECT count(*)::int as count
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND status = 'superseded'
      `),
      this.db.execute<{
        id: number;
        canonical_ref: string | null;
        title: string;
        status: string | null;
        year: number | null;
        agency: string;
        supersedes: string[] | null;
        superseded_by: string | null;
        revision_of: string | null;
      }>(sql`
        SELECT id, canonical_ref, title, status, year, agency,
               supersedes, superseded_by, revision_of
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND (supersedes IS NOT NULL
            OR superseded_by IS NOT NULL
            OR revision_of IS NOT NULL)
      `),
    ]);

    const supersededCount = supersededResult.rows[0].count;
    const lineageDocs = lineageDocsResult.rows;
    const docsWithLineage = lineageDocs.length;

    // Build a map of canonicalRef → doc for quick lookup
    const docsByRef = new Map<string, typeof lineageDocs[number]>();
    for (const doc of lineageDocs) {
      if (doc.canonical_ref) {
        docsByRef.set(doc.canonical_ref, doc);
      }
    }

    // Collect all referenced canonical refs (for orphan detection and reverse lookup)
    const allReferencedRefs = new Set<string>();
    for (const doc of lineageDocs) {
      if (doc.supersedes) {
        for (const ref of doc.supersedes) {
          allReferencedRefs.add(ref);
        }
      }
      if (doc.superseded_by) allReferencedRefs.add(doc.superseded_by);
      if (doc.revision_of) allReferencedRefs.add(doc.revision_of);
    }

    // Also fetch docs that are referenced but don't have lineage fields themselves
    const missingRefs = [...allReferencedRefs].filter(ref => !docsByRef.has(ref));
    if (missingRefs.length > 0) {
      const additionalDocs = await this.db.execute<{
        id: number;
        canonical_ref: string | null;
        title: string;
        status: string | null;
        year: number | null;
        agency: string;
        supersedes: string[] | null;
        superseded_by: string | null;
        revision_of: string | null;
      }>(sql`
        SELECT id, canonical_ref, title, status, year, agency,
               supersedes, superseded_by, revision_of
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND canonical_ref = ANY(ARRAY[${sql.join(missingRefs.map(r => sql`${r}`), sql`, `)}]::text[])
      `);
      for (const doc of additionalDocs.rows) {
        if (doc.canonical_ref && !docsByRef.has(doc.canonical_ref)) {
          docsByRef.set(doc.canonical_ref, doc);
        }
      }
    }

    // 4. Count orphaned references: refs not in docsByRef after fetching missing refs
    const orphanedReferences = [...allReferencedRefs].filter(ref => !docsByRef.has(ref)).length;

    // 5. Build connected components (union-find)
    const parent = new Map<string, string>();

    function find(x: string): string {
      let root = x;
      while (parent.get(root) !== root) {
        root = parent.get(root) ?? root;
      }
      // Path compression
      let current = x;
      while (current !== root) {
        const next = parent.get(current) ?? current;
        parent.set(current, root);
        current = next;
      }
      return root;
    }

    function union(a: string, b: string) {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) {
        parent.set(rootA, rootB);
      }
    }

    // Initialize all known refs
    for (const ref of docsByRef.keys()) {
      parent.set(ref, ref);
    }

    // Connect docs via lineage relationships
    for (const doc of docsByRef.values()) {
      if (!doc.canonical_ref) continue;
      if (doc.supersedes) {
        for (const ref of doc.supersedes) {
          if (docsByRef.has(ref)) {
            union(doc.canonical_ref, ref);
          }
        }
      }
      if (doc.superseded_by && docsByRef.has(doc.superseded_by)) {
        union(doc.canonical_ref, doc.superseded_by);
      }
      if (doc.revision_of && docsByRef.has(doc.revision_of)) {
        union(doc.canonical_ref, doc.revision_of);
      }
    }

    // Group docs into components
    const components = new Map<string, string[]>();
    for (const ref of docsByRef.keys()) {
      const root = find(ref);
      const group = components.get(root);
      if (group) {
        group.push(ref);
      } else {
        components.set(root, [ref]);
      }
    }

    // 6. Build DocumentFamily for each component with >1 member
    const families: DocumentFamily[] = [];
    for (const memberRefs of components.values()) {
      if (memberRefs.length < 2) continue;

      const members: LineageFamilyMember[] = memberRefs
        .map(ref => {
          const doc = docsByRef.get(ref)!;
          return {
            id: doc.id,
            canonicalRef: ref,
            title: doc.title,
            status: doc.status,
            year: doc.year,
          };
        })
        .sort((a, b) => {
          // Sort oldest → newest by year (nulls last), then by id
          if (a.year !== b.year) {
            if (a.year === null) return 1;
            if (b.year === null) return -1;
            return a.year - b.year;
          }
          return a.id - b.id;
        });

      const activeDoc = members.find(m => m.status !== 'superseded' && m.status !== 'expired');
      const oldestMember = members[0];
      const agency = docsByRef.get(oldestMember.canonicalRef)?.agency ?? '';

      families.push({
        familyId: oldestMember.canonicalRef,
        members,
        chainLength: members.length,
        currentActiveId: activeDoc?.id ?? null,
        agency,
      });
    }

    // Sort families by chain length descending, return top 50
    families.sort((a, b) => b.chainLength - a.chainLength);

    return {
      docsWithLineage,
      supersededCount,
      orphanedReferences,
      totalFamilies: families.length,
      families: families.slice(0, 50),
    };
  }

  async getReadabilityStats(jurisdiction: JurisdictionCode): Promise<GuidanceReadabilityStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const [countsResult, avgsResult, gradeDistResult, byAgencyResult, audienceTagsResult] = await Promise.all([
      // Query 1: Total docs and docs with metrics
      this.db.execute<{ total: number; with_metrics: number }>(sql`
        SELECT
          count(*)::int as total,
          count(*) FILTER (WHERE flesch_kincaid_grade IS NOT NULL)::int as with_metrics
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
      `),

      // Query 2: Averages for all metrics
      this.db.execute<{
        avg_reading_ease: number | null;
        avg_grade_level: number | null;
        avg_gunning_fog: number | null;
        avg_ari: number | null;
        avg_coleman_liau: number | null;
        avg_smog: number | null;
        avg_dale_chall: number | null;
        avg_linsear: number | null;
        avg_word_count: number | null;
        avg_sentence_count: number | null;
        avg_difficult_word_pct: number | null;
      }>(sql`
        SELECT
          avg(flesch_reading_ease)::numeric(5,1) as avg_reading_ease,
          avg(flesch_kincaid_grade)::numeric(5,1) as avg_grade_level,
          avg(gunning_fog)::numeric(5,1) as avg_gunning_fog,
          avg(automated_readability_index)::numeric(5,1) as avg_ari,
          avg(coleman_liau_index)::numeric(5,1) as avg_coleman_liau,
          avg(smog_index)::numeric(5,1) as avg_smog,
          avg(dale_chall_readability_score)::numeric(5,1) as avg_dale_chall,
          avg(linsear_write_formula)::numeric(5,1) as avg_linsear,
          avg(word_count)::numeric(10,0) as avg_word_count,
          avg(sentence_count)::numeric(10,0) as avg_sentence_count,
          avg(CASE WHEN word_count > 0 THEN (difficult_word_count::numeric / word_count) * 100 END)::numeric(5,1) as avg_difficult_word_pct
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND flesch_kincaid_grade IS NOT NULL
      `),

      // Query 3: Grade distribution
      this.db.execute<{ grade: string; count: number }>(sql`
        SELECT
          CASE
            WHEN flesch_kincaid_grade < 8 THEN 'Below 8th'
            WHEN flesch_kincaid_grade < 10 THEN '8th-10th'
            WHEN flesch_kincaid_grade < 12 THEN '10th-12th'
            WHEN flesch_kincaid_grade < 14 THEN '12th-14th'
            WHEN flesch_kincaid_grade < 16 THEN '14th-16th'
            WHEN flesch_kincaid_grade < 18 THEN '16th-18th'
            ELSE 'Above 18th'
          END as grade,
          count(*)::int as count
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND flesch_kincaid_grade IS NOT NULL
        GROUP BY 1
        ORDER BY min(flesch_kincaid_grade)
      `),

      // Query 4: Reading ease by agency (top 15, hardest first)
      this.db.execute<{
        agency: string;
        avg_reading_ease: number;
        avg_grade_level: number;
        doc_count: number;
      }>(sql`
        SELECT
          agency,
          avg(flesch_reading_ease)::numeric(5,1) as avg_reading_ease,
          avg(flesch_kincaid_grade)::numeric(5,1) as avg_grade_level,
          count(*)::int as doc_count
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND flesch_kincaid_grade IS NOT NULL
        GROUP BY agency
        HAVING count(*) >= 2
        ORDER BY avg_reading_ease ASC
        LIMIT 15
      `),

      // Query 5: Distinct audience tags with counts (for filter dropdown)
      this.db.execute<{ tag: string; count: number }>(sql`
        SELECT unnest(target_audience) AS tag, count(*)::int AS count
        FROM guidance_documents
        WHERE jurisdiction = ${stateUpper}
          AND flesch_kincaid_grade IS NOT NULL
        GROUP BY 1
        ORDER BY count DESC
      `),
    ]);

    const counts = countsResult.rows[0];
    const avgs = avgsResult.rows[0];
    const toNum = (v: number | null) => v !== null ? Number(v) : null;

    return {
      totalDocs: counts.total,
      docsWithMetrics: counts.with_metrics,
      avgFleschReadingEase: toNum(avgs.avg_reading_ease),
      avgFleschKincaidGrade: toNum(avgs.avg_grade_level),
      avgGunningFog: toNum(avgs.avg_gunning_fog),
      avgAutomatedReadabilityIndex: toNum(avgs.avg_ari),
      avgColemanLiauIndex: toNum(avgs.avg_coleman_liau),
      avgSmogIndex: toNum(avgs.avg_smog),
      avgDaleChallScore: toNum(avgs.avg_dale_chall),
      avgLinsearWriteFormula: toNum(avgs.avg_linsear),
      avgWordCount: toNum(avgs.avg_word_count),
      avgSentenceCount: toNum(avgs.avg_sentence_count),
      avgDifficultWordPct: toNum(avgs.avg_difficult_word_pct),
      gradeDistribution: gradeDistResult.rows.map(row => ({
        grade: row.grade,
        count: row.count,
      })),
      readingEaseByAgency: byAgencyResult.rows.map(row => ({
        agency: row.agency,
        avgReadingEase: Number(row.avg_reading_ease),
        avgGradeLevel: Number(row.avg_grade_level),
        docCount: row.doc_count,
      })),
      audienceTags: audienceTagsResult.rows.map(row => ({
        tag: row.tag,
        count: row.count,
      })),
    };
  }

  async getReadabilityByAgencyFiltered(
    jurisdiction: JurisdictionCode,
    audienceTags: string[]
  ): Promise<ReadabilityByAgencyRow[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const result = await this.db.execute<{
      agency: string;
      avg_reading_ease: number;
      avg_grade_level: number;
      doc_count: number;
    }>(sql`
      SELECT
        agency,
        avg(flesch_reading_ease)::numeric(5,1) as avg_reading_ease,
        avg(flesch_kincaid_grade)::numeric(5,1) as avg_grade_level,
        count(*)::int as doc_count
      FROM guidance_documents
      WHERE jurisdiction = ${stateUpper}
        AND flesch_kincaid_grade IS NOT NULL
        AND target_audience && ARRAY[${sql.join(audienceTags.map(t => sql`${t}`), sql`, `)}]::text[]
      GROUP BY agency
      HAVING count(*) >= 2
      ORDER BY avg_reading_ease ASC
      LIMIT 15
    `);

    return result.rows.map(row => ({
      agency: row.agency,
      avgReadingEase: Number(row.avg_reading_ease),
      avgGradeLevel: Number(row.avg_grade_level),
      docCount: row.doc_count,
    }));
  }

  async getReadabilityCrossCutStats(jurisdiction: JurisdictionCode): Promise<ReadabilityCrossCutStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    // Common CTE: guidance docs with readability + compliance count + JenAI avg severity
    const baseCte = sql`
      WITH doc_metrics AS (
        SELECT
          gd.id,
          gd.flesch_reading_ease,
          gd.flesch_kincaid_grade,
          gd.audience_direction,
          gd.audience_expertise,
          gd.target_audience,
          COALESCE(ci_counts.issue_count, 0) AS compliance_issue_count,
          ji_avgs.avg_severity AS jenai_avg_severity
        FROM guidance_documents gd
        LEFT JOIN (
          SELECT guidance_document_id, count(*)::int AS issue_count
          FROM compliance_issues
          WHERE guidance_document_id IS NOT NULL
          GROUP BY guidance_document_id
        ) ci_counts ON gd.id = ci_counts.guidance_document_id
        LEFT JOIN (
          SELECT guidance_document_id, avg(severity)::numeric(5,1) AS avg_severity
          FROM jenai_issues
          WHERE guidance_document_id IS NOT NULL
          GROUP BY guidance_document_id
        ) ji_avgs ON gd.id = ji_avgs.guidance_document_id
        WHERE gd.jurisdiction = ${stateUpper}
          AND gd.flesch_kincaid_grade IS NOT NULL
      )
    `;

    const [byDirectionResult, byExpertiseResult, byTagResult, compByReadResult, jenaiByReadResult] = await Promise.all([
      // By audience_direction
      this.db.execute<{
        direction: string;
        avg_reading_ease: number;
        avg_grade_level: number;
        avg_compliance: number;
        avg_jenai: number | null;
        doc_count: number;
      }>(sql`
        ${baseCte}
        SELECT
          audience_direction AS direction,
          avg(flesch_reading_ease)::numeric(5,1) AS avg_reading_ease,
          avg(flesch_kincaid_grade)::numeric(5,1) AS avg_grade_level,
          avg(compliance_issue_count)::numeric(5,2) AS avg_compliance,
          avg(jenai_avg_severity)::numeric(5,1) AS avg_jenai,
          count(*)::int AS doc_count
        FROM doc_metrics
        WHERE audience_direction IS NOT NULL
        GROUP BY audience_direction
        ORDER BY doc_count DESC
      `),

      // By audience_expertise
      this.db.execute<{
        expertise: string;
        avg_reading_ease: number;
        avg_grade_level: number;
        avg_compliance: number;
        avg_jenai: number | null;
        doc_count: number;
      }>(sql`
        ${baseCte}
        SELECT
          audience_expertise AS expertise,
          avg(flesch_reading_ease)::numeric(5,1) AS avg_reading_ease,
          avg(flesch_kincaid_grade)::numeric(5,1) AS avg_grade_level,
          avg(compliance_issue_count)::numeric(5,2) AS avg_compliance,
          avg(jenai_avg_severity)::numeric(5,1) AS avg_jenai,
          count(*)::int AS doc_count
        FROM doc_metrics
        WHERE audience_expertise IS NOT NULL
        GROUP BY audience_expertise
        ORDER BY doc_count DESC
      `),

      // By target_audience tag (unnested)
      this.db.execute<{
        tag: string;
        avg_reading_ease: number;
        avg_grade_level: number;
        avg_compliance: number;
        avg_jenai: number | null;
        doc_count: number;
      }>(sql`
        ${baseCte}
        SELECT
          unnest(target_audience) AS tag,
          avg(flesch_reading_ease)::numeric(5,1) AS avg_reading_ease,
          avg(flesch_kincaid_grade)::numeric(5,1) AS avg_grade_level,
          avg(compliance_issue_count)::numeric(5,2) AS avg_compliance,
          avg(jenai_avg_severity)::numeric(5,1) AS avg_jenai,
          count(*)::int AS doc_count
        FROM doc_metrics
        WHERE target_audience IS NOT NULL
        GROUP BY 1
        HAVING count(*) >= 2
        ORDER BY doc_count DESC
      `),

      // Compliance issues by readability bucket
      this.db.execute<{
        bucket: string;
        avg_compliance: number;
        doc_count: number;
      }>(sql`
        ${baseCte}
        SELECT
          CASE
            WHEN flesch_reading_ease < 30 THEN 'Very Difficult (0-29)'
            WHEN flesch_reading_ease < 50 THEN 'Difficult (30-49)'
            WHEN flesch_reading_ease < 60 THEN 'Fairly Difficult (50-59)'
            WHEN flesch_reading_ease < 70 THEN 'Standard (60-69)'
            ELSE 'Easy (70+)'
          END AS bucket,
          avg(compliance_issue_count)::numeric(5,2) AS avg_compliance,
          count(*)::int AS doc_count
        FROM doc_metrics
        GROUP BY 1
        ORDER BY min(flesch_reading_ease)
      `),

      // JenAI severity by readability bucket
      this.db.execute<{
        bucket: string;
        avg_severity: number;
        doc_count: number;
      }>(sql`
        ${baseCte}
        SELECT
          CASE
            WHEN flesch_reading_ease < 30 THEN 'Very Difficult (0-29)'
            WHEN flesch_reading_ease < 50 THEN 'Difficult (30-49)'
            WHEN flesch_reading_ease < 60 THEN 'Fairly Difficult (50-59)'
            WHEN flesch_reading_ease < 70 THEN 'Standard (60-69)'
            ELSE 'Easy (70+)'
          END AS bucket,
          avg(jenai_avg_severity)::numeric(5,1) AS avg_severity,
          count(*)::int AS doc_count
        FROM doc_metrics
        WHERE jenai_avg_severity IS NOT NULL
        GROUP BY 1
        ORDER BY min(flesch_reading_ease)
      `),
    ]);

    const mapRow = <T extends Record<string, unknown>>(row: T) => ({
      ...row,
      avg_reading_ease: Number(row.avg_reading_ease),
      avg_grade_level: Number(row.avg_grade_level),
      avg_compliance: Number(row.avg_compliance),
      avg_jenai: row.avg_jenai !== null ? Number(row.avg_jenai) : null,
      doc_count: Number(row.doc_count),
    });

    return {
      byDirection: byDirectionResult.rows.map(r => {
        const m = mapRow(r);
        return {
          direction: r.direction,
          avgReadingEase: m.avg_reading_ease,
          avgGradeLevel: m.avg_grade_level,
          avgComplianceIssues: m.avg_compliance,
          avgJenaiSeverity: m.avg_jenai,
          docCount: m.doc_count,
        };
      }),
      byExpertise: byExpertiseResult.rows.map(r => {
        const m = mapRow(r);
        return {
          expertise: r.expertise,
          avgReadingEase: m.avg_reading_ease,
          avgGradeLevel: m.avg_grade_level,
          avgComplianceIssues: m.avg_compliance,
          avgJenaiSeverity: m.avg_jenai,
          docCount: m.doc_count,
        };
      }),
      byAudienceTag: byTagResult.rows.map(r => {
        const m = mapRow(r);
        return {
          tag: r.tag,
          avgReadingEase: m.avg_reading_ease,
          avgGradeLevel: m.avg_grade_level,
          avgComplianceIssues: m.avg_compliance,
          avgJenaiSeverity: m.avg_jenai,
          docCount: m.doc_count,
        };
      }),
      complianceByReadability: compByReadResult.rows.map(r => ({
        bucket: r.bucket,
        avgComplianceIssues: Number(r.avg_compliance),
        docCount: Number(r.doc_count),
      })),
      jenaiByReadability: jenaiByReadResult.rows.map(r => ({
        bucket: r.bucket,
        avgSeverity: Number(r.avg_severity),
        docCount: Number(r.doc_count),
      })),
    };
  }

  private buildFilterSqlFragments(
    jurisdiction: JurisdictionCode,
    filters?: GuidancePaginationOptions['filters']
  ): { whereClauses: ReturnType<typeof sql>[]; params: unknown[] } {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const clauses: ReturnType<typeof sql>[] = [sql`gd.jurisdiction = ${stateUpper}`];

    if (filters) {
      if (filters.agency) clauses.push(sql`gd.agency = ${filters.agency}`);
      if (filters.docType) clauses.push(sql`gd.doc_type = ${filters.docType}`);
      if (filters.policyCategory) clauses.push(sql`gd.policy_category = ${filters.policyCategory}`);
      if (filters.status) clauses.push(sql`gd.status = ${filters.status}`);
      if (filters.yearFrom) clauses.push(sql`gd.year >= ${filters.yearFrom}`);
      if (filters.yearTo) clauses.push(sql`gd.year <= ${filters.yearTo}`);
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        clauses.push(sql`(gd.title ILIKE ${searchTerm} OR gd.canonical_ref ILIKE ${searchTerm} OR gd.agency ILIKE ${searchTerm})`);
      }
      if (filters.audienceDirection) clauses.push(sql`gd.audience_direction = ${filters.audienceDirection}`);
      if (filters.sectionType) clauses.push(sql`gd.section_type = ${filters.sectionType}`);
      if (filters.hasForm) clauses.push(sql`gd.has_form = true`);
      if (filters.hasIbr) clauses.push(sql`gd.has_ibr = true`);
    }

    return { whereClauses: clauses, params: [] };
  }

  async getGroupedPaginated(options: {
    jurisdiction: JurisdictionCode;
    groupBy: GuidanceGroupByDimension;
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: GuidancePaginationOptions['filters'];
  }): Promise<PaginatedGuidanceGroupResult> {
    const { jurisdiction, groupBy, page, pageSize, sortBy = 'documentCount', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const dimensionCol: Record<GuidanceGroupByDimension, string> = {
      agency: 'gd.agency',
      docType: 'gd.doc_type',
      policyCategory: 'gd.policy_category',
    };
    const col = dimensionCol[groupBy];

    const { whereClauses } = this.buildFilterSqlFragments(jurisdiction, filters);
    const whereSQL = sql.join(whereClauses, sql` AND `);

    const sortColMap: Record<string, ReturnType<typeof sql>> = {
      groupKey: sql`group_key`,
      documentCount: sql`document_count`,
      complianceIssueCount: sql`compliance_issue_count`,
      jenaiIssueCount: sql`jenai_issue_count`,
      avgReadingEase: sql`avg_reading_ease`,
    };
    const sortCol = sortColMap[sortBy] ?? sql`document_count`;
    const orderDir = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;

    const dimColSql = sql.raw(col);

    const [countResult, dataResult] = await Promise.all([
      this.db.execute<{ total: number }>(sql`
        SELECT COUNT(DISTINCT COALESCE(${dimColSql}, 'Unknown'))::int AS total
        FROM guidance_documents gd
        WHERE ${whereSQL}
      `),
      this.db.execute<{
        group_key: string;
        document_count: number;
        compliance_issue_count: number;
        jenai_issue_count: number;
        year_min: number | null;
        year_max: number | null;
        avg_reading_ease: number | null;
        avg_grade_level: number | null;
      }>(sql`
        SELECT
          COALESCE(${dimColSql}, 'Unknown') AS group_key,
          COUNT(DISTINCT gd.id)::int AS document_count,
          COUNT(DISTINCT ci.id)::int AS compliance_issue_count,
          COUNT(DISTINCT ji.id)::int AS jenai_issue_count,
          MIN(gd.year) AS year_min,
          MAX(gd.year) AS year_max,
          AVG(gd.flesch_reading_ease)::numeric(5,1) AS avg_reading_ease,
          AVG(gd.flesch_kincaid_grade)::numeric(5,1) AS avg_grade_level
        FROM guidance_documents gd
        LEFT JOIN compliance_issues ci ON ci.guidance_document_id = gd.id
        LEFT JOIN jenai_issues ji ON ji.guidance_document_id = gd.id
        WHERE ${whereSQL}
        GROUP BY 1
        ORDER BY ${sortCol} ${orderDir}
        LIMIT ${pageSize} OFFSET ${offset}
      `),
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    const toNum = (v: number | null) => v !== null ? Number(v) : null;

    return {
      data: dataResult.rows.map(row => ({
        groupKey: row.group_key,
        documentCount: row.document_count,
        complianceIssueCount: row.compliance_issue_count,
        jenaiIssueCount: row.jenai_issue_count,
        yearMin: row.year_min,
        yearMax: row.year_max,
        avgFleschReadingEase: toNum(row.avg_reading_ease),
        avgFleschKincaidGrade: toNum(row.avg_grade_level),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDocumentsForGroup(
    jurisdiction: JurisdictionCode,
    groupBy: GuidanceGroupByDimension,
    groupValue: string,
    filters?: GuidancePaginationOptions['filters']
  ): Promise<GuidanceGroupDocumentsResult> {
    const conditions = this.buildFilterConditions(jurisdiction, filters);

    // Add the group constraint
    const dimensionField = {
      agency: guidanceDocuments.agency,
      docType: guidanceDocuments.docType,
      policyCategory: guidanceDocuments.policyCategory,
    }[groupBy];

    if (groupValue === 'Unknown') {
      conditions.push(sql`${dimensionField} IS NULL`);
    } else {
      conditions.push(eq(dimensionField, groupValue));
    }

    const whereClause = and(...conditions);

    const issueCountSq = this.db
      .select({
        guidanceDocumentId: complianceIssues.guidanceDocumentId,
        count: sql<number>`count(*)::int`.as('issue_count'),
      })
      .from(complianceIssues)
      .groupBy(complianceIssues.guidanceDocumentId)
      .as('issue_counts');

    const jenaiCountSq = this.db
      .select({
        guidanceDocumentId: jenaiIssues.guidanceDocumentId,
        count: sql<number>`count(*)::int`.as('jenai_count'),
      })
      .from(jenaiIssues)
      .groupBy(jenaiIssues.guidanceDocumentId)
      .as('jenai_counts');

    const results = await this.db
      .select({
        id: guidanceDocuments.id,
        catalogId: guidanceDocuments.catalogId,
        canonicalRef: guidanceDocuments.canonicalRef,
        title: guidanceDocuments.title,
        agency: guidanceDocuments.agency,
        docType: guidanceDocuments.docType,
        policyCategory: guidanceDocuments.policyCategory,
        status: guidanceDocuments.status,
        year: guidanceDocuments.year,
        url: guidanceDocuments.url,
        complianceIssueCount: sql<number>`coalesce(${issueCountSq.count}, 0)`.mapWith(Number),
        jenaiIssueCount: sql<number>`coalesce(${jenaiCountSq.count}, 0)`.mapWith(Number),
        fleschReadingEase: guidanceDocuments.fleschReadingEase,
        excludeFromAnalysis: guidanceDocuments.excludeFromAnalysis,
      })
      .from(guidanceDocuments)
      .leftJoin(issueCountSq, eq(guidanceDocuments.id, issueCountSq.guidanceDocumentId))
      .leftJoin(jenaiCountSq, eq(guidanceDocuments.id, jenaiCountSq.guidanceDocumentId))
      .where(whereClause)
      .orderBy(desc(guidanceDocuments.year), asc(guidanceDocuments.title));

    // Bucket by year in JS
    const yearMap = new Map<number | null, GuidanceDocumentListItem[]>();
    for (const doc of results) {
      const key = doc.year;
      const bucket = yearMap.get(key);
      if (bucket) {
        bucket.push(doc);
      } else {
        yearMap.set(key, [doc]);
      }
    }

    // Sort year keys descending (null last)
    const sortedYears = [...yearMap.keys()].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    });

    return {
      documents: results,
      byYear: sortedYears.map(year => ({
        year,
        documents: yearMap.get(year)!,
      })),
    };
  }
}
