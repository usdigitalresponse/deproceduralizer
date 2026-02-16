'use server';

import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  db,
  IbrRepository,
  type StateCode,
  type IbrWithContext,
  type PaginatedIbrsResult,
  type IbrOverviewStats,
  type IbrTopStandard,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const ibrRepo = new IbrRepository(db);

// Re-export types for components
export type { IbrWithContext, IbrOverviewStats, IbrTopStandard };

export async function getIbrOverviewStats(
  state: StateCode
): Promise<ActionResult<IbrOverviewStats>> {
  try {
    const cachedGetStats = unstable_cache(
      () => ibrRepo.getOverviewStats(state),
      [`ibr-overview-stats-${state}`],
      { revalidate: 120, tags: ['ibr'] }
    );
    const result = await cachedGetStats();
    return success(result);
  } catch (error) {
    console.error('[getIbrOverviewStats]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getIbrsPaginated(
  state: StateCode,
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
  try {
    const { page, pageSize, sortBy = 'sourceOrganization', sortOrder = 'desc', filters } = options;
    const org = filters?.sourceOrganization ?? '';
    const search = filters?.search ?? '';
    const cacheKey = `ibr-paginated-${state}-${page}-${pageSize}-${sortBy}-${sortOrder}-${org}-${search}`;

    const cachedGet = unstable_cache(
      () => ibrRepo.getAllPaginated({
        state,
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
    const result = await cachedGet();
    return success(result);
  } catch (error) {
    console.error('[getIbrsPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getIbrSourceOrganizations(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const cachedGetOrgs = unstable_cache(
      () => ibrRepo.getSourceOrganizations(state),
      [`ibr-source-orgs-${state}`],
      { revalidate: 300, tags: ['ibr'] }
    );
    const result = await cachedGetOrgs();
    return success(result);
  } catch (error) {
    console.error('[getIbrSourceOrganizations]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getIbrTopStandards(
  state: StateCode,
  limit: number = 20
): Promise<ActionResult<IbrTopStandard[]>> {
  try {
    const cachedGetTopStandards = unstable_cache(
      () => ibrRepo.getTopStandards(state, limit),
      [`ibr-top-standards-${state}-${limit}`],
      { revalidate: 120, tags: ['ibr'] }
    );
    const result = await cachedGetTopStandards();
    return success(result);
  } catch (error) {
    console.error('[getIbrTopStandards]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getIbrById(
  id: number
): Promise<ActionResult<IbrWithContext | null>> {
  try {
    const result = await ibrRepo.getById(id);
    return success(result ?? null);
  } catch (error) {
    console.error('[getIbrById]', error);
    return failure(getErrorMessage(error));
  }
}
