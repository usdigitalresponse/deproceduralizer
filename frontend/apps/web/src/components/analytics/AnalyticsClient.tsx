'use client';

import { useQueryState, useQueryStates } from 'nuqs';
import { ScrollText, BookOpen, LayoutList } from 'lucide-react';
import type { DashboardStats, JurisdictionCode, StatuteLinkStats } from '@deproceduralizer/database';
import type { ComplianceIssueStatusCounts, ComplianceTypeClassificationCounts } from '@/lib/actions/compliance-issues';
import type { SectionTypeStats, MetadataStats, KeywordStats, AppliesToStats } from '@/lib/actions/regulations';
import type { DefinitionsAnalyticsStats } from '@/lib/actions/definitions';
import type { PipelineAnalyticsData } from '@/lib/actions/pipeline-analytics';
import type { SeverityDistribution, JenAIReviewStatusCounts } from '@deproceduralizer/database';
import type { GuidanceOverviewStats, GuidanceCitationStats, GuidanceReadabilityStats, ReadabilityCrossCutStats, LineageStats } from '@/lib/actions/guidance-documents';
import type { AnalyticsTabValue, AnalyticsSourceValue } from '@/lib/constants/values';
import { analyticsParsers, analyticsSourceParser } from '@/lib/url/parsers';
import { SegmentedControl } from '@/components/ui';
import type { SegmentedControlOption } from '@/components/ui';
import { AnalyticsTabs } from './AnalyticsTabs';
import { OverviewTab } from './OverviewTab';
import { IssuesTab } from './IssuesTab';
import { KeywordsTab } from './KeywordsTab';
import { DefinitionsTab } from './DefinitionsTab';
import { CrossReferencesTab } from './CrossReferencesTab';
import { StatutesTab } from './StatutesTab';
import { GuidanceAnalyticsTab } from './GuidanceAnalyticsTab';
import { PipelineTab } from './PipelineTab';

const SOURCE_OPTIONS: SegmentedControlOption<AnalyticsSourceValue>[] = [
  { value: 'all', label: 'All', icon: LayoutList },
  { value: 'regulations', label: 'Regulations', icon: ScrollText },
  { value: 'guidance', label: 'Guidance', icon: BookOpen },
];

export interface AnalyticsClientProps {
  jurisdiction: JurisdictionCode;
  dashboardStats: DashboardStats | null;
  sectionTypeStats: SectionTypeStats[] | null;
  metadataStats: MetadataStats | null;
  topKeywords: KeywordStats[] | null;
  topAppliesTo: AppliesToStats[] | null;
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
  guidanceReadabilityStats?: GuidanceReadabilityStats | null;
  guidanceReadabilityCrossCuts?: ReadabilityCrossCutStats | null;
  guidanceLineageStats?: LineageStats | null;
  complianceTypeClassification?: ComplianceTypeClassificationCounts | null;
}

export function AnalyticsClient({
  jurisdiction,
  dashboardStats,
  sectionTypeStats,
  metadataStats,
  topKeywords,
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
  guidanceReadabilityStats,
  guidanceReadabilityCrossCuts,
  guidanceLineageStats,
  complianceTypeClassification,
}: AnalyticsClientProps) {
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: true });
  const [source, setSource] = useQueryState('source', analyticsSourceParser.withOptions({ shallow: false }));
  const currentTab = params.tab;

  const handleTabChange = (tab: AnalyticsTabValue) => {
    setParams({ tab });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AnalyticsTabs activeTab={currentTab} onTabChange={handleTabChange} />
        <SegmentedControl
          options={SOURCE_OPTIONS}
          value={source}
          onChange={setSource}
          variant="filled"
          size="sm"
        />
      </div>

      <div className="mt-6">
        {currentTab === 'overview' && (
          <OverviewTab
            dashboardStats={dashboardStats}
            complianceStatus={complianceStatus}
            complianceTypeCounts={complianceTypeCounts}
            metadataStats={metadataStats}
            definitionsStats={definitionsStats}
            statuteStats={statuteStats}
            pipelineData={pipelineData}
            complianceSeverity={complianceSeverity}
            jenaiSeverity={jenaiSeverity}
            jenaiStats={jenaiStats}
            jurisdiction={jurisdiction}
            complianceTypeClassification={complianceTypeClassification ?? null}
            onNavigateToIssues={() => setParams({ tab: 'issues' })}
            activeSource={source}
          />
        )}

        {currentTab === 'issues' && (
          <IssuesTab
            complianceByType={complianceTypeCounts ?? {}}
            complianceStatus={complianceStatus}
            complianceTypeClassification={complianceTypeClassification ?? null}
            jurisdiction={jurisdiction}
            activeSource={source}
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
            readabilityStats={guidanceReadabilityStats ?? null}
            crossCutStats={guidanceReadabilityCrossCuts ?? null}
            lineageStats={guidanceLineageStats ?? null}
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
