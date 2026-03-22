'use server';

import 'server-only';
import {
  db,
  FinesRepository,
  BookmarksRepository,
  type JurisdictionCode,
  type FineWithContext,
  type FineAnalysis,
  type PaginatedFinesResult,
  type FinesOverviewStats,
} from '@deproceduralizer/database';
import { type ActionResult, runAction, runCachedAction } from './types';
import { parseCommaSeparated } from '@/lib/url/filter-helpers';

const finesRepo = new FinesRepository(db);
const bookmarksRepo = new BookmarksRepository(db);

export type AgencyOption = { id: number; name: string; level: string | null };

/** Parse comma-separated multi-select filter strings into arrays for the repository */
function parseFinesMultiSelectFilters(filters?: { penaltyType?: string; agency?: string; agencyLevel?: string; whoPays?: string; perUnit?: string; estimatedImpact?: string }) {
  const agencyRaw = parseCommaSeparated(filters?.agency);
  // If values are numeric, treat as agency IDs; otherwise fall back to string matching
  const agencyIds = agencyRaw.map(Number).filter(n => !isNaN(n));
  const isNumeric = agencyRaw.length > 0 && agencyIds.length === agencyRaw.length;

  return {
    penaltyTypes: parseCommaSeparated(filters?.penaltyType).filter(t => t !== 'all'),
    agencies: isNumeric ? [] : agencyRaw,
    agencyIds: isNumeric ? agencyIds : [],
    agencyLevels: parseCommaSeparated(filters?.agencyLevel),
    whoPaysValues: parseCommaSeparated(filters?.whoPays),
    perUnitValues: parseCommaSeparated(filters?.perUnit),
    estimatedImpactValues: parseCommaSeparated(filters?.estimatedImpact),
  };
}

/** Narrow a classification string to a valid filter value, or undefined if invalid */
function parseClassificationFilter(
  value: string | undefined
): 'burdensome' | 'justified' | 'not_analyzed' | undefined {
  if (value === 'burdensome' || value === 'justified' || value === 'not_analyzed') {
    return value;
  }
  return undefined;
}

const VALID_SEVERITIES = new Set(['high', 'medium', 'low', 'false_positive', 'unrelated'] as const);
type SeverityValue = 'high' | 'medium' | 'low' | 'false_positive' | 'unrelated';

/** Parse comma-separated severity string into typed array, or undefined if empty/invalid */
function parseSeveritiesFilter(value: string | undefined): SeverityValue[] | undefined {
  if (!value) return undefined;
  const values = value.split(',').filter((v): v is SeverityValue => VALID_SEVERITIES.has(v as SeverityValue));
  return values.length > 0 ? values : undefined;
}

// Re-export types for components
export type { FineWithContext, FineAnalysis, FinesOverviewStats };

export async function getFineById(
  id: number
): Promise<ActionResult<FineWithContext | null>> {
  return runAction('getFineById', async () => {
    const fine = await finesRepo.getById(id);
    return fine ?? null;
  });
}

export async function getFinesOverviewStats(
  state: JurisdictionCode
): Promise<ActionResult<FinesOverviewStats>> {
  return runCachedAction(
    'getFinesOverviewStats',
    () => finesRepo.getOverviewStats(state),
    [`fines-overview-stats-v3-${state}`],
    { revalidate: 120, tags: ['fines'] }
  );
}

