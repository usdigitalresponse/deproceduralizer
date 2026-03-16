'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { BarChart3, List } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { ibrParsers } from '@/lib/url/parsers';
import type { IbrTabValue } from '@/lib/constants/values';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { IbrOverviewStats, IbrTopStandard } from '@/lib/actions/ibr';
import { IbrOverviewTab } from './IbrOverviewTab';
import { IbrBrowseTab } from './IbrBrowseTab';

const TAB_OPTIONS: SegmentedControlOption<IbrTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'browse', label: 'Browse', icon: List },
];

export interface IbrClientProps {
  jurisdiction: JurisdictionCode;
  stats: IbrOverviewStats | null;
  organizations: string[];
  topStandards: IbrTopStandard[] | null;
  flaggedDocCount?: number;
}

export function IbrClient({
  jurisdiction,
  stats,
  organizations,
  topStandards,
  flaggedDocCount,
}: IbrClientProps) {
  const [params, setParams] = useQueryStates(ibrParsers, { shallow: true });
  const currentTab = params.tab as IbrTabValue;

  const handleTabChange = (tab: IbrTabValue) => {
    setParams({ tab });
  };

  const handleOrgBarClick = useCallback((organization: string) => {
    setParams({ tab: 'browse' as IbrTabValue, sourceOrganization: organization, page: 1 }, { history: 'push' });
  }, [setParams]);

  const handleStandardClick = useCallback((search: string) => {
    setParams({ tab: 'browse' as IbrTabValue, search, sourceOrganization: null, page: 1 }, { history: 'push' });
  }, [setParams]);

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={currentTab}
        onChange={handleTabChange}
      />

      <div className="mt-6">
        {currentTab === 'overview' && (
          <IbrOverviewTab
            stats={stats}
            topStandards={topStandards}
            flaggedDocCount={flaggedDocCount}
            onOrgBarClick={handleOrgBarClick}
            onStandardClick={handleStandardClick}
          />
        )}

        {currentTab === 'browse' && (
          <IbrBrowseTab
            jurisdiction={jurisdiction}
            organizations={organizations}
          />
        )}
      </div>
    </div>
  );
}
