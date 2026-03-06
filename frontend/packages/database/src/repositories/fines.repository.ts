import { eq, and, desc, asc, sql, count, ilike, or, gte, lte, isNotNull } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { finesFeesPenalties, type FineFeePenalty } from '../schema/fines-fees-penalties';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { guidanceDocuments } from '../schema/guidance-documents';
import { type JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

export interface FineWithContext extends FineFeePenalty {
  sourceDocument: {
    id: number;
    title: string | null;
    hierarchyPath: string | null;
    url: string | null;
    type: 'regulation' | 'guidance';
  };
}

export interface FinesFilterOptions {
  jurisdiction: JurisdictionCode;
  penaltyType?: string;
  agency?: string;
  search?: string;
  amountMin?: number;
  amountMax?: number;
  sourceType?: 'regulation' | 'guidance';
  whoPays?: string;
  perUnit?: string;
}

export interface FinesPaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'penaltyType' | 'amount' | 'responsibleAgency' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<FinesFilterOptions, 'jurisdiction'>;
}

export interface PaginatedFinesResult {
  data: FineWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FinesOverviewStats {
  total: number;
  uniqueAgencies: number;
  uniqueDocs: number;
  byType: Array<{ type: string; count: number }>;
  byAgency: Array<{ agency: string; count: number }>;
}

export class FinesRepository extends BaseRepository {
  async getAllPaginated(options: FinesPaginationOptions): Promise<PaginatedFinesResult> {
    const { jurisdiction, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const whereClause = this.buildWhereClause(jurisdiction, filters);

    // Total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(finesFeesPenalties)
      .where(whereClause);

    // Sort column
    const sortColumn = {
      penaltyType: finesFeesPenalties.penaltyType,
      amount: finesFeesPenalties.amountMax,
      responsibleAgency: finesFeesPenalties.responsibleAgency,
      createdAt: finesFeesPenalties.createdAt,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const results = await this.db
      .select(this.finesSelectFields())
      .from(finesFeesPenalties)
      .leftJoin(regulatoryDocuments, eq(finesFeesPenalties.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(finesFeesPenalties.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, asc(finesFeesPenalties.id))
      .limit(pageSize)
      .offset(offset);

    const data = results.map(row => this.mapToFineWithContext(row));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getOverviewStats(jurisdiction: JurisdictionCode): Promise<FinesOverviewStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const baseCondition = and(
      eq(finesFeesPenalties.jurisdiction, stateUpper),
      eq(finesFeesPenalties.llmConfirmed, true)
    );

    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        uniqueAgencies: sql<number>`count(distinct ${finesFeesPenalties.responsibleAgency})::int`,
        uniqueDocs: sql<number>`(count(distinct ${finesFeesPenalties.documentId}) + count(distinct ${finesFeesPenalties.guidanceDocumentId}))::int`,
      })
      .from(finesFeesPenalties)
      .where(baseCondition);

    const byType = await this.db
      .select({
        type: finesFeesPenalties.penaltyType,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .where(baseCondition)
      .groupBy(finesFeesPenalties.penaltyType)
      .orderBy(desc(sql`count(*)`));

    const byAgency = await this.db
      .select({
        agency: finesFeesPenalties.responsibleAgency,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .where(and(baseCondition, isNotNull(finesFeesPenalties.responsibleAgency)))
      .groupBy(finesFeesPenalties.responsibleAgency)
      .orderBy(desc(sql`count(*)`));

    return {
      total: stats.total,
      uniqueAgencies: stats.uniqueAgencies,
      uniqueDocs: stats.uniqueDocs,
      byType: byType.map(row => ({ type: row.type, count: row.count })),
      byAgency: byAgency.map(row => ({
        agency: row.agency || 'Unknown',
        count: row.count,
      })),
    };
  }

  async getAgencies(jurisdiction: JurisdictionCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ agency: finesFeesPenalties.responsibleAgency })
      .from(finesFeesPenalties)
      .where(and(
        eq(finesFeesPenalties.jurisdiction, normalizeJurisdiction(jurisdiction)),
        eq(finesFeesPenalties.llmConfirmed, true),
        isNotNull(finesFeesPenalties.responsibleAgency)
      ))
      .orderBy(asc(finesFeesPenalties.responsibleAgency));

    return result
      .map(r => r.agency)
      .filter((a): a is string => a !== null);
  }

  async getExportData(jurisdiction: JurisdictionCode, filters?: Omit<FinesFilterOptions, 'jurisdiction'>): Promise<FineWithContext[]> {
    const whereClause = this.buildWhereClause(jurisdiction, filters);

    const results = await this.db
      .select(this.finesSelectFields())
      .from(finesFeesPenalties)
      .leftJoin(regulatoryDocuments, eq(finesFeesPenalties.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(finesFeesPenalties.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause)
      .orderBy(asc(finesFeesPenalties.penaltyType), asc(finesFeesPenalties.id));

    return results.map(row => this.mapToFineWithContext(row));
  }

  async getWhoPaysValues(jurisdiction: JurisdictionCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ whoPays: finesFeesPenalties.whoPays })
      .from(finesFeesPenalties)
      .where(and(
        eq(finesFeesPenalties.jurisdiction, normalizeJurisdiction(jurisdiction)),
        eq(finesFeesPenalties.llmConfirmed, true),
        isNotNull(finesFeesPenalties.whoPays)
      ))
      .orderBy(asc(finesFeesPenalties.whoPays));

    return result
      .map(r => r.whoPays)
      .filter((v): v is string => v !== null);
  }

  async getPerUnitValues(jurisdiction: JurisdictionCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ perUnit: finesFeesPenalties.perUnit })
      .from(finesFeesPenalties)
      .where(and(
        eq(finesFeesPenalties.jurisdiction, normalizeJurisdiction(jurisdiction)),
        eq(finesFeesPenalties.llmConfirmed, true),
        isNotNull(finesFeesPenalties.perUnit)
      ))
      .orderBy(asc(finesFeesPenalties.perUnit));

    return result
      .map(r => r.perUnit)
      .filter((v): v is string => v !== null);
  }

  async getExportDataGroupedByAgency(
    jurisdiction: JurisdictionCode,
    filters?: Omit<FinesFilterOptions, 'jurisdiction'>
  ): Promise<Map<string, FineWithContext[]>> {
    const data = await this.getExportData(jurisdiction, filters);
    const grouped = new Map<string, FineWithContext[]>();

    for (const row of data) {
      const agency = row.responsibleAgency || 'Unassigned';
      const existing = grouped.get(agency);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(agency, [row]);
      }
    }

    return grouped;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildWhereClause(jurisdiction: JurisdictionCode, filters?: Omit<FinesFilterOptions, 'jurisdiction'>) {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const conditions: ReturnType<typeof eq>[] = [
      eq(finesFeesPenalties.jurisdiction, stateUpper),
      eq(finesFeesPenalties.llmConfirmed, true),
    ];

    if (filters) {
      if (filters.penaltyType && filters.penaltyType !== 'all') {
        conditions.push(eq(finesFeesPenalties.penaltyType, filters.penaltyType));
      }
      if (filters.agency) {
        conditions.push(eq(finesFeesPenalties.responsibleAgency, filters.agency));
      }
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(finesFeesPenalties.violationDescription, searchTerm),
            ilike(finesFeesPenalties.context, searchTerm),
            ilike(finesFeesPenalties.requirementQuote, searchTerm),
            ilike(finesFeesPenalties.amount, searchTerm)
          )!
        );
      }
      if (filters.amountMin !== undefined) {
        conditions.push(gte(finesFeesPenalties.amountMin, String(filters.amountMin)));
      }
      if (filters.amountMax !== undefined) {
        conditions.push(lte(finesFeesPenalties.amountMax, String(filters.amountMax)));
      }
      if (filters.sourceType === 'regulation') {
        conditions.push(isNotNull(finesFeesPenalties.documentId));
      } else if (filters.sourceType === 'guidance') {
        conditions.push(isNotNull(finesFeesPenalties.guidanceDocumentId));
      }
      if (filters.whoPays) {
        conditions.push(eq(finesFeesPenalties.whoPays, filters.whoPays));
      }
      if (filters.perUnit) {
        conditions.push(eq(finesFeesPenalties.perUnit, filters.perUnit));
      }
    }

