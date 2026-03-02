import { eq, and, desc, asc, sql, count, ilike, or, gte, lte, inArray } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { guidanceDocuments } from '../schema/guidance-documents';
import { complianceIssues } from '../schema/compliance-issues';
import { JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

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
  complianceIssueCount: number;
}

export interface GuidanceOverviewStats {
  total: number;
  byAgency: Array<{ agency: string; count: number }>;
  byDocType: Array<{ docType: string; count: number }>;
  byPolicyCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byYear: Array<{ year: number; count: number }>;
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
  };
}

export interface PaginatedGuidanceResult {
  data: GuidanceDocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SupersedureLink {
  canonicalRef: string;
  id: number | null;
  title: string | null;
  status: string | null;
  relationship: 'supersedes' | 'superseded_by' | 'revision_of';
}

export class GuidanceDocumentsRepository extends BaseRepository {
  async getAllPaginated(options: GuidancePaginationOptions): Promise<PaginatedGuidanceResult> {
    const { jurisdiction, page, pageSize, sortBy = 'title', sortOrder = 'asc', filters } = options;
    const offset = (page - 1) * pageSize;

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
    }

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
        })
        .from(guidanceDocuments)
        .leftJoin(issueCountSq, eq(guidanceDocuments.id, issueCountSq.guidanceDocumentId))
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
        complianceIssueCount: sql<number>`(${issueCountResult})`.mapWith(Number),
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
    const [totalResult, byAgency, byDocType, byPolicyCategory, byStatus, byYear] = await Promise.all([
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
          category: guidanceDocuments.policyCategory,
          count: sql<number>`count(*)::int`,
        })
        .from(guidanceDocuments)
        .where(baseCondition)
        .groupBy(guidanceDocuments.policyCategory)
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
        category: row.category || 'Unclassified',
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
}
