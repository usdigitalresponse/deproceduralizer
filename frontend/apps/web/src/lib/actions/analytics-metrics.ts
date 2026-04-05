'use server';

import 'server-only';
import {
  db,
  ComplianceIssuesRepository,
  type JurisdictionCode,
  type SeverityDistribution,
  type PipelineFunnelData,
  type AnalysisSource,
  type ClassificationBreakdown,
  type TierCompletionCounts,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runCachedAction } from './types';

const complianceIssuesRepo = new ComplianceIssuesRepository(db);

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

/** COALESCE-based classification totals — each record counted once at its highest tier. */
export interface ClassificationTotals {
  burdensome: number;
  justified: number;
  unrelated: number;
  total: number;
}

/** Review status counts from human review workflow. */
export interface ReviewStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

/** Issue type × classification breakdown. */
export type TypeClassificationCounts = Record<
  string,
  { burdensome: number; justified: number; unrelated: number; total: number }
>;

/**
 * Composite metrics shape for analytics Overview/Issues tabs and pipeline summary cards.
 * All counts use requirementFound=true and COALESCE(tier3, tier2, tier1) classification.
 */
export interface AnalyticsSummaryMetrics {
  classificationTotals: ClassificationTotals;
  reviewStatus: ReviewStatusCounts;
  countsByType: Record<string, number>;
  countsByTypeAndClassification: TypeClassificationCounts;
  severity: SeverityDistribution;
  funnel: PipelineFunnelData;
  classificationBreakdown: ClassificationBreakdown;
  tierCounts: TierCompletionCounts;
}

// ═══════════════════════════════════════════════════════════════════
// Individual Metrics (cached, source-aware)
// ═══════════════════════════════════════════════════════════════════

/**
 * COALESCE-based classification totals.
 * Computed by summing getCountsByTypeAndClassification across all issue types.
 */
