import { notFound } from 'next/navigation';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getSectionTypeStats, getMetadataStats, getTopKeywords, getTopAppliesTo } from '@/lib/actions/regulations';
import { getAnalyticsSummary } from '@/lib/actions/analytics-metrics';
import {
  getBarrierSeverityDistribution, getBarrierStatusCounts, getBarrierCategories,
  getBarrierParts, getBarrierSectionTypes, getBarrierDeveloperStatusCounts,
  getBarrierComplexityDistribution,
  getBarrierCategorySeverityMatrix, getBarrierSourceTypeBreakdown,
  getBarrierReviewProgressByCategory, getBarrierBurdenScoreDistribution,
} from '@/lib/actions/barrier';
import { getDefinitionAnalyticsStats } from '@/lib/actions/definitions';
import { getStatuteStats } from '@/lib/actions/statutes';
import { getBarrierStrategyStats } from '@/lib/actions/barrier-strategies';
import { getPipelineAnalyticsData } from '@/lib/actions/pipeline-analytics';
import { getGuidanceOverviewStats, getGuidanceCitationStats, getGuidanceReadabilityStats, getGuidanceReadabilityCrossCuts, getGuidanceLineageStats } from '@/lib/actions/guidance-documents';
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';
import type { AnalysisSource } from '@deproceduralizer/database';

