import { notFound } from 'next/navigation';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getSectionTypeStats, getMetadataStats, getTopKeywords, getTopAppliesTo } from '@/lib/actions/regulations';
import { getAnalyticsSummary } from '@/lib/actions/analytics-metrics';
import {
  getJenAISeverityDistribution, getJenAIStatusCounts, getJenAICategories,
  getJenAIParts, getJenAISectionTypes, getJenAIDeveloperStatusCounts,
  getJenAIBurdenStats, getJenAIComplexityDistribution,
  getJenAICategorySeverityMatrix, getJenAISourceTypeBreakdown,
  getJenAIReviewProgressByCategory, getJenAIBurdenScoreDistribution,
} from '@/lib/actions/jenai';
import { getDefinitionAnalyticsStats } from '@/lib/actions/definitions';
import { getStatuteStats } from '@/lib/actions/statutes';
import { getJenAIStrategyStats } from '@/lib/actions/jenai-strategies';
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
    jenaiSeverityResult,
    jenaiStatsResult,
    jenaiCategoriesResult,
    jenaiPartsResult,
    jenaiSectionTypesResult,
    jenaiDeveloperStatusResult,
    jenaiStrategyStatsResult,
    jenaiComplexityResult,
    jenaiCategorySeverityResult,
    jenaiSourceTypeResult,
    jenaiReviewProgressResult,
    jenaiBurdenScoreResult,
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
    getJenAISeverityDistribution(stateCode),
    getJenAIStatusCounts(stateCode),
    getJenAICategories(stateCode),
    getJenAIParts(stateCode),
    getJenAISectionTypes(stateCode),
    getJenAIDeveloperStatusCounts(stateCode),
    getJenAIStrategyStats(stateCode),
    getJenAIComplexityDistribution(stateCode),
    getJenAICategorySeverityMatrix(stateCode),
    getJenAISourceTypeBreakdown(stateCode),
    getJenAIReviewProgressByCategory(stateCode),
    getJenAIBurdenScoreDistribution(stateCode),
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
  const jenaiSeverity = jenaiSeverityResult.success ? jenaiSeverityResult.data : null;
  const jenaiStats = jenaiStatsResult.success ? jenaiStatsResult.data : null;
  const jenaiCategories = jenaiCategoriesResult.success ? jenaiCategoriesResult.data : null;
  const jenaiParts = jenaiPartsResult.success ? jenaiPartsResult.data : null;
  const jenaiSectionTypes = jenaiSectionTypesResult.success ? jenaiSectionTypesResult.data : null;
  const jenaiDeveloperStatus = jenaiDeveloperStatusResult.success ? jenaiDeveloperStatusResult.data : null;
  const jenaiStrategyStats = jenaiStrategyStatsResult.success ? jenaiStrategyStatsResult.data : null;
  const jenaiComplexity = jenaiComplexityResult.success ? jenaiComplexityResult.data : null;
  const jenaiCategorySeverity = jenaiCategorySeverityResult.success ? jenaiCategorySeverityResult.data : null;
  const jenaiSourceType = jenaiSourceTypeResult.success ? jenaiSourceTypeResult.data : null;
  const jenaiReviewProgress = jenaiReviewProgressResult.success ? jenaiReviewProgressResult.data : null;
  const jenaiBurdenScore = jenaiBurdenScoreResult.success ? jenaiBurdenScoreResult.data : null;
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
          jenaiSeverity={jenaiSeverity}
          jenaiStats={jenaiStats}
          jenaiCategories={jenaiCategories}
          jenaiParts={jenaiParts}
          jenaiSectionTypes={jenaiSectionTypes}
          jenaiDeveloperStatus={jenaiDeveloperStatus}
          jenaiStrategyStats={jenaiStrategyStats}
          jenaiComplexity={jenaiComplexity}
          jenaiCategorySeverity={jenaiCategorySeverity}
          jenaiSourceType={jenaiSourceType}
          jenaiReviewProgress={jenaiReviewProgress}
          jenaiBurdenScore={jenaiBurdenScore}
          guidanceOverviewStats={guidanceOverviewStats}
          guidanceCitationStats={guidanceCitationStats}
          guidanceReadabilityStats={guidanceReadabilityStats}
          guidanceReadabilityCrossCuts={guidanceReadabilityCrossCuts}
          guidanceLineageStats={guidanceLineageStats}
          jenaiAnalyticsData={{
            jenaiStats,
            jenaiSeverity,
            categories: jenaiCategories,
            parts: jenaiParts,
            sectionTypes: jenaiSectionTypes,
            developerStatusCounts: jenaiDeveloperStatus,
            burdenStats: null,
            complexityDistribution: jenaiComplexity,
            categorySeverityMatrix: jenaiCategorySeverity,
            sourceTypeBreakdown: jenaiSourceType,
            reviewProgressByCategory: jenaiReviewProgress,
            burdenScoreDistribution: jenaiBurdenScore,
            strategyStats: jenaiStrategyStats,
          }}
        />
      </Container>
    </div>
  );
}
