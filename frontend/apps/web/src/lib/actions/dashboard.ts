'use server';

import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';
import type { StateCode, DashboardStats, RecentActivity } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Get dashboard statistics for a specific state or all states combined.
 * Cached for 1 minute to reduce database traffic.
 */
export async function getDashboardStats(
  state?: StateCode
): Promise<ActionResult<DashboardStats>> {
  try {
    const cachedGetStats = unstable_cache(
      () => regulationsRepo.getDashboardStats(state),
      [`dashboard-stats-${state ?? 'all'}`],
      { revalidate: 60, tags: ['dashboard'] } // 1 minute
    );
    const result = await cachedGetStats();
    return success(result);
  } catch (error) {
    console.error('[getDashboardStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get dashboard statistics for each state separately.
 * Cached for 1 minute to reduce database traffic.
 */
export async function getAllStateStats(): Promise<ActionResult<Record<StateCode, DashboardStats>>> {
  try {
    const cachedGetAllStats = unstable_cache(
      () => regulationsRepo.getAllStateStats(),
      ['dashboard-all-state-stats'],
      { revalidate: 60, tags: ['dashboard'] } // 1 minute
    );
    const result = await cachedGetAllStats();
    return success(result);
  } catch (error) {
    console.error('[getAllStateStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get recent activity counts (last 7 days).
 * Cached for 1 minute to reduce database traffic.
 */
export async function getRecentActivity(
  state?: StateCode
): Promise<ActionResult<RecentActivity>> {
  try {
    const cachedGetActivity = unstable_cache(
      () => regulationsRepo.getRecentActivity(state),
      [`dashboard-recent-activity-${state ?? 'all'}`],
      { revalidate: 60, tags: ['dashboard'] }
    );
    const result = await cachedGetActivity();
    return success(result);
  } catch (error) {
    console.error('[getRecentActivity]', error);
    return failure(getErrorMessage(error));
  }
}