export async function getFinesPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'penaltyType' | 'amount' | 'responsibleAgency' | 'createdAt' | 'severity';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      penaltyType?: string;
      agency?: string;
      agencyLevel?: string;
      search?: string;
      sourceType?: 'regulation' | 'guidance';
      amountMin?: number;
      amountMax?: number;
      whoPays?: string;
      perUnit?: string;
      classification?: string;
      markerGroupIds?: number[];
      bookmarkedOnly?: boolean;
      severity?: string;
      estimatedImpact?: string;
    };
  }
): Promise<ActionResult<PaginatedFinesResult>> {
  const { page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
  const multiSelect = parseFinesMultiSelectFilters(filters);
  const severities = parseSeveritiesFilter(filters?.severity);

  // Stabilize cache keys: sort multi-select values so "fine,fee" and "fee,fine" hit the same cache
  const type = [...multiSelect.penaltyTypes].sort().join(',');
  const agency = [...multiSelect.agencyIds].sort().join(',') || [...multiSelect.agencies].sort().join(',');
  const search = filters?.search ?? '';
  const sourceType = filters?.sourceType ?? '';
  const amountMin = filters?.amountMin ?? '';
  const amountMax = filters?.amountMax ?? '';
  const agencyLevel = [...multiSelect.agencyLevels].sort().join(',');
  const whoPays = [...multiSelect.whoPaysValues].sort().join(',');
  const perUnit = [...multiSelect.perUnitValues].sort().join(',');
  const classification = filters?.classification ?? '';
  const markerIds = filters?.markerGroupIds?.sort().join(',') ?? '';
  const bookmarkedOnly = filters?.bookmarkedOnly ? '1' : '';
  const severity = severities ? [...severities].sort().join(',') : '';
  const estimatedImpact = [...multiSelect.estimatedImpactValues].sort().join(',');
  const cacheKey = `fines-paginated-${state}-${page}-${pageSize}-${sortBy}-${sortOrder}-${type}-${agency}-${agencyLevel}-${search}-${sourceType}-${amountMin}-${amountMax}-${whoPays}-${perUnit}-${classification}-${markerIds}-${bookmarkedOnly}-${severity}-${estimatedImpact}`;

  return runCachedAction(
    'getFinesPaginated',
    () => finesRepo.getAllPaginated({
      jurisdiction: state,
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: filters ? {
        ...filters,
        ...multiSelect,
        classification: parseClassificationFilter(filters.classification),
        severities,
      } : undefined,
    }),
    [cacheKey],
    { revalidate: 120, tags: ['fines'] }
  );
}

export async function getFinesAgencies(
  state: JurisdictionCode
): Promise<ActionResult<AgencyOption[]>> {
  return runCachedAction(
    'getFinesAgencies',
    () => finesRepo.getAgencies(state),
    [`fines-agencies-${state}`],
    { revalidate: 300, tags: ['fines'] }
  );
}

export async function getFinesWhoPays(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getFinesWhoPays',
    () => finesRepo.getWhoPaysValues(state),
    [`fines-who-pays-${state}`],
    { revalidate: 300, tags: ['fines'] }
  );
}

export async function getFinesPerUnits(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getFinesPerUnits',
    () => finesRepo.getPerUnitValues(state),
    [`fines-per-units-${state}`],
    { revalidate: 300, tags: ['fines'] }
  );
}

export async function exportFinesCsv(
  state: JurisdictionCode,
  filters?: {
    penaltyType?: string;
    agency?: string;
    agencyLevel?: string;
    search?: string;
    sourceType?: 'regulation' | 'guidance';
    amountMin?: number;
    amountMax?: number;
    whoPays?: string;
    perUnit?: string;
    classification?: string;
    severity?: string;
    estimatedImpact?: string;
  }
): Promise<ActionResult<string>> {
  const multiSelect = parseFinesMultiSelectFilters(filters);
  const classificationFilter = parseClassificationFilter(filters?.classification);
  const severities = parseSeveritiesFilter(filters?.severity);

  return runAction('exportFinesCsv', async () => {
    const [data, bookmarkData, markersMap] = await Promise.all([
      finesRepo.getExportData(state, { ...filters, ...multiSelect, classification: classificationFilter, severities }),
      bookmarksRepo.getFineBookmarksWithNotes(state),
      bookmarksRepo.getFineBookmarkMarkersMap(state),
    ]);
    const bookmarkMap = new Map(bookmarkData.map(b => [b.fineId, b]));
    return buildFinesCsv(data, bookmarkMap, markersMap);
  });
}

