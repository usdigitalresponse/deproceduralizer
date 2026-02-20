'use server';

import 'server-only';
import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';
import type { StateCode, DashboardStats, RecentActivity } from '@deproceduralizer/database';
import { type ActionResult, runCachedAction } from './types';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Get dashboard statistics for a specific state or all states combined.
 * Cached for 1 minute to reduce database traffic.
 */
export async function getDashboardStats(
  state?: StateCode
): Promise<ActionResult<DashboardStats>> {
  return runCachedAction(
    'getDashboardStats',
    () => regulationsRepo.getDashboardStats(state),
    [`dashboard-stats-${state ?? 'all'}`],
    { revalidate: 60, tags: ['dashboard'] }
  );
}

/**
 * Get dashboard statistics for each state separately.
 * Cached for 1 minute to reduce database traffic.
 */
export async function getAllStateStats(): Promise<ActionResult<Record<StateCode, DashboardStats>>> {
  return runCachedAction(
    'getAllStateStats',
    () => regulationsRepo.getAllStateStats(),
    ['dashboard-all-state-stats'],
    { revalidate: 60, tags: ['dashboard'] }
  );
}

/**
 * Get recent activity counts (last 7 days).
 * Cached for 1 minute to reduce database traffic.
 */
export async function getRecentActivity(
  state?: StateCode
): Promise<ActionResult<RecentActivity>> {
  return runCachedAction(
    'getRecentActivity',
    () => regulationsRepo.getRecentActivity(state),
    [`dashboard-recent-activity-${state ?? 'all'}`],
    { revalidate: 60, tags: ['dashboard'] }
  );
}
