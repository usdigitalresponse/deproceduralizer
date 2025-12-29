'use client';

import { useQueryStates } from 'nuqs';
import { analyticsParsers } from '@/lib/url/parsers';
import type { DashboardStats } from '@deproceduralizer/database';
import type { SectionTypeStats, MetadataStats, KeywordStats } from '@/lib/actions/regulations';
import type { ReviewStatusCounts } from '@/lib/actions/red-flags';
import type { ComplianceIssueStatusCounts } from '@/lib/actions/compliance-issues';
import { AnalyticsTabs } from './AnalyticsTabs';
import { OverviewTab } from './OverviewTab';
import { HierarchyTab } from './HierarchyTab';
import { IssuesTab } from './IssuesTab';
import { KeywordsTab } from './KeywordsTab';

interface AnalyticsClientProps {
  state: string;
  dashboardStats: DashboardStats | null;
  sectionTypeStats: SectionTypeStats[];
  topKeywords: KeywordStats[];
  metadataStats: MetadataStats | null;
  redFlagStatus: ReviewStatusCounts | null;
  complianceStatus: ComplianceIssueStatusCounts | null;
  complianceByType: Record<string, number>;
}

export function AnalyticsClient({
  state,
  dashboardStats,
  sectionTypeStats,
  topKeywords,
  metadataStats,
  redFlagStatus,
  complianceStatus,
  complianceByType,
}: AnalyticsClientProps) {
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: false });
  const { tab } = params;

  const handleTabChange = (newTab: string) => {
    setParams({ tab: newTab as typeof tab });
  };

  return (
    <div className="space-y-6">
      <AnalyticsTabs activeTab={tab} onTabChange={handleTabChange} />

      {tab === 'overview' && (
        <OverviewTab
          dashboardStats={dashboardStats}
          redFlagStatus={redFlagStatus}
          complianceStatus={complianceStatus}
        />
      )}

      {tab === 'hierarchy' && (
        <HierarchyTab
          state={state}
          sizeMetric={params.sizeMetric}
          colorMetric={params.colorMetric}
          depth={params.depth}
          onParamsChange={setParams}
        />
      )}

      {tab === 'issues' && (
        <IssuesTab
          complianceByType={complianceByType}
          redFlagStatus={redFlagStatus}
          complianceStatus={complianceStatus}
        />
      )}

      {tab === 'keywords' && (
        <KeywordsTab
          sectionTypeStats={sectionTypeStats}
          topKeywords={topKeywords}
          metadataStats={metadataStats}
        />
      )}
    </div>
  );
}