export async function exportFinesZipByAgency(
  state: JurisdictionCode,
  filters?: {
    penaltyType?: string;
    agency?: string;
    agencyLevel?: string;
    search?: string;
    sourceType?: 'regulation' | 'guidance';
    amountMin?: number;
    amountMax?: number;
    whoPays?: string;
    perUnit?: string;
    classification?: string;
    severity?: string;
  }
): Promise<ActionResult<string>> {
  const multiSelect = parseFinesMultiSelectFilters(filters);
  const classificationFilter = parseClassificationFilter(filters?.classification);
  const severities = parseSeveritiesFilter(filters?.severity);

  return runAction('exportFinesZipByAgency', async () => {
    const { default: JSZip } = await import('jszip');
    const [grouped, bookmarkData, markersMap] = await Promise.all([
      finesRepo.getExportDataGroupedByAgency(state, { ...filters, ...multiSelect, classification: classificationFilter, severities }),
      bookmarksRepo.getFineBookmarksWithNotes(state),
      bookmarksRepo.getFineBookmarkMarkersMap(state),
    ]);
    const bookmarkMap = new Map(bookmarkData.map(b => [b.fineId, b]));
    const zip = new JSZip();

    for (const [agency, rows] of grouped) {
      const safeName = agency.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-');
      zip.file(`${safeName}.csv`, buildFinesCsv(rows, bookmarkMap, markersMap));
    }

    const buffer = await zip.generateAsync({ type: 'base64' });
    return buffer;
  });
}

// ---------------------------------------------------------------------------
// Shared CSV builder
// ---------------------------------------------------------------------------

type BookmarkInfo = { fineId: number; id: number; notes: string | null; createdBy: string | null };
type MarkersMapEntry = { bookmarkId: number; markers: { id: number; name: string; color: string }[]; notes: string | null; createdBy: string | null };

function buildFinesCsv(
  data: FineWithContext[],
  bookmarks?: Map<number, BookmarkInfo>,
  markersMap?: Map<string, MarkersMapEntry>,
): string {
  const headers = [
    'ID', 'Penalty Type', 'Amount', 'Amount Min', 'Amount Max', 'Per Unit',
    'Who Pays', 'Agency (Canonical)', 'Agency Level', 'Agency (AI-Extracted)',
    'Violation Description', 'Requirement Quote', 'Source Type',
    'Source Title', 'Source URL', 'Jurisdiction',
    'Activity Category', 'Est. Annual Payers', 'Justification', 'Who Pays (Normalized)',
    'bookmark_saved', 'bookmark_notes', 'bookmark_by', 'marker_categories',
    'Classification', 'Severity', 'Tier Completed',
    'Argument For Regulation', 'Argument Against Regulation', 'Web Search Summary',
    'Federal Mandate Found', 'Easy Cleanup Candidate', 'Cleanup Effort',
  ];

  const escape = (v: string | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };

  const boolLabel = (v: boolean | null | undefined) => v === true ? 'yes' : v === false ? 'no' : '';

  const rows = data.map(row => {
    const bm = bookmarks?.get(row.id);
    const markerEntry = markersMap?.get(String(row.id));
    const markerNames = markerEntry?.markers.map(m => m.name).join(', ') ?? '';
    const a = row.analysis;
    const classification = a?.tier3Classification ?? a?.tier2Classification ?? a?.tier1Classification ?? '';
    return [
      row.id,
      escape(row.penaltyType),
      escape(row.amount),
      row.amountMin ?? '',
      row.amountMax ?? '',
      escape(row.perUnit),
      escape(row.whoPays),
      escape(row.agencyCanonicalName || row.responsibleAgency),
      escape(row.agencyLevel),
      escape(row.responsibleAgency),
      escape(row.violationDescription),
      escape(row.requirementQuote),
      row.sourceDocument.type,
      escape(row.sourceDocument.title),
      escape(row.sourceDocument.url),
      row.jurisdiction,
      escape(row.activityCategory),
      escape(row.estimatedAnnualPayers),
      escape(row.justification),
      escape(row.whoPaysNormalized),
      bm ? 'yes' : '',
      escape(bm?.notes),
      escape(bm?.createdBy),
      escape(markerNames),
      escape(classification),
      a?.finalSeverity ?? '',
      a?.highestTierCompleted ?? '',
      escape(a?.argumentForRegulation),
      escape(a?.argumentAgainstRegulation),
      escape(a?.webSearchSummary),
      boolLabel(a?.federalMandateFound),
      boolLabel(a?.easyCleanupCandidate),
      escape(a?.cleanupEffort),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
