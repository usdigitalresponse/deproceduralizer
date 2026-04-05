'use client';

import { useQueryStates } from 'nuqs';
import { BarChart3, GitCompare, BookOpen, Zap, Layers, ClipboardList, Award } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { jenaiStrategyParsers } from '@/lib/url/parsers';
import type { JenAIStrategyTabValue } from '@/lib/constants/values';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { JenAIStrategyStats, StrategyKey, TournamentResults } from '@/lib/actions/jenai-strategies';
import { JenAIOverviewTab } from './JenAIOverviewTab';
import { JenAICompareTab } from './JenAICompareTab';
import { JenAIBrowseTab } from './JenAIBrowseTab';
import { JenAIRecommendationsTab } from './JenAIRecommendationsTab';
const TAB_OPTIONS: SegmentedControlOption<JenAIStrategyTabValue>[] = [
  { value: 'recommendations', label: 'Recommendations', icon: Award },
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'compare', label: 'Compare', icon: GitCompare },
  { value: 'best-stories', label: 'Best Stories', icon: BookOpen },
  { value: 'surprises', label: 'Surprises', icon: Zap },
  { value: 'pahlka', label: 'Pahlka Framework', icon: Layers },
  { value: 'action-plan', label: 'Action Plan', icon: ClipboardList },
];

export interface JenAIStrategiesClientProps {
  jurisdiction: JurisdictionCode;
  stats: JenAIStrategyStats | null;
  tournamentResults: TournamentResults | null;

}

export function JenAIStrategiesClient({
  jurisdiction,
  stats,
  tournamentResults,
}: JenAIStrategiesClientProps) {
  const [params, setParams] = useQueryStates(jenaiStrategyParsers, { shallow: true });
  const currentTab = params.tab as JenAIStrategyTabValue;

  const handleTabChange = (tab: JenAIStrategyTabValue) => {
    setParams({ tab, page: 1 });
  };

  const isStrategyTab = currentTab !== 'overview' && currentTab !== 'compare' && currentTab !== 'recommendations';
  const strategyKey = isStrategyTab ? (currentTab as StrategyKey) : undefined;

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={currentTab}
        onChange={handleTabChange}
      />

      <div className="mt-6">
        {currentTab === 'recommendations' && (
          <JenAIRecommendationsTab results={tournamentResults} />
        )}

        {currentTab === 'overview' && (
          <JenAIOverviewTab stats={stats} />
        )}

        {currentTab === 'compare' && (
          <JenAICompareTab stats={stats} />
        )}

        {isStrategyTab && strategyKey && (
          <JenAIBrowseTab
            jurisdiction={jurisdiction}
            strategy={strategyKey}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
}
