'use client';

import { useQueryStates } from 'nuqs';
import { BarChart3, List } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { finesParsers } from '@/lib/url/parsers';
import type { FinesTabValue } from '@/lib/constants/values';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { FinesOverviewStats, AgencyOption } from '@/lib/actions/fines';
import { FinesOverviewTab } from './FinesOverviewTab';
import { FinesBrowseTab } from './FinesBrowseTab';

const TAB_OPTIONS: SegmentedControlOption<FinesTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'browse', label: 'Browse', icon: List },
];

export interface FinesClientProps {
  jurisdiction: JurisdictionCode;
  stats: FinesOverviewStats | null;
  agencies: AgencyOption[];
  whoPaysValues: string[];
  perUnitValues: string[];
}

export function FinesClient({
  jurisdiction,
  stats,
  agencies,
  whoPaysValues,
  perUnitValues,
}: FinesClientProps) {
  const [params, setParams] = useQueryStates(finesParsers, { shallow: true });
  const currentTab = params.tab as FinesTabValue;

  const handleTabChange = (tab: FinesTabValue) => {
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
          <FinesOverviewTab stats={stats} />
        )}

        {currentTab === 'browse' && (
          <FinesBrowseTab
            jurisdiction={jurisdiction}
            agencies={agencies}
            whoPaysValues={whoPaysValues}
            perUnitValues={perUnitValues}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
}
