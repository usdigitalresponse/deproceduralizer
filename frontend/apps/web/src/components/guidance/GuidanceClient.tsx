'use client';

import { useQueryStates } from 'nuqs';
import { BarChart3, List } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { guidanceTabParser } from '@/lib/url/parsers';
import type { GuidanceTabValue } from '@/lib/constants/values';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { GuidanceOverviewStats, LineageStats } from '@/lib/actions/guidance-documents';
import { GuidanceOverviewTab } from './GuidanceOverviewTab';
import { GuidanceBrowseTab } from './GuidanceBrowseTab';

const TAB_OPTIONS: SegmentedControlOption<GuidanceTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'browse', label: 'Browse', icon: List },
];

export interface GuidanceClientProps {
  jurisdiction: JurisdictionCode;
  stats: GuidanceOverviewStats | null;
  lineageStats: LineageStats | null;
  agencies: string[];
  docTypes: string[];
}

export function GuidanceClient({
  jurisdiction,
  stats,
  lineageStats,
  agencies,
  docTypes,
}: GuidanceClientProps) {
  const [{ tab: currentTab }, setParams] = useQueryStates(
    { tab: guidanceTabParser },
    { shallow: true }
  );

  const handleTabChange = (tab: GuidanceTabValue) => {
    setParams({ tab });
  };

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={currentTab}
        onChange={handleTabChange}
      />

      <div className="mt-6">
        {currentTab === 'overview' && (
          <GuidanceOverviewTab stats={stats} lineageStats={lineageStats} jurisdiction={jurisdiction} />
        )}

        {currentTab === 'browse' && (
          <GuidanceBrowseTab
            jurisdiction={jurisdiction}
            agencies={agencies}
            docTypes={docTypes}
          />
        )}
      </div>
    </div>
  );
}
