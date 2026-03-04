import { eq, and, desc, asc, sql, count, ilike, or, gte, lte, inArray } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { guidanceDocuments } from '../schema/guidance-documents';
import { complianceIssues } from '../schema/compliance-issues';
import { crossReferences } from '../schema/cross-references';
import { regulatoryDocuments } from '../schema/regulatory-documents';
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
}