export async function getClassificationTotals(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<ClassificationTotals>> {
  return runCachedAction(
    'getClassificationTotals',
    async () => {
      const byTypeAndClass = await complianceIssuesRepo.getCountsByTypeAndClassification(jurisdiction, source);
      return Object.values(byTypeAndClass).reduce(
        (acc, classMap) => ({
          burdensome: acc.burdensome + classMap.burdensome,
          justified: acc.justified + classMap.justified,
          unrelated: acc.unrelated + (classMap.total - classMap.burdensome - classMap.justified),
          total: acc.total + classMap.total,
        }),
        { burdensome: 0, justified: 0, unrelated: 0, total: 0 }
      );
    },
    [`classification-totals-${jurisdiction}-${source ?? 'all'}`],
    { revalidate: 300, tags: ['compliance-analytics'] }
  );
}

/** Human review status counts (unreviewed, confirmed, false positives, etc.) */
export async function getReviewStatusCounts(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<ReviewStatusCounts>> {
  const repoSource = source ?? undefined;
  return runCachedAction(
    'getReviewStatusCounts',
    () => complianceIssuesRepo.getCountsByStatus(jurisdiction, repoSource ? { source: repoSource } : undefined),
    [`review-status-counts-${jurisdiction}-${source ?? 'all'}`],
    { revalidate: 120, tags: ['compliance-issues'] }
  );
}

/** Substantive issue counts by type (requirementFound=true, COALESCE classification). */
export async function getSubstantiveCountsByType(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<Record<string, number>>> {
  return runCachedAction(
    'getSubstantiveCountsByType',
    () => complianceIssuesRepo.getCountsByType(jurisdiction, source),
    [`substantive-counts-by-type-${jurisdiction}-${source ?? 'all'}`],
    { revalidate: 300, tags: ['compliance-analytics'] }
  );
}

/** Substantive issue counts by type AND classification. */
export async function getSubstantiveCountsByTypeAndClassification(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<TypeClassificationCounts>> {
  return runCachedAction(
    'getSubstantiveCountsByTypeAndClassification',
    () => complianceIssuesRepo.getCountsByTypeAndClassification(jurisdiction, source),
    [`substantive-counts-by-type-class-${jurisdiction}-${source ?? 'all'}`],
    { revalidate: 300, tags: ['compliance-analytics'] }
  );
}

/** Severity distribution (high/medium/low). */
export async function getSeverityMetrics(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<SeverityDistribution>> {
  return runCachedAction(
    'getSeverityMetrics',
    () => complianceIssuesRepo.getSeverityDistribution(jurisdiction, source),
    [`severity-metrics-${jurisdiction}-${source ?? 'all'}`],
    { revalidate: 3600, tags: ['compliance-analytics'] }
  );
}

/** Pipeline funnel statistics. */
export async function getFunnelMetrics(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<PipelineFunnelData>> {
  return runCachedAction(
    'getFunnelMetrics',
    () => complianceIssuesRepo.getPipelineFunnelStats(jurisdiction, undefined, source),
    [`funnel-metrics-${jurisdiction}-${source ?? 'all'}`],
    { revalidate: 3600, tags: ['pipeline-analytics'] }
  );
}

// ═══════════════════════════════════════════════════════════════════
// Composite Fetcher
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all compliance analytics metrics in one call.
 * Used by both /analytics and /pipeline pages for consistent data.
 *
 * All counts use requirementFound=true and COALESCE(tier3, tier2, tier1).
 * Source parameter controls regulation/guidance/all filtering.
 */
export async function getAnalyticsSummary(
  jurisdiction: JurisdictionCode,
  source?: AnalysisSource
): Promise<ActionResult<AnalyticsSummaryMetrics>> {
  try {
    const [
      classificationTotalsResult,
      reviewStatusResult,
      countsByTypeResult,
      countsByTypeAndClassResult,
      severityResult,
      funnelResult,
      classificationBreakdownResult,
      tierCountsResult,
    ] = await Promise.all([
      getClassificationTotals(jurisdiction, source),
      getReviewStatusCounts(jurisdiction, source),
      getSubstantiveCountsByType(jurisdiction, source),
      getSubstantiveCountsByTypeAndClassification(jurisdiction, source),
      getSeverityMetrics(jurisdiction, source),
      getFunnelMetrics(jurisdiction, source),
      runCachedAction(
        'classificationBreakdown',
        () => complianceIssuesRepo.getClassificationBreakdown(jurisdiction, source),
        [`classification-breakdown-${jurisdiction}-${source ?? 'all'}`],
        { revalidate: 120, tags: ['compliance-analytics'] }
      ),
      runCachedAction(
        'tierCounts',
        () => complianceIssuesRepo.getAnalysisTierCounts(jurisdiction, source),
        [`tier-counts-${jurisdiction}-${source ?? 'all'}`],
        { revalidate: 120, tags: ['compliance-analytics'] }
      ),
    ]);

    if (!classificationTotalsResult.success) return failure(classificationTotalsResult.error);
    if (!reviewStatusResult.success) return failure(reviewStatusResult.error);
    if (!countsByTypeResult.success) return failure(countsByTypeResult.error);
    if (!countsByTypeAndClassResult.success) return failure(countsByTypeAndClassResult.error);
    if (!severityResult.success) return failure(severityResult.error);
    if (!funnelResult.success) return failure(funnelResult.error);
    if (!classificationBreakdownResult.success) return failure(classificationBreakdownResult.error);
    if (!tierCountsResult.success) return failure(tierCountsResult.error);

    return success({
      classificationTotals: classificationTotalsResult.data,
      reviewStatus: reviewStatusResult.data,
      countsByType: countsByTypeResult.data,
      countsByTypeAndClassification: countsByTypeAndClassResult.data,
      severity: severityResult.data,
      funnel: funnelResult.data,
      classificationBreakdown: classificationBreakdownResult.data,
      tierCounts: tierCountsResult.data,
    });
  } catch (error) {
    console.error('[getAnalyticsSummary]', error);
    return failure(getErrorMessage(error));
  }
}
