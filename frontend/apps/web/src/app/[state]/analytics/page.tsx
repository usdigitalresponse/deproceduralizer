import { notFound } from 'next/navigation';
import { isValidState, type StateCode } from '@deproceduralizer/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getSectionTypeStats, getTopKeywords, getMetadataStats } from '@/lib/actions/regulations';
import { getRedFlagStatusCounts } from '@/lib/actions/red-flags';
import { getComplianceIssueStatusCounts, getComplianceIssueCountsByType } from '@/lib/actions/compliance-issues';
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient';

interface AnalyticsPageProps {
  params: Promise<{ state: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { state } = await params;

  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state.toUpperCase() as StateCode;

  // Fetch all analytics data in parallel
  const [
    dashboardStatsResult,
    sectionTypeStatsResult,
    topKeywordsResult,
    metadataStatsResult,
    redFlagStatusResult,
    complianceStatusResult,
    complianceByTypeResult,
  ] = await Promise.all([
    getDashboardStats(stateCode),
    getSectionTypeStats(state),
    getTopKeywords(state, 20),
    getMetadataStats(state),
    getRedFlagStatusCounts(stateCode),
    getComplianceIssueStatusCounts(stateCode),
    getComplianceIssueCountsByType(stateCode),
  ]);

  // Extract data with fallbacks
  const dashboardStats = dashboardStatsResult.success ? dashboardStatsResult.data : null;
  const sectionTypeStats = sectionTypeStatsResult.success ? sectionTypeStatsResult.data : [];
  const topKeywords = topKeywordsResult.success ? topKeywordsResult.data : [];
  const metadataStats = metadataStatsResult.success ? metadataStatsResult.data : null;
  const redFlagStatus = redFlagStatusResult.success ? redFlagStatusResult.data : null;
  const complianceStatus = complianceStatusResult.success ? complianceStatusResult.data : null;
  const complianceByType = complianceByTypeResult.success ? complianceByTypeResult.data : {};

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Visualize regulatory analysis data for ${state.toUpperCase()}`}
      />
      <Container size="2xl" className="py-6">
        <AnalyticsClient
          state={state}
          dashboardStats={dashboardStats}
          sectionTypeStats={sectionTypeStats}
          topKeywords={topKeywords}
          metadataStats={metadataStats}
          redFlagStatus={redFlagStatus}
          complianceStatus={complianceStatus}
          complianceByType={complianceByType}
        />
      </Container>
    </>
  );
}
