'use server';

import 'server-only';
import {
  db,
  IbrRepository,
  type JurisdictionCode,
  type IbrWithContext,
  type PaginatedIbrsResult,
  type IbrOverviewStats,
  type IbrTopStandard,
} from '@deproceduralizer/database';
import { type ActionResult, runAction, runCachedAction } from './types';

const ibrRepo = new IbrRepository(db);

// Re-export types for components
export type { IbrWithContext, IbrOverviewStats, IbrTopStandard };

export async function getIbrOverviewStats(
  state: JurisdictionCode
): Promise<ActionResult<IbrOverviewStats>> {
  return runCachedAction(
    'getIbrOverviewStats',
    () => ibrRepo.getOverviewStats(state),
    [`ibr-overview-stats-${state}`],
    { revalidate: 120, tags: ['ibr'] }
  );
}

export async function getIbrsPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'sourceOrganization' | 'incorporatedDocument' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    filters?: {
      sourceOrganization?: string;
      search?: string;
    };
  }
): Promise<ActionResult<PaginatedIbrsResult>> {
  const { page, pageSize, sortBy = 'sourceOrganization', sortOrder = 'desc', filters } = options;
  const org = filters?.sourceOrganization ?? '';
  const search = filters?.search ?? '';
  const cacheKey = `ibr-paginated-${state}-${page}-${pageSize}-${sortBy}-${sortOrder}-${org}-${search}`;

  return runCachedAction(
    'getIbrsPaginated',
    () => ibrRepo.getAllPaginated({
      jurisdiction: state,
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: filters ? {
        sourceOrganization: filters.sourceOrganization,
        search: filters.search,
      } : undefined,
    }),
    [cacheKey],
    { revalidate: 120, tags: ['ibr'] }
  );
}

export async function getIbrSourceOrganizations(
  state: JurisdictionCode
): Promise<ActionResult<string[]>> {
  return runCachedAction(
    'getIbrSourceOrganizations',
    () => ibrRepo.getSourceOrganizations(state),
    [`ibr-source-orgs-${state}`],
    { revalidate: 300, tags: ['ibr'] }
  );
}

export async function getIbrTopStandards(
  state: JurisdictionCode,
  limit: number = 20
): Promise<ActionResult<IbrTopStandard[]>> {
  return runCachedAction(
    'getIbrTopStandards',
    () => ibrRepo.getTopStandards(state, limit),
    [`ibr-top-standards-${state}-${limit}`],
    { revalidate: 120, tags: ['ibr'] }
  );
}

export async function getIbrById(
  id: number
): Promise<ActionResult<IbrWithContext | null>> {
  return runAction('getIbrById', async () => {
    const result = await ibrRepo.getById(id);
    return result ?? null;
  });
}
