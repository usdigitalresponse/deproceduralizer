'use server';

import 'server-only';
import {
  db,
  ComplianceIssuesRepository,
  type JurisdictionCode,
  type PipelineFunnelData,
  type Tier1ContextRequestStats,
  type TierTransitionData,
  type TransitionReasonData,
  type Tier3EvidenceStats,
  type Tier2ContextRequestsStats,
  type ContextUsedStats,
  type ResearchFunnelStats,
  type ConfidenceByClassificationData,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runCachedAction } from './types';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);

// ═══════════════════════════════════════════════════════════════════
// Composite Type
// ═══════════════════════════════════════════════════════════════════

export interface PipelineAnalyticsData {
  funnel: PipelineFunnelData;
  tier1Context: Tier1ContextRequestStats;
  tierTransitions: TierTransitionData;
  tier3Evidence: Tier3EvidenceStats;
  confidenceByClassification: ConfidenceByClassificationData | null;
  transitionReasons: TransitionReasonData | null;
}

/** Data loaded lazily when the Context & Research subtab is active. */
export interface PipelineContextData {
  tier2Requests: Tier2ContextRequestsStats;
  contextUsed: ContextUsedStats;
  researchFunnel: ResearchFunnelStats;
}

// Re-export sub-types for UI component use
export type {
  PipelineFunnelData,
  Tier1ContextRequestStats,
  TierTransitionData,
  TransitionReasonData,
  Tier3EvidenceStats,
  Tier2ContextRequestsStats,
  ContextUsedStats,
  ResearchFunnelStats,
  ConfidenceByClassificationData,
};

// ═══════════════════════════════════════════════════════════════════
// Individual Cached Actions
// ═══════════════════════════════════════════════════════════════════

export async function getPipelineFunnelStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<PipelineFunnelData>> {
  return runCachedAction(
    'getPipelineFunnelStats',
    () => complianceIssuesRepo.getPipelineFunnelStats(state, issueType),
    [`pipeline-funnel-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getTier1ContextRequestStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<Tier1ContextRequestStats>> {
  return runCachedAction(
    'getTier1ContextRequestStats',
    () => complianceIssuesRepo.getTier1ContextRequestStats(state, issueType),
    [`pipeline-tier1-context-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getTierTransitionStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<TierTransitionData>> {
  return runCachedAction(
    'getTierTransitionStats',
    () => complianceIssuesRepo.getTierTransitionStats(state, issueType),
    [`pipeline-tier-transitions-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getTier3EvidenceStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<Tier3EvidenceStats>> {
  return runCachedAction(
    'getTier3EvidenceStats',
    () => complianceIssuesRepo.getTier3EvidenceStats(state, issueType),
    [`pipeline-tier3-evidence-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getConfidenceByClassification(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<ConfidenceByClassificationData>> {
  return runCachedAction(
    'getConfidenceByClassification',
    () => complianceIssuesRepo.getConfidenceByClassification(state, issueType),
    [`pipeline-confidence-by-class-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getTransitionReasons(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<TransitionReasonData>> {
  return runCachedAction(
    'getTransitionReasons',
    () => complianceIssuesRepo.getTransitionReasons(state, issueType),
    [`pipeline-transition-reasons-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

// ═══════════════════════════════════════════════════════════════════
// Bundle Action (single cache key for filtered refetch)
// ═══════════════════════════════════════════════════════════════════

export interface PipelineAnalyticsBundle {
  funnel: PipelineFunnelData;
  tier1Context: Tier1ContextRequestStats;
  tierTransitions: TierTransitionData;
  tier3Evidence: Tier3EvidenceStats;
  confidenceByClassification: ConfidenceByClassificationData | null;
  transitionReasons: TransitionReasonData | null;
}

export async function getPipelineAnalyticsBundle(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<PipelineAnalyticsBundle>> {
  return runCachedAction(
    'getPipelineAnalyticsBundle',
    async () => {
      const [funnel, tier1, transitions, evidence, confByClass, transReasons] = await Promise.all([
        complianceIssuesRepo.getPipelineFunnelStats(state, issueType),
        complianceIssuesRepo.getTier1ContextRequestStats(state, issueType),
        complianceIssuesRepo.getTierTransitionStats(state, issueType),
        complianceIssuesRepo.getTier3EvidenceStats(state, issueType),
        complianceIssuesRepo.getConfidenceByClassification(state, issueType).catch(() => null),
        complianceIssuesRepo.getTransitionReasons(state, issueType).catch(() => null),
      ]);
      return { funnel, tier1Context: tier1, tierTransitions: transitions, tier3Evidence: evidence, confidenceByClassification: confByClass, transitionReasons: transReasons };
    },
    [`pipeline-bundle-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

// ═══════════════════════════════════════════════════════════════════
// Context & Research Subtab Actions (lazy-loaded)
// ═══════════════════════════════════════════════════════════════════

export async function getTier2ContextRequestsStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<Tier2ContextRequestsStats>> {
  return runCachedAction(
    'getTier2ContextRequestsStats',
    () => complianceIssuesRepo.getTier2ContextRequestsStats(state, issueType),
    [`pipeline-tier2-requests-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getContextUsedStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<ContextUsedStats>> {
  return runCachedAction(
    'getContextUsedStats',
    () => complianceIssuesRepo.getContextUsedStats(state, issueType),
    [`pipeline-context-used-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

export async function getResearchFunnelStats(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<ResearchFunnelStats>> {
  return runCachedAction(
    'getResearchFunnelStats',
    () => complianceIssuesRepo.getResearchFunnelStats(state, issueType),
    [`pipeline-research-funnel-${state}-${issueType ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

/** Fetch all context/research subtab data in parallel. */
export async function getPipelineContextData(
  state: JurisdictionCode,
  issueType?: string
): Promise<ActionResult<PipelineContextData>> {
  try {
    const [tier2Result, contextResult, funnelResult] = await Promise.all([
      getTier2ContextRequestsStats(state, issueType),
      getContextUsedStats(state, issueType),
      getResearchFunnelStats(state, issueType),
    ]);

    if (!tier2Result.success) return failure(tier2Result.error);
    if (!contextResult.success) return failure(contextResult.error);
    if (!funnelResult.success) return failure(funnelResult.error);

    return success({
      tier2Requests: tier2Result.data,
      contextUsed: contextResult.data,
      researchFunnel: funnelResult.data,
    });
  } catch (error) {
    console.error('[getPipelineContextData]', error);
    return failure(getErrorMessage(error));
  }
}

// ═══════════════════════════════════════════════════════════════════
// Composite Action (for server-side page data)
// ═══════════════════════════════════════════════════════════════════

export async function getPipelineAnalyticsData(
  state: JurisdictionCode
): Promise<ActionResult<PipelineAnalyticsData>> {
  try {
    const [funnelResult, tier1Result, transitionsResult, evidenceResult, confByClassResult, transitionReasonsResult] = await Promise.all([
      getPipelineFunnelStats(state),
      getTier1ContextRequestStats(state),
      getTierTransitionStats(state),
      getTier3EvidenceStats(state),
      getConfidenceByClassification(state),
      getTransitionReasons(state),
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
      confidenceByClassification: confByClassResult.success ? confByClassResult.data : null,
      transitionReasons: transitionReasonsResult.success ? transitionReasonsResult.data : null,
    });
  } catch (error) {
    console.error('[getPipelineAnalyticsData]', error);
    return failure(getErrorMessage(error));
  }
}
