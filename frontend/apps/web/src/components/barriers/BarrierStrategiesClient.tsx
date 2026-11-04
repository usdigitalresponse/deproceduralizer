'use client';

import { useQueryStates } from 'nuqs';
import { BarChart3, GitCompare, BookOpen, Zap, Layers, ClipboardList, Award } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { barrierStrategyParsers } from '@/lib/url/parsers';
import type { BarrierStrategyTabValue } from '@/lib/constants/values';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { BarrierStrategyStats, StrategyKey, TournamentResults } from '@/lib/actions/barrier-strategies';
import { BarrierOverviewTab } from './BarrierOverviewTab';
import { BarrierCompareTab } from './BarrierCompareTab';
import { BarrierBrowseTab } from './BarrierBrowseTab';
import { BarrierRecommendationsTab } from './BarrierRecommendationsTab';
const TAB_OPTIONS: SegmentedControlOption<BarrierStrategyTabValue>[] = [
  { value: 'recommendations', label: 'Recommendations', icon: Award },
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'compare', label: 'Compare', icon: GitCompare },
  { value: 'best-stories', label: 'Best Stories', icon: BookOpen },
  { value: 'surprises', label: 'Surprises', icon: Zap },
  { value: 'framework', label: 'Core Framework', icon: Layers },
  { value: 'action-plan', label: 'Action Plan', icon: ClipboardList },
];

export interface BarrierStrategiesClientProps {
  jurisdiction: JurisdictionCode;
  stats: BarrierStrategyStats | null;
  tournamentResults: TournamentResults | null;

}

export function BarrierStrategiesClient({
  jurisdiction,
  stats,
  tournamentResults,
}: BarrierStrategiesClientProps) {
  const [params, setParams] = useQueryStates(barrierStrategyParsers, { shallow: true });
  const currentTab = params.tab as BarrierStrategyTabValue;

  const handleTabChange = (tab: BarrierStrategyTabValue) => {
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
          <BarrierRecommendationsTab results={tournamentResults} />
        )}

        {currentTab === 'overview' && (
          <BarrierOverviewTab stats={stats} />
        )}

        {currentTab === 'compare' && (
          <BarrierCompareTab stats={stats} />
        )}

        {isStrategyTab && strategyKey && (
          <BarrierBrowseTab
            jurisdiction={jurisdiction}
            strategy={strategyKey}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
}
