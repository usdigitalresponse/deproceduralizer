'use server';

import 'server-only';
import {
  db,
  FinesRepository,
  type JurisdictionCode,
  type FineWithContext,
  type PaginatedFinesResult,
  type FinesOverviewStats,
} from '@deproceduralizer/database';
import { type ActionResult, runAction, runCachedAction } from './types';

const finesRepo = new FinesRepository(db);

// Re-export types for components
export type { FineWithContext, FinesOverviewStats };

export async function getFinesOverviewStats(
  state: JurisdictionCode
): Promise<ActionResult<FinesOverviewStats>> {
  return runCachedAction(
    'getFinesOverviewStats',
    () => finesRepo.getOverviewStats(state),
    [`fines-overview-stats-${state}`],
    { revalidate: 120, tags: ['fines'] }
  );
}

export async function getFinesPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'penaltyType' | 'amount' | 'responsibleAgency' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      penaltyType?: string;
      agency?: string;
      search?: string;
      sourceType?: 'regulation' | 'guidance';
      amountMin?: number;
      amountMax?: number;
      whoPays?: string;
      perUnit?: string;
    };
  }
): Promise<ActionResult<PaginatedFinesResult>> {
  const { page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
  const type = filters?.penaltyType ?? '';
  const agency = filters?.agency ?? '';
  const search = filters?.search ?? '';
  const sourceType = filters?.sourceType ?? '';
  const amountMin = filters?.amountMin ?? '';
  const amountMax = filters?.amountMax ?? '';
  const whoPays = filters?.whoPays ?? '';
  const perUnit = filters?.perUnit ?? '';
  const cacheKey = `fines-paginated-${state}-${page}-${pageSize}-${sortBy}-${sortOrder}-${type}-${agency}-${search}-${sourceType}-${amountMin}-${amountMax}-${whoPays}-${perUnit}`;

  return runCachedAction(
    'getFinesPaginated',
    () => finesRepo.getAllPaginated({
      jurisdiction: state,
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: filters ? {
        penaltyType: filters.penaltyType,
        agency: filters.agency,
        search: filters.search,
        sourceType: filters.sourceType,
        amountMin: filters.amountMin,
        amountMax: filters.amountMax,
        whoPays: filters.whoPays,
        perUnit: filters.perUnit,
      } : undefined,
    }),
    [cacheKey],
    { revalidate: 120, tags: ['fines'] }
  );
}

export async function getFinesAgencies(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
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
    search?: string;
    sourceType?: 'regulation' | 'guidance';
    amountMin?: number;
    amountMax?: number;
    whoPays?: string;
    perUnit?: string;
  }
): Promise<ActionResult<string>> {
  return runAction('exportFinesCsv', async () => {
    const data = await finesRepo.getExportData(state, filters);
    return buildFinesCsv(data);
  });
}

export async function exportFinesZipByAgency(
  state: JurisdictionCode,
  filters?: {
    penaltyType?: string;
    agency?: string;
    search?: string;
    sourceType?: 'regulation' | 'guidance';
    amountMin?: number;
    amountMax?: number;
    whoPays?: string;
    perUnit?: string;
  }
): Promise<ActionResult<string>> {
  return runAction('exportFinesZipByAgency', async () => {
    const { default: JSZip } = await import('jszip');
    const grouped = await finesRepo.getExportDataGroupedByAgency(state, filters);
    const zip = new JSZip();

    for (const [agency, rows] of grouped) {
      const safeName = agency.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-');
      zip.file(`${safeName}.csv`, buildFinesCsv(rows));
    }

    const buffer = await zip.generateAsync({ type: 'base64' });
    return buffer;
  });
}

// ---------------------------------------------------------------------------
// Shared CSV builder
// ---------------------------------------------------------------------------

function buildFinesCsv(data: FineWithContext[]): string {
  const headers = [
    'ID', 'Penalty Type', 'Amount', 'Amount Min', 'Amount Max', 'Per Unit',
    'Who Pays', 'Responsible Agency', 'Violation Description',
    'Requirement Quote', 'Source Type', 'Source Title', 'Source URL',
    'Jurisdiction',
  ];

  const escape = (v: string | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };

  const rows = data.map(row => [
    row.id,
    escape(row.penaltyType),
    escape(row.amount),
    row.amountMin ?? '',
    row.amountMax ?? '',
    escape(row.perUnit),
    escape(row.whoPays),
    escape(row.responsibleAgency),
    escape(row.violationDescription),
    escape(row.requirementQuote),
    row.sourceDocument.type,
    escape(row.sourceDocument.title),
    escape(row.sourceDocument.url),
    row.jurisdiction,
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}
