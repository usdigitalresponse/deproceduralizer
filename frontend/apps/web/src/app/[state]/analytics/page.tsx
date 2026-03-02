import { notFound } from 'next/navigation';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getSectionTypeStats, getMetadataStats, getTopKeywords, getTopAppliesTo } from '@/lib/actions/regulations';
import { getRedFlagStatusCounts, getRedFlagCategories } from '@/lib/actions/red-flags';
import { getComplianceIssueStatusCounts, getComplianceIssueCountsByType, getComplianceSeverityDistribution } from '@/lib/actions/compliance-issues';
import { getJenAISeverityDistribution, getJenAIStatusCounts } from '@/lib/actions/jenai';
import { getDefinitionAnalyticsStats } from '@/lib/actions/definitions';
import { getStatuteStats } from '@/lib/actions/statutes';
import { getPipelineAnalyticsData } from '@/lib/actions/pipeline-analytics';
import { getGuidanceOverviewStats, getGuidanceCitationStats } from '@/lib/actions/guidance-documents';
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { JURISDICTION_CONFIG, isValidJurisdiction } from '@/types/state';

interface AnalyticsPageProps {
  params: Promise<{ state: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { state } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state;
  const stateConfig = JURISDICTION_CONFIG[state];

  // Fetch all analytics data in parallel
  const [
    dashboardStatsResult,
    sectionTypeStatsResult,
    metadataStatsResult,
    topKeywordsResult,
    topAppliesToResult,
    redFlagStatusResult,
    redFlagCategoriesResult,
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
  ] = await Promise.all([
    getDashboardStats(stateCode),
    getSectionTypeStats(state),
    getMetadataStats(state),
    getTopKeywords(state, 30),
    getTopAppliesTo(state, 30),
    getRedFlagStatusCounts(stateCode),
    getRedFlagCategories(stateCode),
    getComplianceIssueStatusCounts(stateCode),
    getComplianceIssueCountsByType(stateCode),
    getDefinitionAnalyticsStats(stateCode),
    getStatuteStats(state),
    getPipelineAnalyticsData(stateCode),
    getComplianceSeverityDistribution(stateCode),
    getJenAISeverityDistribution(stateCode),
    getJenAIStatusCounts(stateCode),
    getGuidanceOverviewStats(stateCode),
    getGuidanceCitationStats(stateCode),
  ]);

  // Extract data, falling back to null on failure
  const dashboardStats = dashboardStatsResult.success ? dashboardStatsResult.data : null;
  const sectionTypeStats = sectionTypeStatsResult.success ? sectionTypeStatsResult.data : null;
  const metadataStats = metadataStatsResult.success ? metadataStatsResult.data : null;
  const topKeywords = topKeywordsResult.success ? topKeywordsResult.data : null;
  const topAppliesTo = topAppliesToResult.success ? topAppliesToResult.data : null;
  const redFlagStatus = redFlagStatusResult.success ? redFlagStatusResult.data : null;
  const redFlagCategories = redFlagCategoriesResult.success ? redFlagCategoriesResult.data : null;
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
          redFlagStatus={redFlagStatus}
          redFlagCategories={redFlagCategories}
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
        />
      </Container>
    </div>
  );
}
