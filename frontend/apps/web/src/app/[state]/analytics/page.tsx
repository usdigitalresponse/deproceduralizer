import { notFound } from 'next/navigation';
import type { StateCode } from '@deproceduralizer/database';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getSectionTypeStats, getMetadataStats, getTopKeywords, getTopAppliesTo } from '@/lib/actions/regulations';
import { getRedFlagStatusCounts, getRedFlagCategories } from '@/lib/actions/red-flags';
import { getComplianceIssueStatusCounts, getComplianceIssueCountsByType } from '@/lib/actions/compliance-issues';
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { STATE_CONFIG, isValidState } from '@/types/state';

interface AnalyticsPageProps {
  params: Promise<{ state: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { state } = await params;

  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state.toUpperCase() as StateCode;
  const stateConfig = STATE_CONFIG[state as keyof typeof STATE_CONFIG];

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

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`${stateConfig.name} Analytics`}
        description="Comprehensive analytics, patterns, and insights across regulatory data"
      />
      <Container size="2xl" className="py-6">
        <AnalyticsClient
          state={stateCode}
          dashboardStats={dashboardStats}
          sectionTypeStats={sectionTypeStats}
          metadataStats={metadataStats}
          topKeywords={topKeywords}
          topAppliesTo={topAppliesTo}
          redFlagStatus={redFlagStatus}
          redFlagCategories={redFlagCategories}
          complianceStatus={complianceStatus}
          complianceTypeCounts={complianceTypeCounts}
        />
      </Container>
    </div>
  );
}
