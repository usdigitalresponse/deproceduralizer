'use client';

import dynamic from 'next/dynamic';
import { useQueryStates } from 'nuqs';
import { BarChart3, GitBranch, TrendingUp, BookOpen } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { tagsParsers } from '@/lib/url/parsers';
import { TAGS_TAB_LABELS, type TagsTabValue } from '@/lib/constants/tags';
import type { JurisdictionCode, TagOverviewStats } from '@deproceduralizer/database';
import { TagsOverviewTab } from './TagsOverviewTab';

const TagsConnectionsTab = dynamic(
  () => import('./TagsConnectionsTab').then(m => ({ default: m.TagsConnectionsTab })),
);
const TagsCorrelationsTab = dynamic(
  () => import('./TagsCorrelationsTab').then(m => ({ default: m.TagsCorrelationsTab })),
);
const TagsReadabilityTab = dynamic(
  () => import('./TagsReadabilityTab').then(m => ({ default: m.TagsReadabilityTab })),
);

const TAB_OPTIONS: SegmentedControlOption<TagsTabValue>[] = [
  { value: 'overview', label: TAGS_TAB_LABELS.overview, icon: BarChart3 },
  { value: 'connections', label: TAGS_TAB_LABELS.connections, icon: GitBranch },
  { value: 'correlations', label: TAGS_TAB_LABELS.correlations, icon: TrendingUp },
  { value: 'readability', label: TAGS_TAB_LABELS.readability, icon: BookOpen },
];

export interface TagsClientProps {
  jurisdiction: JurisdictionCode;
  overview: TagOverviewStats | null;
}

export function TagsClient({ jurisdiction, overview }: TagsClientProps) {
  const [params, setParams] = useQueryStates(tagsParsers, { shallow: true });
  const currentTab = params.tab as TagsTabValue;

  const handleTabChange = (tab: TagsTabValue) => {
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
          <TagsOverviewTab overview={overview} jurisdiction={jurisdiction} />
        )}

        {currentTab === 'connections' && (
          <TagsConnectionsTab jurisdiction={jurisdiction} />
        )}

        {currentTab === 'correlations' && (
          <TagsCorrelationsTab jurisdiction={jurisdiction} />
        )}

        {currentTab === 'readability' && (
          <TagsReadabilityTab jurisdiction={jurisdiction} />
        )}
      </div>
    </div>
  );
}
