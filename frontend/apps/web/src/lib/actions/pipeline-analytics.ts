'use server';

import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  db,
  ComplianceIssuesRepository,
  type StateCode,
  type PipelineFunnelData,
  type Tier1ContextRequestStats,
  type TierTransitionData,
  type Tier3EvidenceStats,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);

// ═══════════════════════════════════════════════════════════════════
// Composite Type
// ═══════════════════════════════════════════════════════════════════

export interface PipelineAnalyticsData {
  funnel: PipelineFunnelData;
  tier1Context: Tier1ContextRequestStats;
  tierTransitions: TierTransitionData;
  tier3Evidence: Tier3EvidenceStats;
}

// Re-export sub-types for UI component use
export type {
  PipelineFunnelData,
  Tier1ContextRequestStats,
  TierTransitionData,
  Tier3EvidenceStats,
};

// ═══════════════════════════════════════════════════════════════════
// Individual Cached Actions
// ═══════════════════════════════════════════════════════════════════

export async function getPipelineFunnelStats(
  state: StateCode,
  issueType?: string
): Promise<ActionResult<PipelineFunnelData>> {
  try {
    const cachedFn = unstable_cache(
      () => complianceIssuesRepo.getPipelineFunnelStats(state, issueType),
      [`pipeline-funnel-${state}-${issueType ?? 'all'}`],
      { revalidate: 3600, tags: ['pipeline-analytics'] }
    );
    const data = await cachedFn();
    return success(data);
  } catch (error) {
    console.error('[getPipelineFunnelStats]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getTier1ContextRequestStats(
  state: StateCode,
  issueType?: string
): Promise<ActionResult<Tier1ContextRequestStats>> {
  try {
    const cachedFn = unstable_cache(
      () => complianceIssuesRepo.getTier1ContextRequestStats(state, issueType),
      [`pipeline-tier1-context-${state}-${issueType ?? 'all'}`],
      { revalidate: 3600, tags: ['pipeline-analytics'] }
    );
    const data = await cachedFn();
    return success(data);
  } catch (error) {
    console.error('[getTier1ContextRequestStats]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getTierTransitionStats(
  state: StateCode,
  issueType?: string
): Promise<ActionResult<TierTransitionData>> {
  try {
    const cachedFn = unstable_cache(
      () => complianceIssuesRepo.getTierTransitionStats(state, issueType),
      [`pipeline-tier-transitions-${state}-${issueType ?? 'all'}`],
      { revalidate: 3600, tags: ['pipeline-analytics'] }
    );
    const data = await cachedFn();
    return success(data);
  } catch (error) {
    console.error('[getTierTransitionStats]', error);
    return failure(getErrorMessage(error));
  }
}

export async function getTier3EvidenceStats(
  state: StateCode,
  issueType?: string
): Promise<ActionResult<Tier3EvidenceStats>> {
  try {
    const cachedFn = unstable_cache(
      () => complianceIssuesRepo.getTier3EvidenceStats(state, issueType),
      [`pipeline-tier3-evidence-${state}-${issueType ?? 'all'}`],
      { revalidate: 3600, tags: ['pipeline-analytics'] }
    );
    const data = await cachedFn();
    return success(data);
  } catch (error) {
    console.error('[getTier3EvidenceStats]', error);
    return failure(getErrorMessage(error));
  }
}

// ═══════════════════════════════════════════════════════════════════
// Composite Action (for server-side page data)
// ═══════════════════════════════════════════════════════════════════

export async function getPipelineAnalyticsData(
  state: StateCode
): Promise<ActionResult<PipelineAnalyticsData>> {
  try {
    const [funnelResult, tier1Result, transitionsResult, evidenceResult] = await Promise.all([
      getPipelineFunnelStats(state),
      getTier1ContextRequestStats(state),
      getTierTransitionStats(state),
      getTier3EvidenceStats(state),
    ]);

    if (!funnelResult.success) return failure(funnelResult.error);
    if (!tier1Result.success) return failure(tier1Result.error);
    if (!transitionsResult.success) return failure(transitionsResult.error);
    if (!evidenceResult.success) return failure(evidenceResult.error);

    return success({
      funnel: funnelResult.data,
      tier1Context: tier1Result.data,
      tierTransitions: transitionsResult.data,
      tier3Evidence: evidenceResult.data,
    });
  } catch (error) {
    console.error('[getPipelineAnalyticsData]', error);
    return failure(getErrorMessage(error));
  }
}
