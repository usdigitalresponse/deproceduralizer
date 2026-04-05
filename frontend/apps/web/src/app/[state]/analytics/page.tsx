import { notFound } from 'next/navigation';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getSectionTypeStats, getMetadataStats, getTopKeywords, getTopAppliesTo } from '@/lib/actions/regulations';
import { getComplianceIssueStatusCounts, getComplianceIssueCountsByType, getComplianceIssueCountsByTypeAndClassification, getComplianceSeverityDistribution } from '@/lib/actions/compliance-issues';
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
  const [
    dashboardStatsResult,
    sectionTypeStatsResult,
    metadataStatsResult,
    topKeywordsResult,
    topAppliesToResult,
    complianceStatusResult,
    complianceTypeCountsResult,
    definitionsStatsResult,
    statuteStatsResult,
    pipelineDataResult,
    complianceSeverityResult,
    jenaiSeverityResult,
    jenaiStatsResult,
    guidanceOverviewStatsResult,
    guidanceCitationStatsResult,
    guidanceReadabilityStatsResult,
    guidanceReadabilityCrossCutsResult,
    guidanceLineageStatsResult,
    // JenAI analytics tab data
    jenaiCategoriesResult,
    jenaiPartsResult,
    jenaiSectionTypesResult,
    jenaiDeveloperStatusCountsResult,
    jenaiBurdenStatsResult,
    jenaiComplexityDistributionResult,
    jenaiCategorySeverityMatrixResult,
    jenaiSourceTypeBreakdownResult,
    jenaiReviewProgressByCategoryResult,
    jenaiBurdenScoreDistributionResult,
    jenaiStrategyStatsResult,
    complianceTypeClassificationResult,
  ] = await Promise.all([
    getDashboardStats(stateCode),
    getSectionTypeStats(state),
    getMetadataStats(state),
    getTopKeywords(state, 30),
    getTopAppliesTo(state, 30),
    getComplianceIssueStatusCounts(stateCode, repoSource ? { source: repoSource } : undefined),
    getComplianceIssueCountsByType(stateCode, repoSource),
    getDefinitionAnalyticsStats(stateCode),
    getStatuteStats(state),
    getPipelineAnalyticsData(stateCode, repoSource),
    getComplianceSeverityDistribution(stateCode, repoSource),
    getJenAISeverityDistribution(stateCode),
    getJenAIStatusCounts(stateCode),
    getGuidanceOverviewStats(stateCode),
    getGuidanceCitationStats(stateCode),
    getGuidanceReadabilityStats(stateCode),
    getGuidanceReadabilityCrossCuts(stateCode),
    getGuidanceLineageStats(stateCode),
    // JenAI analytics tab
    getJenAICategories(stateCode),
    getJenAIParts(stateCode),
    getJenAISectionTypes(stateCode),
    getJenAIDeveloperStatusCounts(stateCode),
    getJenAIBurdenStats(stateCode),
    getJenAIComplexityDistribution(stateCode),
    getJenAICategorySeverityMatrix(stateCode),
    getJenAISourceTypeBreakdown(stateCode),
    getJenAIReviewProgressByCategory(stateCode),
    getJenAIBurdenScoreDistribution(stateCode),
    getJenAIStrategyStats(stateCode),
    getComplianceIssueCountsByTypeAndClassification(stateCode, repoSource),
  ]);

  // Extract data, falling back to null on failure
  const dashboardStats = dashboardStatsResult.success ? dashboardStatsResult.data : null;
  const sectionTypeStats = sectionTypeStatsResult.success ? sectionTypeStatsResult.data : null;
  const metadataStats = metadataStatsResult.success ? metadataStatsResult.data : null;
  const topKeywords = topKeywordsResult.success ? topKeywordsResult.data : null;
  const topAppliesTo = topAppliesToResult.success ? topAppliesToResult.data : null;
  const complianceStatus = complianceStatusResult.success ? complianceStatusResult.data : null;
  const complianceTypeCounts = complianceTypeCountsResult.success ? complianceTypeCountsResult.data : null;
  const definitionsStats = definitionsStatsResult.success ? definitionsStatsResult.data : null;
  const statuteStats = statuteStatsResult.success ? statuteStatsResult.data : null;
  const pipelineData = pipelineDataResult.success ? pipelineDataResult.data : null;
  const complianceSeverity = complianceSeverityResult.success ? complianceSeverityResult.data : null;
  const jenaiSeverity = jenaiSeverityResult.success ? jenaiSeverityResult.data : null;
  const jenaiStats = jenaiStatsResult.success ? jenaiStatsResult.data : null;
  const guidanceOverviewStats = guidanceOverviewStatsResult.success ? guidanceOverviewStatsResult.data : null;
  const guidanceCitationStats = guidanceCitationStatsResult.success ? guidanceCitationStatsResult.data : null;
  const guidanceReadabilityStats = guidanceReadabilityStatsResult.success ? guidanceReadabilityStatsResult.data : null;
  const guidanceReadabilityCrossCuts = guidanceReadabilityCrossCutsResult.success ? guidanceReadabilityCrossCutsResult.data : null;
  const guidanceLineageStats = guidanceLineageStatsResult.success ? guidanceLineageStatsResult.data : null;
  const complianceTypeClassification = complianceTypeClassificationResult.success ? complianceTypeClassificationResult.data : null;

  // JenAI analytics tab — grouped into single prop object
  const jenaiAnalyticsData = {
    jenaiStats,
    jenaiSeverity,
    categories: jenaiCategoriesResult.success ? jenaiCategoriesResult.data : null,
    parts: jenaiPartsResult.success ? jenaiPartsResult.data : null,
    sectionTypes: jenaiSectionTypesResult.success ? jenaiSectionTypesResult.data : null,
    developerStatusCounts: jenaiDeveloperStatusCountsResult.success ? jenaiDeveloperStatusCountsResult.data : null,
    burdenStats: jenaiBurdenStatsResult.success ? jenaiBurdenStatsResult.data : null,
    complexityDistribution: jenaiComplexityDistributionResult.success ? jenaiComplexityDistributionResult.data : null,
    categorySeverityMatrix: jenaiCategorySeverityMatrixResult.success ? jenaiCategorySeverityMatrixResult.data : null,
    sourceTypeBreakdown: jenaiSourceTypeBreakdownResult.success ? jenaiSourceTypeBreakdownResult.data : null,
    reviewProgressByCategory: jenaiReviewProgressByCategoryResult.success ? jenaiReviewProgressByCategoryResult.data : null,
    burdenScoreDistribution: jenaiBurdenScoreDistributionResult.success ? jenaiBurdenScoreDistributionResult.data : null,
    strategyStats: jenaiStrategyStatsResult.success ? jenaiStrategyStatsResult.data : null,
  };

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
          complianceStatus={complianceStatus}
          complianceTypeCounts={complianceTypeCounts}
          definitionsStats={definitionsStats}
          statuteStats={statuteStats}
          pipelineData={pipelineData}
          complianceSeverity={complianceSeverity}
          jenaiSeverity={jenaiSeverity}
          jenaiStats={jenaiStats}
          guidanceOverviewStats={guidanceOverviewStats}
          guidanceCitationStats={guidanceCitationStats}
          guidanceReadabilityStats={guidanceReadabilityStats}
          guidanceReadabilityCrossCuts={guidanceReadabilityCrossCuts}
          guidanceLineageStats={guidanceLineageStats}
          jenaiAnalyticsData={jenaiAnalyticsData}
          complianceTypeClassification={complianceTypeClassification}
        />
      </Container>
    </div>
  );
}
