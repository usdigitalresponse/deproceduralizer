import { eq, and, desc, asc, sql, count, ilike, or } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { incorporationsByReference, IncorporationByReference } from '../schema/incorporations-by-reference';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { StateCode, normalizeState } from '../schema/constants';

export interface IbrWithContext extends IncorporationByReference {
  regulation: {
    id: number;
    title: string | null;
    hierarchyPath: string | null;
    url: string | null;
  };
}

export interface IbrFilterOptions {
  state: StateCode;
  sourceOrganization?: string;
  search?: string;
}

export interface IbrPaginationOptions {
  state: StateCode;
  page: number;
  pageSize: number;
  sortBy?: 'sourceOrganization' | 'incorporatedDocument' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<IbrFilterOptions, 'state'>;
}

export interface PaginatedIbrsResult {
  data: IbrWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IbrOverviewStats {
  total: number;
  uniqueOrgs: number;
  uniqueDocs: number;
  byOrg: Array<{ organization: string; count: number }>;
}

export interface IbrTopStandard {
  incorporatedDocument: string | null;
  sourceOrganization: string | null;
  version: string | null;
  count: number;
}

export class IbrRepository extends BaseRepository {
  async getById(id: number): Promise<IbrWithContext | undefined> {
    const results = await this.db
      .select({
        id: incorporationsByReference.id,
        documentId: incorporationsByReference.documentId,
        incorporatedDocument: incorporationsByReference.incorporatedDocument,
        sourceOrganization: incorporationsByReference.sourceOrganization,
        version: incorporationsByReference.version,
        requirementQuote: incorporationsByReference.requirementQuote,
        termMatched: incorporationsByReference.termMatched,
        context: incorporationsByReference.context,
        llmConfirmed: incorporationsByReference.llmConfirmed,
        state: incorporationsByReference.state,
        url: incorporationsByReference.url,
        reviewStatus: incorporationsByReference.reviewStatus,
        reviewedBy: incorporationsByReference.reviewedBy,
        reviewedAt: incorporationsByReference.reviewedAt,
        justificationNotes: incorporationsByReference.justificationNotes,
        teamNotes: incorporationsByReference.teamNotes,
        priority: incorporationsByReference.priority,
        developerStatus: incorporationsByReference.developerStatus,
        developerAssigned: incorporationsByReference.developerAssigned,
        developerNotes: incorporationsByReference.developerNotes,
        resolutionType: incorporationsByReference.resolutionType,
        resolutionComments: incorporationsByReference.resolutionComments,
        developerQuestion: incorporationsByReference.developerQuestion,
        developerCheckedAt: incorporationsByReference.developerCheckedAt,
        createdAt: incorporationsByReference.createdAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationHierarchyPath: regulatoryDocuments.hierarchyPath,
        regulationUrl: regulatoryDocuments.url,
      })
      .from(incorporationsByReference)
      .innerJoin(regulatoryDocuments, eq(incorporationsByReference.documentId, regulatoryDocuments.id))
      .where(eq(incorporationsByReference.id, id))
      .limit(1);

    if (!results[0]) return undefined;
    return this.mapToIbrWithContext(results[0]);
  }