interface AnalyticsPageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  // Map URL source value to repo source type
  const rawSource = typeof queryParams.source === 'string' ? queryParams.source : undefined;
  const repoSource: AnalysisSource | undefined =
    rawSource === 'regulations' ? 'regulation' :
    rawSource === 'guidance' ? 'guidance' :
    undefined; // 'all' or missing → no filter (combined)

  // Fetch all analytics data in parallel
  // getAnalyticsSummary replaces 5 separate compliance calls with one composite fetcher
  const [
    dashboardStatsResult,
    sectionTypeStatsResult,
    metadataStatsResult,
    topKeywordsResult,
    topAppliesToResult,
    analyticsSummaryResult,
    definitionsStatsResult,
    statuteStatsResult,
    pipelineDataResult,
    barrierSeverityResult,
    barrierStatsResult,
    barrierCategoriesResult,
    barrierPartsResult,
    barrierSectionTypesResult,
    barrierDeveloperStatusResult,
    barrierStrategyStatsResult,
    barrierComplexityResult,
    barrierCategorySeverityResult,
    barrierSourceTypeResult,
    barrierReviewProgressResult,
    barrierBurdenScoreResult,
    guidanceOverviewStatsResult,
    guidanceCitationStatsResult,
    guidanceReadabilityStatsResult,
    guidanceReadabilityCrossCutsResult,
    guidanceLineageStatsResult,
  ] = await Promise.all([
    getDashboardStats(stateCode),
    getSectionTypeStats(state),
    getMetadataStats(state),
    getTopKeywords(state, 30),
    getTopAppliesTo(state, 30),
    getAnalyticsSummary(stateCode, repoSource),
    getDefinitionAnalyticsStats(stateCode),
    getStatuteStats(state),
    getPipelineAnalyticsData(stateCode, repoSource),
    getBarrierSeverityDistribution(stateCode),
    getBarrierStatusCounts(stateCode),
    getBarrierCategories(stateCode),
    getBarrierParts(stateCode),
    getBarrierSectionTypes(stateCode),
    getBarrierDeveloperStatusCounts(stateCode),
    getBarrierStrategyStats(stateCode),
    getBarrierComplexityDistribution(stateCode),
    getBarrierCategorySeverityMatrix(stateCode),
    getBarrierSourceTypeBreakdown(stateCode),
    getBarrierReviewProgressByCategory(stateCode),
    getBarrierBurdenScoreDistribution(stateCode),
    getGuidanceOverviewStats(stateCode),
    getGuidanceCitationStats(stateCode),
    getGuidanceReadabilityStats(stateCode),
    getGuidanceReadabilityCrossCuts(stateCode),
    getGuidanceLineageStats(stateCode),
  ]);

  // Extract data, falling back to null on failure
  const dashboardStats = dashboardStatsResult.success ? dashboardStatsResult.data : null;
  const sectionTypeStats = sectionTypeStatsResult.success ? sectionTypeStatsResult.data : null;
  const metadataStats = metadataStatsResult.success ? metadataStatsResult.data : null;
  const topKeywords = topKeywordsResult.success ? topKeywordsResult.data : null;
  const topAppliesTo = topAppliesToResult.success ? topAppliesToResult.data : null;
  const analyticsSummary = analyticsSummaryResult.success ? analyticsSummaryResult.data : null;
  const definitionsStats = definitionsStatsResult.success ? definitionsStatsResult.data : null;
  const statuteStats = statuteStatsResult.success ? statuteStatsResult.data : null;
  const pipelineData = pipelineDataResult.success ? pipelineDataResult.data : null;
  const barrierSeverity = barrierSeverityResult.success ? barrierSeverityResult.data : null;
  const barrierStats = barrierStatsResult.success ? barrierStatsResult.data : null;
  const barrierCategories = barrierCategoriesResult.success ? barrierCategoriesResult.data : null;
  const barrierParts = barrierPartsResult.success ? barrierPartsResult.data : null;
  const barrierSectionTypes = barrierSectionTypesResult.success ? barrierSectionTypesResult.data : null;
  const barrierDeveloperStatus = barrierDeveloperStatusResult.success ? barrierDeveloperStatusResult.data : null;
  const barrierStrategyStats = barrierStrategyStatsResult.success ? barrierStrategyStatsResult.data : null;
  const barrierComplexity = barrierComplexityResult.success ? barrierComplexityResult.data : null;
  const barrierCategorySeverity = barrierCategorySeverityResult.success ? barrierCategorySeverityResult.data : null;
  const barrierSourceType = barrierSourceTypeResult.success ? barrierSourceTypeResult.data : null;
  const barrierReviewProgress = barrierReviewProgressResult.success ? barrierReviewProgressResult.data : null;
  const barrierBurdenScore = barrierBurdenScoreResult.success ? barrierBurdenScoreResult.data : null;
  const guidanceOverviewStats = guidanceOverviewStatsResult.success ? guidanceOverviewStatsResult.data : null;
  const guidanceCitationStats = guidanceCitationStatsResult.success ? guidanceCitationStatsResult.data : null;
  const guidanceReadabilityStats = guidanceReadabilityStatsResult.success ? guidanceReadabilityStatsResult.data : null;
  const guidanceReadabilityCrossCuts = guidanceReadabilityCrossCutsResult.success ? guidanceReadabilityCrossCutsResult.data : null;
  const guidanceLineageStats = guidanceLineageStatsResult.success ? guidanceLineageStatsResult.data : null;

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Analytics`}
        description="Comprehensive analytics, patterns, and insights across regulatory data"
      />
      <Container size="2xl" className="py-6">
        <AnalyticsClient
          jurisdiction={stateCode}
          dashboardStats={dashboardStats}
          sectionTypeStats={sectionTypeStats}
          metadataStats={metadataStats}
          topKeywords={topKeywords}
          topAppliesTo={topAppliesTo}
          analyticsSummary={analyticsSummary}
          definitionsStats={definitionsStats}
          statuteStats={statuteStats}
          pipelineData={pipelineData}
          barrierSeverity={barrierSeverity}
          barrierStats={barrierStats}
          guidanceOverviewStats={guidanceOverviewStats}
          guidanceCitationStats={guidanceCitationStats}
          guidanceReadabilityStats={guidanceReadabilityStats}
          guidanceReadabilityCrossCuts={guidanceReadabilityCrossCuts}
          guidanceLineageStats={guidanceLineageStats}
          barrierAnalyticsData={{
            barrierStats,
            barrierSeverity,
            categories: barrierCategories,
            parts: barrierParts,
            sectionTypes: barrierSectionTypes,
            developerStatusCounts: barrierDeveloperStatus,
            burdenStats: null,
            complexityDistribution: barrierComplexity,
            categorySeverityMatrix: barrierCategorySeverity,
            sourceTypeBreakdown: barrierSourceType,
            reviewProgressByCategory: barrierReviewProgress,
            burdenScoreDistribution: barrierBurdenScore,
            strategyStats: barrierStrategyStats,
          }}
        />
      </Container>
    </div>
  );
}