    return and(...conditions);
  }

  private finesSelectFields() {
    return {
      id: finesFeesPenalties.id,
      documentId: finesFeesPenalties.documentId,
      guidanceDocumentId: finesFeesPenalties.guidanceDocumentId,
      penaltyType: finesFeesPenalties.penaltyType,
      amount: finesFeesPenalties.amount,
      amountMin: finesFeesPenalties.amountMin,
      amountMax: finesFeesPenalties.amountMax,
      perUnit: finesFeesPenalties.perUnit,
      whoPays: finesFeesPenalties.whoPays,
      responsibleAgency: finesFeesPenalties.responsibleAgency,
      violationDescription: finesFeesPenalties.violationDescription,
      requirementQuote: finesFeesPenalties.requirementQuote,
      context: finesFeesPenalties.context,
      termMatched: finesFeesPenalties.termMatched,
      llmConfirmed: finesFeesPenalties.llmConfirmed,
      jurisdiction: finesFeesPenalties.jurisdiction,
      url: finesFeesPenalties.url,
      reviewStatus: finesFeesPenalties.reviewStatus,
      reviewedBy: finesFeesPenalties.reviewedBy,
      reviewedAt: finesFeesPenalties.reviewedAt,
      teamNotes: finesFeesPenalties.teamNotes,
      priority: finesFeesPenalties.priority,
      developerStatus: finesFeesPenalties.developerStatus,
      developerAssigned: finesFeesPenalties.developerAssigned,
      developerNotes: finesFeesPenalties.developerNotes,
      resolutionType: finesFeesPenalties.resolutionType,
      resolutionComments: finesFeesPenalties.resolutionComments,
      developerQuestion: finesFeesPenalties.developerQuestion,
      developerCheckedAt: finesFeesPenalties.developerCheckedAt,
      createdAt: finesFeesPenalties.createdAt,
      // Regulation fields
      regId: regulatoryDocuments.id,
      regTitle: regulatoryDocuments.title,
      regHierarchyPath: regulatoryDocuments.hierarchyPath,
      regUrl: regulatoryDocuments.url,
      // Guidance fields
      guidId: guidanceDocuments.id,
      guidTitle: guidanceDocuments.title,
      guidUrl: guidanceDocuments.url,
    };
  }

