import { eq, and, desc, asc, sql, count, ilike, or, gte, lte, lt, isNotNull, isNull, inArray } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { finesFeesPenalties, type FineFeePenalty } from '../schema/fines-fees-penalties';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { guidanceDocuments } from '../schema/guidance-documents';
import { agencies } from '../schema/agencies';
import { complianceIssueAnalyses } from '../schema/compliance-issue-analyses';
import { type JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

export interface FineAnalysis {
  highestTierCompleted: number;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  severity: number | null;
  finalSeverity: number | null;
  tier3SeverityAdjustment: number | null;
  argumentForRegulation: string | null;
  argumentAgainstRegulation: string | null;
  webSearchSummary: string | null;
  requirementFound: boolean | null;
  isJustified: boolean | null;
  federalMandateFound: boolean | null;
  stateHasDiscretion: boolean | null;
  easyCleanupCandidate: boolean | null;
  cleanupType: string | null;
  cleanupEffort: string | null;
  tier1Reasoning: string | null;
  tier2Reasoning: string | null;
  tier3Reasoning: string | null;
  tier3TriggerReason: string | null;
  tier3Flags: unknown;
  pipelineVersion: string | null;
}

export interface FineWithContext extends FineFeePenalty {
  agencyCanonicalName?: string | null;
  agencyLevel?: string | null;
  analysis: FineAnalysis | null;
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
  classification?: 'burdensome' | 'justified' | 'not_analyzed';
  severities?: ('high' | 'medium' | 'low' | 'false_positive' | 'unrelated')[];
  // Multi-select array filters (take precedence over singular equivalents)
  penaltyTypes?: string[];
  agencies?: string[];
  agencyIds?: number[];
  agencyLevels?: string[];
  whoPaysValues?: string[];
  perUnitValues?: string[];
  estimatedImpactValues?: string[];
}

export interface FinesPaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'penaltyType' | 'amount' | 'responsibleAgency' | 'createdAt' | 'severity';
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
  regulationCount: number;
  guidanceCount: number;
  byType: Array<{ type: string; count: number }>;
  byAgency: Array<{ agency: string; count: number }>;
  byLevel: Array<{ level: string; count: number }>;
  byWhoPays: Array<{ whoPays: string; count: number }>;
  byPerUnit: Array<{ perUnit: string; count: number }>;
  bySourceType: Array<{ sourceType: string; count: number }>;
  byClassification: Array<{ classification: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
}

/** Shape of analysis columns from the LEFT JOIN on compliance_issue_analyses */
interface AnalysisRowFields {
  analysisHighestTierCompleted: number | null;
  analysisTier1Classification: string | null;
  analysisTier2Classification: string | null;
  analysisTier3Classification: string | null;
  analysisSeverity: number | null;
  analysisFinalSeverity: number | null;
  analysisTier3SeverityAdjustment: number | null;
  analysisArgumentFor: string | null;
  analysisArgumentAgainst: string | null;
  analysisWebSearchSummary: string | null;
  analysisRequirementFound: boolean | null;
  analysisIsJustified: boolean | null;
  analysisFederalMandateFound: boolean | null;
  analysisStateHasDiscretion: boolean | null;
  analysisEasyCleanupCandidate: boolean | null;
  analysisCleanupType: string | null;
  analysisCleanupEffort: string | null;
  analysisTier1Reasoning: string | null;
  analysisTier2Reasoning: string | null;
  analysisTier3Reasoning: string | null;
  analysisTier3TriggerReason: string | null;
  analysisTier3Flags: unknown;
  analysisPipelineVersion: string | null;
}

/** Map flattened analysis row fields to the nested FineAnalysis shape, or null if no analysis */
function mapAnalysisFields(row: AnalysisRowFields): FineAnalysis | null {
  if (row.analysisHighestTierCompleted === null) return null;
  return {
    highestTierCompleted: row.analysisHighestTierCompleted,
    tier1Classification: row.analysisTier1Classification,
    tier2Classification: row.analysisTier2Classification,
    tier3Classification: row.analysisTier3Classification,
    severity: row.analysisSeverity,
    finalSeverity: row.analysisFinalSeverity,
    tier3SeverityAdjustment: row.analysisTier3SeverityAdjustment,
    argumentForRegulation: row.analysisArgumentFor,
    argumentAgainstRegulation: row.analysisArgumentAgainst,
    webSearchSummary: row.analysisWebSearchSummary,
    requirementFound: row.analysisRequirementFound,
    isJustified: row.analysisIsJustified,
    federalMandateFound: row.analysisFederalMandateFound,
    stateHasDiscretion: row.analysisStateHasDiscretion,
    easyCleanupCandidate: row.analysisEasyCleanupCandidate,
    cleanupType: row.analysisCleanupType,
    cleanupEffort: row.analysisCleanupEffort,
    tier1Reasoning: row.analysisTier1Reasoning,
    tier2Reasoning: row.analysisTier2Reasoning,
    tier3Reasoning: row.analysisTier3Reasoning,
    tier3TriggerReason: row.analysisTier3TriggerReason,
    tier3Flags: row.analysisTier3Flags,
    pipelineVersion: row.analysisPipelineVersion,
  };
}

export class FinesRepository extends BaseRepository {
  async getAllPaginated(options: FinesPaginationOptions): Promise<PaginatedFinesResult> {
    const { jurisdiction, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const whereClause = this.buildWhereClause(jurisdiction, filters);

    // Total count — must join agencies since filters may reference agencies.level
    // Also join analyses when classification filter is active
    const needsAnalysisJoin = Boolean(filters?.classification) || Boolean(filters?.severities?.length);
    const countQuery = this.db
      .select({ count: count() })
      .from(finesFeesPenalties)
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id));
    if (needsAnalysisJoin) {
      countQuery.leftJoin(complianceIssueAnalyses, this.analysisJoinCondition);
    }
    const [{ count: total }] = await countQuery.where(whereClause);

    // Sort column — use canonical name for agency sort
    const sortColumn = {
      penaltyType: finesFeesPenalties.penaltyType,
      amount: finesFeesPenalties.amountMax,
      responsibleAgency: agencies.canonicalName,
      createdAt: finesFeesPenalties.createdAt,
      severity: complianceIssueAnalyses.finalSeverity,
    }[sortBy];

    // For severity sort, always push NULLs to the bottom regardless of direction
    const primarySort = sortBy === 'severity'
      ? sql`${complianceIssueAnalyses.finalSeverity} ${sql.raw(sortOrder === 'asc' ? 'ASC' : 'DESC')} NULLS LAST`
      : sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const results = await this.db
      .select(this.finesSelectFields())
      .from(finesFeesPenalties)
      .leftJoin(regulatoryDocuments, eq(finesFeesPenalties.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(finesFeesPenalties.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id))
      .leftJoin(complianceIssueAnalyses, this.analysisJoinCondition)
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

  async getById(id: number): Promise<FineWithContext | undefined> {
    const [result] = await this.db
      .select(this.finesSelectFields())
      .from(finesFeesPenalties)
      .leftJoin(regulatoryDocuments, eq(finesFeesPenalties.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(finesFeesPenalties.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id))
      .leftJoin(complianceIssueAnalyses, this.analysisJoinCondition)
      .where(eq(finesFeesPenalties.id, id))
      .limit(1);

    if (!result) return undefined;
    return this.mapToFineWithContext(result);
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
        uniqueAgencies: sql<number>`count(distinct ${finesFeesPenalties.agencyId})::int`,
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

    // Group by canonical name via LEFT JOIN
    const byAgency = await this.db
      .select({
        agency: sql<string>`COALESCE(${agencies.canonicalName}, ${finesFeesPenalties.responsibleAgency}, 'Unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id))
      .where(baseCondition)
      .groupBy(sql`COALESCE(${agencies.canonicalName}, ${finesFeesPenalties.responsibleAgency}, 'Unknown')`)
      .orderBy(desc(sql`count(*)`));

    const byLevel = await this.db
      .select({
        level: sql<string>`COALESCE(${agencies.level}, 'unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id))
      .where(baseCondition)
      .groupBy(sql`COALESCE(${agencies.level}, 'unknown')`)
      .orderBy(desc(sql`count(*)`));

    const byWhoPays = await this.db
      .select({
        whoPays: sql<string>`LOWER(TRIM(${finesFeesPenalties.whoPays}))`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .where(and(baseCondition, isNotNull(finesFeesPenalties.whoPays)))
      .groupBy(sql`LOWER(TRIM(${finesFeesPenalties.whoPays}))`)
      .orderBy(desc(sql`count(*)`));

    const byPerUnit = await this.db
      .select({
        perUnit: sql<string>`LOWER(TRIM(${finesFeesPenalties.perUnit}))`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .where(and(baseCondition, isNotNull(finesFeesPenalties.perUnit)))
      .groupBy(sql`LOWER(TRIM(${finesFeesPenalties.perUnit}))`)
      .orderBy(desc(sql`count(*)`));

    const bySourceType = await this.db
      .select({
        sourceType: sql<string>`CASE WHEN ${finesFeesPenalties.guidanceDocumentId} IS NOT NULL THEN 'guidance' WHEN ${finesFeesPenalties.documentId} IS NOT NULL THEN 'regulation' ELSE 'unknown' END`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .where(baseCondition)
      .groupBy(sql`CASE WHEN ${finesFeesPenalties.guidanceDocumentId} IS NOT NULL THEN 'guidance' WHEN ${finesFeesPenalties.documentId} IS NOT NULL THEN 'regulation' ELSE 'unknown' END`)
      .orderBy(desc(sql`count(*)`));

    // Classification breakdown via LEFT JOIN to compliance_issue_analyses
    const classificationSql = sql`CASE
      WHEN ${complianceIssueAnalyses.id} IS NULL THEN 'not_analyzed'
      ELSE COALESCE(
        ${complianceIssueAnalyses.tier3Classification},
        ${complianceIssueAnalyses.tier2Classification},
        ${complianceIssueAnalyses.tier1Classification},
        'not_analyzed'
      )
    END`;
    const byClassification = await this.db
      .select({
        classification: sql<string>`${classificationSql}`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .leftJoin(complianceIssueAnalyses, this.analysisJoinCondition)
      .where(baseCondition)
      .groupBy(classificationSql)
      .orderBy(desc(sql`count(*)`));

    // Severity breakdown via LEFT JOIN to compliance_issue_analyses
    const finalClassSql = sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`;
    const severitySql = sql`CASE
      WHEN ${finalClassSql} = 'all_false_positives' THEN 'false_positive'
      WHEN ${finalClassSql} = 'unrelated' THEN 'unrelated'
      WHEN ${complianceIssueAnalyses.finalSeverity} >= 7 THEN 'high'
      WHEN ${complianceIssueAnalyses.finalSeverity} >= 4 THEN 'medium'
      WHEN ${complianceIssueAnalyses.finalSeverity} >= 1 THEN 'low'
      ELSE 'none'
    END`;
    const bySeverity = await this.db
      .select({
        severity: sql<string>`${severitySql}`,
        count: sql<number>`count(*)::int`,
      })
      .from(finesFeesPenalties)
      .leftJoin(complianceIssueAnalyses, this.analysisJoinCondition)
      .where(baseCondition)
      .groupBy(severitySql)
      .orderBy(desc(sql`count(*)`));

    const regulationCount = bySourceType.find(r => r.sourceType === 'regulation')?.count ?? 0;
    const guidanceCount = bySourceType.find(r => r.sourceType === 'guidance')?.count ?? 0;

    return {
      total: stats.total,
      uniqueAgencies: stats.uniqueAgencies,
      uniqueDocs: stats.uniqueDocs,
      regulationCount,
      guidanceCount,
      byType,
      byAgency,
      byLevel,
      byWhoPays,
      byPerUnit,
      bySourceType,
      byClassification,
      bySeverity,
    };
  }

  async getAgencies(jurisdiction: JurisdictionCode): Promise<{ id: number; name: string; level: string | null }[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const result = await this.db
      .selectDistinct({
        id: agencies.id,
        name: agencies.canonicalName,
        level: agencies.level,
      })
      .from(agencies)
      .innerJoin(finesFeesPenalties, eq(finesFeesPenalties.agencyId, agencies.id))
      .where(and(
        eq(agencies.jurisdiction, stateUpper),
        eq(finesFeesPenalties.llmConfirmed, true),
      ))
      .orderBy(asc(agencies.canonicalName));

    return result;
  }

  async getExportData(jurisdiction: JurisdictionCode, filters?: Omit<FinesFilterOptions, 'jurisdiction'>): Promise<FineWithContext[]> {
    const whereClause = this.buildWhereClause(jurisdiction, filters);

    const results = await this.db
      .select(this.finesExportSelectFields())
      .from(finesFeesPenalties)
      .leftJoin(regulatoryDocuments, eq(finesFeesPenalties.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(finesFeesPenalties.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id))
      .leftJoin(complianceIssueAnalyses, this.analysisJoinCondition)
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
      const agency = row.agencyCanonicalName || row.responsibleAgency || 'Unassigned';
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

  /** The analysis JOIN condition: match on document_id OR guidance_document_id, with issue_type = 'fines_fees_penalties' */
  private get analysisJoinCondition() {
    return and(
      or(
        and(
          isNotNull(finesFeesPenalties.documentId),
          eq(finesFeesPenalties.documentId, complianceIssueAnalyses.documentId)
        ),
        and(
          isNotNull(finesFeesPenalties.guidanceDocumentId),
          eq(finesFeesPenalties.guidanceDocumentId, complianceIssueAnalyses.guidanceDocumentId)
        )
      ),
      eq(complianceIssueAnalyses.issueType, 'fines_fees_penalties')
    );
  }

  private buildWhereClause(jurisdiction: JurisdictionCode, filters?: Omit<FinesFilterOptions, 'jurisdiction'>) {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const conditions: ReturnType<typeof eq>[] = [
      eq(finesFeesPenalties.jurisdiction, stateUpper),
      eq(finesFeesPenalties.llmConfirmed, true),
    ];

    if (filters) {
      // penaltyTypes array takes precedence over singular penaltyType
      if (filters.penaltyTypes?.length) {
        conditions.push(inArray(finesFeesPenalties.penaltyType, filters.penaltyTypes));
      } else if (filters.penaltyType && filters.penaltyType !== 'all') {
        conditions.push(eq(finesFeesPenalties.penaltyType, filters.penaltyType));
      }
      // agencyIds (numeric) takes precedence over agencies (string) and agency (string)
      if (filters.agencyIds?.length) {
        conditions.push(inArray(finesFeesPenalties.agencyId, filters.agencyIds));
      } else if (filters.agencies?.length) {
        conditions.push(inArray(finesFeesPenalties.responsibleAgency, filters.agencies));
      } else if (filters.agency) {
        conditions.push(eq(finesFeesPenalties.responsibleAgency, filters.agency));
      }
      if (filters.agencyLevels?.length) {
        conditions.push(inArray(agencies.level, filters.agencyLevels));
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
      // whoPaysValues array takes precedence over singular whoPays
      if (filters.whoPaysValues?.length) {
        conditions.push(inArray(finesFeesPenalties.whoPays, filters.whoPaysValues));
      } else if (filters.whoPays) {
        conditions.push(eq(finesFeesPenalties.whoPays, filters.whoPays));
      }
      // perUnitValues array takes precedence over singular perUnit
      if (filters.perUnitValues?.length) {
        conditions.push(inArray(finesFeesPenalties.perUnit, filters.perUnitValues));
      } else if (filters.perUnit) {
        conditions.push(eq(finesFeesPenalties.perUnit, filters.perUnit));
      }
      // Estimated impact filter
      if (filters.estimatedImpactValues?.length) {
        conditions.push(inArray(finesFeesPenalties.estimatedAnnualPayers, filters.estimatedImpactValues));
      }
      // Classification filter — uses COALESCE(tier3 > tier2 > tier1) for final classification
      if (filters.classification === 'not_analyzed') {
        conditions.push(isNull(complianceIssueAnalyses.id));
      } else if (filters.classification === 'burdensome' || filters.classification === 'justified') {
        conditions.push(
          eq(
            sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`,
            filters.classification
          )
        );
      }
      // Severity filter (high=7+, medium=4-6, low=1-3, false_positive/unrelated=classification-based)
      if (filters.severities && filters.severities.length > 0) {
        const classificationSql = sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`;
        const severityConditions = filters.severities.map(s => {
          if (s === 'false_positive') return eq(classificationSql, 'all_false_positives');
          if (s === 'unrelated') return eq(classificationSql, 'unrelated');
          if (s === 'high') return gte(complianceIssueAnalyses.finalSeverity, 7);
          if (s === 'medium') return and(gte(complianceIssueAnalyses.finalSeverity, 4), lt(complianceIssueAnalyses.finalSeverity, 7))!;
          // low
          return and(gte(complianceIssueAnalyses.finalSeverity, 1), lt(complianceIssueAnalyses.finalSeverity, 4))!;
        });
        conditions.push(or(...severityConditions)!);
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
      agencyId: finesFeesPenalties.agencyId,
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
      jurisdictionLevel: finesFeesPenalties.jurisdictionLevel,
      jurisdictionLevelOther: finesFeesPenalties.jurisdictionLevelOther,
      issuingEntityConfidence: finesFeesPenalties.issuingEntityConfidence,
      activityCategory: finesFeesPenalties.activityCategory,
      estimatedAnnualPayers: finesFeesPenalties.estimatedAnnualPayers,
      justification: finesFeesPenalties.justification,
      justificationQuote: finesFeesPenalties.justificationQuote,
      whoPaysNormalized: finesFeesPenalties.whoPaysNormalized,
      createdAt: finesFeesPenalties.createdAt,
      // Agency fields
      agencyCanonicalName: agencies.canonicalName,
      agencyLevel: agencies.level,
      // Regulation fields
      regId: regulatoryDocuments.id,
      regTitle: regulatoryDocuments.title,
      regHierarchyPath: regulatoryDocuments.hierarchyPath,
      regUrl: regulatoryDocuments.url,
      // Guidance fields
      guidId: guidanceDocuments.id,
      guidTitle: guidanceDocuments.title,
      guidUrl: guidanceDocuments.url,
      // Analysis fields (from compliance_issue_analyses LEFT JOIN)
      analysisHighestTierCompleted: complianceIssueAnalyses.highestTierCompleted,
      analysisTier1Classification: complianceIssueAnalyses.tier1Classification,
      analysisTier2Classification: complianceIssueAnalyses.tier2Classification,
      analysisTier3Classification: complianceIssueAnalyses.tier3Classification,
      analysisSeverity: complianceIssueAnalyses.severity,
      analysisFinalSeverity: complianceIssueAnalyses.finalSeverity,
      analysisTier3SeverityAdjustment: complianceIssueAnalyses.tier3SeverityAdjustment,
      analysisArgumentFor: complianceIssueAnalyses.argumentForRegulation,
      analysisArgumentAgainst: complianceIssueAnalyses.argumentAgainstRegulation,
      analysisWebSearchSummary: complianceIssueAnalyses.webSearchSummary,
      analysisRequirementFound: complianceIssueAnalyses.requirementFound,
      analysisIsJustified: complianceIssueAnalyses.isJustified,
      analysisFederalMandateFound: complianceIssueAnalyses.federalMandateFound,
      analysisStateHasDiscretion: complianceIssueAnalyses.stateHasDiscretion,
      analysisEasyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
      analysisCleanupType: complianceIssueAnalyses.cleanupType,
      analysisCleanupEffort: complianceIssueAnalyses.cleanupEffort,
      analysisTier1Reasoning: complianceIssueAnalyses.tier1Reasoning,
      analysisTier2Reasoning: complianceIssueAnalyses.tier2Reasoning,
      analysisTier3Reasoning: complianceIssueAnalyses.tier3Reasoning,
      analysisTier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
      analysisTier3Flags: complianceIssueAnalyses.tier3Flags,
      analysisPipelineVersion: complianceIssueAnalyses.pipelineVersion,
    };
  }

  /** Lean select for CSV export — nulls out heavy text fields not used by buildFinesCsv to stay under Neon's 64MB response limit */
  private finesExportSelectFields() {
    return {
      ...this.finesSelectFields(),
      context: sql<string>`''`,
      analysisTier1Reasoning: sql<string | null>`null`,
      analysisTier2Reasoning: sql<string | null>`null`,
      analysisTier3Reasoning: sql<string | null>`null`,
      analysisTier3TriggerReason: sql<string | null>`null`,
      analysisTier3Flags: sql<unknown>`null`,
      analysisPipelineVersion: sql<string | null>`null`,
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
    agencyId: number | null;
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
    jurisdictionLevel: string | null;
    jurisdictionLevelOther: string | null;
    issuingEntityConfidence: string | null;
    activityCategory: string | null;
    estimatedAnnualPayers: string | null;
    justification: string | null;
    justificationQuote: string | null;
    whoPaysNormalized: string | null;
    createdAt: Date | null;
    agencyCanonicalName: string | null;
    agencyLevel: string | null;
    regId: number | null;
    regTitle: string | null;
    regHierarchyPath: string | null;
    regUrl: string | null;
    guidId: number | null;
    guidTitle: string | null;
    guidUrl: string | null;
  } & AnalysisRowFields): FineWithContext {
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
      agencyId: row.agencyId,
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
      jurisdictionLevel: row.jurisdictionLevel,
      jurisdictionLevelOther: row.jurisdictionLevelOther,
      issuingEntityConfidence: row.issuingEntityConfidence,
      activityCategory: row.activityCategory,
      estimatedAnnualPayers: row.estimatedAnnualPayers,
      justification: row.justification,
      justificationQuote: row.justificationQuote,
      whoPaysNormalized: row.whoPaysNormalized,
      createdAt: row.createdAt,
      agencyCanonicalName: row.agencyCanonicalName,
      agencyLevel: row.agencyLevel,
      analysis: mapAnalysisFields(row),
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
