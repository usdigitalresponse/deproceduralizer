'use client';

import { BarChart3, Tag, GitBranch } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import type { AnalyticsTabValue } from '@/lib/constants/values';

interface AnalyticsTabsProps {
  activeTab: AnalyticsTabValue;
  onTabChange: (tab: AnalyticsTabValue) => void;
}

const TABS: SegmentedControlOption<AnalyticsTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'crossrefs', label: 'Cross-References', icon: getEntityIcon('cross_reference') },
  { value: 'issues', label: 'Issues', icon: getEntityIcon('compliance_issue') },
  { value: 'keywords', label: 'Keywords', icon: Tag },
  { value: 'definitions', label: 'Definitions', icon: getEntityIcon('definition') },
  { value: 'statutes', label: 'Statutes', icon: getEntityIcon('statute') },
  { value: 'guidance', label: 'Guidance', icon: getEntityIcon('guidance_document') },
  { value: 'pipeline', label: 'Pipeline', icon: GitBranch },
];

export function AnalyticsTabs({ activeTab, onTabChange }: AnalyticsTabsProps) {
  return (
    <SegmentedControl
      options={TABS}
      value={activeTab}
      onChange={onTabChange}
      variant="filled"
    />
  );
}
