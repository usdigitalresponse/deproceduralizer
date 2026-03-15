'use server';

import 'server-only';
import {
  db,
  GuidanceDocumentsRepository,
  ComplianceIssuesRepository,
  type JurisdictionCode,
  type GuidanceDocumentListItem,
  type GuidanceDocumentDetail,
  type GuidanceOverviewStats,
  type PaginatedGuidanceResult,
  type SupersedureLink,
  type GuidanceCitationStats,
  type ResolvedRegulationCitation,
  type DocumentLineage,
  type LineageNode,
  type LineageStats,
  type DocumentFamily,
  type LineageFamilyMember,
  type GuidanceReadabilityStats,
  type ReadabilityByAgencyRow,
  type ReadabilityCrossCutStats,
} from '@deproceduralizer/database';
import { type ActionResult, runAction, runCachedAction } from './types';

const guidanceRepo = new GuidanceDocumentsRepository(db);
const complianceIssuesRepo = new ComplianceIssuesRepository(db);

// Re-export types for components
export type {
  GuidanceDocumentListItem,
  GuidanceDocumentDetail,
  GuidanceOverviewStats,
  PaginatedGuidanceResult,
  SupersedureLink,
  GuidanceCitationStats,
  ResolvedRegulationCitation,
  DocumentLineage,
  LineageNode,
  LineageStats,
  DocumentFamily,
  LineageFamilyMember,
  GuidanceReadabilityStats,
  ReadabilityByAgencyRow,
  ReadabilityCrossCutStats,
};

export async function getGuidanceOverviewStats(
  state: JurisdictionCode
): Promise<ActionResult<GuidanceOverviewStats>> {
  return runCachedAction(
    'getGuidanceOverviewStats',
    () => guidanceRepo.getOverviewStats(state),
    [`guidance-overview-stats-${state}`],
    { revalidate: 120, tags: ['guidance'] }
  );
}

export async function getGuidancePaginated(
  state: JurisdictionCode,
  options: {
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
): Promise<ActionResult<PaginatedGuidanceResult>> {
  const { page, pageSize, sortBy = 'title', sortOrder = 'asc', filters } = options;
  const agency = filters?.agency ?? '';
  const docType = filters?.docType ?? '';
  const policyCategory = filters?.policyCategory ?? '';
  const status = filters?.status ?? '';
  const yearFrom = filters?.yearFrom ?? '';
  const yearTo = filters?.yearTo ?? '';
  const search = filters?.search ?? '';
  const cacheKey = `guidance-paginated-${state}-${page}-${pageSize}-${sortBy}-${sortOrder}-${agency}-${docType}-${policyCategory}-${status}-${yearFrom}-${yearTo}-${search}`;

  return runCachedAction(
    'getGuidancePaginated',
    () => guidanceRepo.getAllPaginated({
      jurisdiction: state,
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: filters || undefined,
    }),
    [cacheKey],
    { revalidate: 120, tags: ['guidance'] }
  );
}

export async function getGuidanceById(
  id: number
): Promise<ActionResult<GuidanceDocumentDetail | null>> {
  return runAction('getGuidanceById', async () => {
    const result = await guidanceRepo.getById(id);
    return result ?? null;
  });
}

export async function getGuidanceAgencies(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getGuidanceAgencies',
    () => guidanceRepo.getAgencies(state),
    [`guidance-agencies-${state}`],
    { revalidate: 300, tags: ['guidance'] }
  );
}

export async function getGuidanceDocTypes(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getGuidanceDocTypes',
    () => guidanceRepo.getDocTypes(state),
    [`guidance-doc-types-${state}`],
    { revalidate: 300, tags: ['guidance'] }
  );
}

/** @deprecated Use getDocumentLineage instead — provides full transitive chain resolution */
export async function getGuidanceSupersedureChain(
  docId: number
): Promise<ActionResult<SupersedureLink[]>> {
  return runAction('getGuidanceSupersedureChain', () =>
    guidanceRepo.getSupersedureChain(docId)
  );
}

export async function getGuidanceCitationStats(
  state: JurisdictionCode
): Promise<ActionResult<GuidanceCitationStats>> {
  return runCachedAction(
    'getGuidanceCitationStats',
    () => guidanceRepo.getCitationCoverageStats(state),
    [`guidance-citation-stats-${state}`],
    { revalidate: 120, tags: ['guidance'] }
  );
}

export async function getGuidanceResolvedCitations(
  guidanceDocId: number
): Promise<ActionResult<ResolvedRegulationCitation[]>> {
  return runAction('getGuidanceResolvedCitations', () =>
    guidanceRepo.getResolvedCitedRegulations(guidanceDocId)
  );
}


export async function getDocumentLineage(
  docId: number
): Promise<ActionResult<DocumentLineage>> {
  return runAction('getDocumentLineage', () => guidanceRepo.getFullLineage(docId));
}

export async function getGuidanceLineageStats(
  state: JurisdictionCode
): Promise<ActionResult<LineageStats>> {
  return runCachedAction(
    'getGuidanceLineageStats',
    () => guidanceRepo.getLineageStats(state),
    [`guidance-lineage-stats-${state}`],
    { revalidate: 120, tags: ['guidance'] }
  );
}

export async function getGuidanceReadabilityStats(
  state: JurisdictionCode
): Promise<ActionResult<GuidanceReadabilityStats>> {
  return runCachedAction(
    'getGuidanceReadabilityStats',
    () => guidanceRepo.getReadabilityStats(state),
    [`guidance-readability-stats-${state}`],
    { revalidate: 120, tags: ['guidance'] }
  );
}

export async function getReadabilityByAgencyFiltered(
  state: JurisdictionCode,
  audienceTags: string[]
): Promise<ActionResult<ReadabilityByAgencyRow[]>> {
  return runAction('getReadabilityByAgencyFiltered', () =>
    guidanceRepo.getReadabilityByAgencyFiltered(state, audienceTags)
  );
}

export async function getGuidanceReadabilityCrossCuts(
  state: JurisdictionCode
): Promise<ActionResult<ReadabilityCrossCutStats>> {
  return runCachedAction(
    'getGuidanceReadabilityCrossCuts',
    () => guidanceRepo.getReadabilityCrossCutStats(state),
    [`guidance-readability-crosscuts-${state}`],
    { revalidate: 120, tags: ['guidance'] }
  );
}

export interface GuidanceComplianceAnalysisSummary {
  totalIssues: number;
  analyzedCount: number;
  burdensomeCount: number;
  justifiedCount: number;
  topIssueTypes: Array<{ issueType: string; count: number }>;
}

export async function getGuidanceComplianceAnalysisSummary(
  guidanceDocumentId: number
): Promise<ActionResult<GuidanceComplianceAnalysisSummary>> {
  return runAction('getGuidanceComplianceAnalysisSummary', () =>
    complianceIssuesRepo.getGuidanceComplianceAnalysisSummary(guidanceDocumentId)
  );
}
