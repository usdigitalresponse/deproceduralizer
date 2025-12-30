'use client';

import { BarChart3, AlertTriangle, Tag, BookOpen, Link2 } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import type { AnalyticsTabValue } from '@/lib/constants/values';

interface AnalyticsTabsProps {
  activeTab: AnalyticsTabValue;
  onTabChange: (tab: AnalyticsTabValue) => void;
}

const TABS: SegmentedControlOption<AnalyticsTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'crossrefs', label: 'Cross-References', icon: Link2 },
  { value: 'issues', label: 'Issues', icon: AlertTriangle },
  { value: 'keywords', label: 'Keywords', icon: Tag },
  { value: 'definitions', label: 'Definitions', icon: BookOpen },
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
