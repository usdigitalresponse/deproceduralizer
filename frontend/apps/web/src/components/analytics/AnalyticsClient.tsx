'use client';

import { useQueryStates } from 'nuqs';
import type { DashboardStats, JurisdictionCode, StatuteLinkStats } from '@deproceduralizer/database';
import type { ReviewStatusCounts } from '@/lib/actions/red-flags';
import type { ComplianceIssueStatusCounts } from '@/lib/actions/compliance-issues';
import type { SectionTypeStats, MetadataStats, KeywordStats, AppliesToStats } from '@/lib/actions/regulations';
import type { DefinitionsAnalyticsStats } from '@/lib/actions/definitions';
import type { PipelineAnalyticsData } from '@/lib/actions/pipeline-analytics';
import type { SeverityDistribution, JenAIReviewStatusCounts } from '@deproceduralizer/database';
import type { GuidanceOverviewStats, GuidanceCitationStats } from '@/lib/actions/guidance-documents';
import type { AnalyticsTabValue } from '@/lib/constants/values';
import { analyticsParsers } from '@/lib/url/parsers';
import { AnalyticsTabs } from './AnalyticsTabs';
import { OverviewTab } from './OverviewTab';
import { IssuesTab } from './IssuesTab';
import { KeywordsTab } from './KeywordsTab';
import { DefinitionsTab } from './DefinitionsTab';
import { CrossReferencesTab } from './CrossReferencesTab';
import { StatutesTab } from './StatutesTab';
import { GuidanceAnalyticsTab } from './GuidanceAnalyticsTab';
import { PipelineTab } from './PipelineTab';

export interface AnalyticsClientProps {
  jurisdiction: JurisdictionCode;
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
  statuteStats: StatuteLinkStats | null;
  pipelineData: PipelineAnalyticsData | null;
  complianceSeverity: SeverityDistribution | null;
  jenaiSeverity: SeverityDistribution | null;
  jenaiStats: JenAIReviewStatusCounts | null;
  guidanceOverviewStats?: GuidanceOverviewStats | null;
  guidanceCitationStats?: GuidanceCitationStats | null;
}

export function AnalyticsClient({
  jurisdiction,
  dashboardStats,
  sectionTypeStats,
  metadataStats,
  topKeywords,
  redFlagStatus,
  complianceStatus,
  complianceTypeCounts,
  definitionsStats,
  statuteStats,
  pipelineData,
  complianceSeverity,
  jenaiSeverity,
  jenaiStats,
  guidanceOverviewStats,
  guidanceCitationStats,
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
            complianceTypeCounts={complianceTypeCounts}
            metadataStats={metadataStats}
            definitionsStats={definitionsStats}
            statuteStats={statuteStats}
            pipelineData={pipelineData}
            complianceSeverity={complianceSeverity}
            jenaiSeverity={jenaiSeverity}
            jenaiStats={jenaiStats}
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

        {currentTab === 'crossrefs' && (
          <CrossReferencesTab jurisdiction={jurisdiction} />
        )}

        {currentTab === 'definitions' && (
          <DefinitionsTab stats={definitionsStats} jurisdiction={jurisdiction} />
        )}

        {currentTab === 'statutes' && (
          <StatutesTab stats={statuteStats} jurisdiction={jurisdiction} />
        )}

        {currentTab === 'guidance' && (
          <GuidanceAnalyticsTab
            overviewStats={guidanceOverviewStats ?? null}
            citationStats={guidanceCitationStats ?? null}
            jurisdiction={jurisdiction}
          />
        )}

        {currentTab === 'pipeline' && (
          <PipelineTab jurisdiction={jurisdiction} data={pipelineData} />
        )}
      </div>
    </div>
  );
}