  private mapToFineWithContext(row: {
    id: number;
    documentId: number | null;
    guidanceDocumentId: number | null;
    penaltyType: string;
    amount: string | null;
    amountMin: string | null;
    amountMax: string | null;
    perUnit: string | null;
    whoPays: string | null;
    responsibleAgency: string | null;
    violationDescription: string | null;
    requirementQuote: string | null;
    context: string;
    termMatched: string | null;
    llmConfirmed: boolean | null;
    jurisdiction: string;
    url: string | null;
    reviewStatus: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
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
    regId: number | null;
    regTitle: string | null;
    regHierarchyPath: string | null;
    regUrl: string | null;
    guidId: number | null;
    guidTitle: string | null;
    guidUrl: string | null;
  }): FineWithContext {
    const isGuidance = row.guidanceDocumentId !== null;

    return {
      id: Number(row.id),
      documentId: row.documentId ? Number(row.documentId) : null,
      guidanceDocumentId: row.guidanceDocumentId ? Number(row.guidanceDocumentId) : null,
      penaltyType: row.penaltyType,
      amount: row.amount,
      amountMin: row.amountMin,
      amountMax: row.amountMax,
      perUnit: row.perUnit,
      whoPays: row.whoPays,
      responsibleAgency: row.responsibleAgency,
      violationDescription: row.violationDescription,
      requirementQuote: row.requirementQuote,
      context: row.context,
      termMatched: row.termMatched,
      llmConfirmed: row.llmConfirmed,
      jurisdiction: row.jurisdiction,
      url: row.url,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
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
      sourceDocument: isGuidance
        ? {
            id: row.guidId!,
            title: row.guidTitle,
            hierarchyPath: null,
            url: row.guidUrl,
            type: 'guidance',
          }
        : {
            id: row.regId!,
            title: row.regTitle,
            hierarchyPath: row.regHierarchyPath,
            url: row.regUrl,
            type: 'regulation',
          },
    };
  }
}
