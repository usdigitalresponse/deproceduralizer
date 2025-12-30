'use client';

import { useQueryStates } from 'nuqs';
import type { DashboardStats, StateCode } from '@deproceduralizer/database';
import type { ReviewStatusCounts } from '@/lib/actions/red-flags';
import type { ComplianceIssueStatusCounts } from '@/lib/actions/compliance-issues';
import type { SectionTypeStats, MetadataStats, KeywordStats, AppliesToStats } from '@/lib/actions/regulations';
import type { DefinitionsAnalyticsStats } from '@/lib/actions/definitions';
import type { AnalyticsTabValue } from '@/lib/constants/values';
import { analyticsParsers } from '@/lib/url/parsers';
import { AnalyticsTabs } from './AnalyticsTabs';
import { OverviewTab } from './OverviewTab';
import { IssuesTab } from './IssuesTab';
import { KeywordsTab } from './KeywordsTab';
import { HierarchyTab } from './HierarchyTab';
import { DefinitionsTab } from './DefinitionsTab';
import { CrossReferencesTab } from './CrossReferencesTab';

export interface AnalyticsClientProps {
  state: StateCode;
  dashboardStats: DashboardStats | null;
  sectionTypeStats: SectionTypeStats[] | null;
  metadataStats: MetadataStats | null;
  topKeywords: KeywordStats[] | null;
  topAppliesTo: AppliesToStats[] | null;
  redFlagStatus: ReviewStatusCounts | null;
  redFlagCategories: string[] | null;
  complianceStatus: ComplianceIssueStatusCounts | null;
  complianceTypeCounts: Record<string, number> | null;
  definitionsStats: DefinitionsAnalyticsStats | null;
}

export function AnalyticsClient({
  state,
  dashboardStats,
  sectionTypeStats,
  metadataStats,
  topKeywords,
  redFlagStatus,
  complianceStatus,
  complianceTypeCounts,
  definitionsStats,
}: AnalyticsClientProps) {
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: true });
  const currentTab = params.tab;

  const handleTabChange = (tab: AnalyticsTabValue) => {
    setParams({ tab });
  };

  const handleParamsChange = (newParams: Record<string, unknown>) => {
    setParams(newParams as Parameters<typeof setParams>[0]);
  };

  return (
    <div className="space-y-6">
      <AnalyticsTabs activeTab={currentTab} onTabChange={handleTabChange} />

      <div className="mt-6">
        {currentTab === 'overview' && (
          <OverviewTab
            dashboardStats={dashboardStats}
            redFlagStatus={redFlagStatus}
            complianceStatus={complianceStatus}
          />
        )}

        {currentTab === 'issues' && (
          <IssuesTab
            complianceByType={complianceTypeCounts ?? {}}
            redFlagStatus={redFlagStatus}
            complianceStatus={complianceStatus}
          />
        )}

        {currentTab === 'keywords' && (
          <KeywordsTab
            sectionTypeStats={sectionTypeStats ?? []}
            topKeywords={topKeywords ?? []}
            metadataStats={metadataStats}
          />
        )}

        {currentTab === 'hierarchy' && (
          <HierarchyTab
            state={state}
            sizeMetric={params.sizeMetric}
            colorMetric={params.colorMetric}
            depth={params.depth}
            onParamsChange={handleParamsChange}
          />
        )}

        {currentTab === 'crossrefs' && (
          <CrossReferencesTab state={state} />
        )}

        {currentTab === 'definitions' && (
          <DefinitionsTab stats={definitionsStats} />
        )}
      </div>
    </div>
  );
}
