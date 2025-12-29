'use client';

import { BarChart3, Network, AlertTriangle, Tag } from 'lucide-react';
import type { AnalyticsTabValue } from '@/lib/constants/values';

interface AnalyticsTabsProps {
  activeTab: AnalyticsTabValue;
  onTabChange: (tab: AnalyticsTabValue) => void;
}

const TABS: { value: AnalyticsTabValue; label: string; icon: React.ElementType }[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'hierarchy', label: 'Hierarchy', icon: Network },
  { value: 'issues', label: 'Issues', icon: AlertTriangle },
  { value: 'keywords', label: 'Keywords', icon: Tag },
];

export function AnalyticsTabs({ activeTab, onTabChange }: AnalyticsTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] w-fit">
      {TABS.map(({ value, label, icon: Icon }) => {
        const isActive = activeTab === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onTabChange(value)}
            className={`
              flex items-center gap-2 px-4 py-2
              text-sm font-medium
              rounded-[var(--radius-md)]
              transition-all duration-[var(--duration-fast)]
              ${
                isActive
                  ? 'bg-white text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
              }
            `
              .trim()
              .replace(/\s+/g, ' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