  async getAllPaginated(options: IbrPaginationOptions): Promise<PaginatedIbrsResult> {
    const { state, page, pageSize, sortBy = 'sourceOrganization', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [
      eq(incorporationsByReference.state, normalizeState(state)),
    ];

    if (filters) {
      if (filters.sourceOrganization) {
        conditions.push(eq(incorporationsByReference.sourceOrganization, filters.sourceOrganization));
      }

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(incorporationsByReference.incorporatedDocument, searchTerm),
            ilike(incorporationsByReference.context, searchTerm),
            ilike(incorporationsByReference.requirementQuote, searchTerm)
          )!
        );
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(incorporationsByReference)
      .innerJoin(regulatoryDocuments, eq(incorporationsByReference.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Build sort column
    const sortColumn = {
      sourceOrganization: incorporationsByReference.sourceOrganization,
      incorporatedDocument: incorporationsByReference.incorporatedDocument,
      createdAt: incorporationsByReference.createdAt,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(incorporationsByReference.id);

    const results = await this.db
      .select({
        id: incorporationsByReference.id,
        documentId: incorporationsByReference.documentId,
        incorporatedDocument: incorporationsByReference.incorporatedDocument,
        sourceOrganization: incorporationsByReference.sourceOrganization,
        version: incorporationsByReference.version,
        requirementQuote: incorporationsByReference.requirementQuote,
        termMatched: incorporationsByReference.termMatched,
        context: incorporationsByReference.context,
        llmConfirmed: incorporationsByReference.llmConfirmed,
        state: incorporationsByReference.state,
        url: incorporationsByReference.url,
        reviewStatus: incorporationsByReference.reviewStatus,
        reviewedBy: incorporationsByReference.reviewedBy,
        reviewedAt: incorporationsByReference.reviewedAt,
        justificationNotes: incorporationsByReference.justificationNotes,
        teamNotes: incorporationsByReference.teamNotes,
        priority: incorporationsByReference.priority,
        developerStatus: incorporationsByReference.developerStatus,
        developerAssigned: incorporationsByReference.developerAssigned,
        developerNotes: incorporationsByReference.developerNotes,
        resolutionType: incorporationsByReference.resolutionType,
        resolutionComments: incorporationsByReference.resolutionComments,
        developerQuestion: incorporationsByReference.developerQuestion,
        developerCheckedAt: incorporationsByReference.developerCheckedAt,
        createdAt: incorporationsByReference.createdAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationHierarchyPath: regulatoryDocuments.hierarchyPath,
        regulationUrl: regulatoryDocuments.url,
      })
      .from(incorporationsByReference)
      .innerJoin(regulatoryDocuments, eq(incorporationsByReference.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    const data = results.map(row => this.mapToIbrWithContext(row));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getOverviewStats(state: StateCode): Promise<IbrOverviewStats> {
    const stateUpper = normalizeState(state);
    const baseCondition = eq(incorporationsByReference.state, stateUpper);

    // Get total, unique orgs, unique docs in one query
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        uniqueOrgs: sql<number>`count(distinct ${incorporationsByReference.sourceOrganization})::int`,
        uniqueDocs: sql<number>`count(distinct ${incorporationsByReference.documentId})::int`,
      })
      .from(incorporationsByReference)
      .where(baseCondition);

    // Get by-org distribution
    const byOrg = await this.db
      .select({
        organization: incorporationsByReference.sourceOrganization,
        count: sql<number>`count(*)::int`,
      })
      .from(incorporationsByReference)
      .where(baseCondition)
      .groupBy(incorporationsByReference.sourceOrganization)
      .orderBy(desc(sql`count(*)`));

    return {
      total: stats.total,
      uniqueOrgs: stats.uniqueOrgs,
      uniqueDocs: stats.uniqueDocs,
      byOrg: byOrg.map(row => ({
        organization: row.organization || 'Unknown',
        count: row.count,
      })),
    };
  }

  async getSourceOrganizations(state: StateCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ organization: incorporationsByReference.sourceOrganization })
      .from(incorporationsByReference)
      .where(eq(incorporationsByReference.state, normalizeState(state)))
      .orderBy(asc(incorporationsByReference.sourceOrganization));

    return result
      .map(r => r.organization)
      .filter((org): org is string => org !== null);
  }

  async getTopStandards(state: StateCode, limit: number = 20): Promise<IbrTopStandard[]> {
    const result = await this.db
      .select({
        incorporatedDocument: incorporationsByReference.incorporatedDocument,
        sourceOrganization: incorporationsByReference.sourceOrganization,
        version: incorporationsByReference.version,
        count: sql<number>`count(*)::int`,
      })
      .from(incorporationsByReference)
      .where(eq(incorporationsByReference.state, normalizeState(state)))
      .groupBy(
        incorporationsByReference.incorporatedDocument,
        incorporationsByReference.sourceOrganization,
        incorporationsByReference.version
      )
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return result;
  }

  private mapToIbrWithContext(row: {
    id: number;
    documentId: number;
    incorporatedDocument: string | null;
    sourceOrganization: string | null;
    version: string | null;
    requirementQuote: string | null;
    termMatched: string | null;
    context: string;
    llmConfirmed: boolean | null;
    state: string;
    url: string;
    reviewStatus: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    justificationNotes: string | null;
    teamNotes: string | null;
    priority: number | null;
    developerStatus: string | null;
    developerAssigned: string | null;
    developerNotes: string | null;
    resolutionType: string | null;
    resolutionComments: string | null;
    developerQuestion: string | null;
    developerCheckedAt: Date | null;
    createdAt: Date | null;
    regulationId: number;
    regulationTitle: string | null;
    regulationHierarchyPath: string | null;
    regulationUrl: string | null;
  }): IbrWithContext {
    return {
      id: Number(row.id),
      documentId: Number(row.documentId),
      incorporatedDocument: row.incorporatedDocument,
      sourceOrganization: row.sourceOrganization,
      version: row.version,
      requirementQuote: row.requirementQuote,
      termMatched: row.termMatched,
      context: row.context,
      llmConfirmed: row.llmConfirmed,
      state: row.state,
      url: row.url,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      priority: row.priority,
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      createdAt: row.createdAt,
      regulation: {
        id: row.regulationId,
        title: row.regulationTitle,
        hierarchyPath: row.regulationHierarchyPath,
        url: row.regulationUrl,
      },
    };
  }
}
