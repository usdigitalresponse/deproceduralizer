'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui';
import { REVIEW_TYPES, type ReviewType, type ReviewMode } from '@/types/regulation';

interface ReviewTypeTabsProps {
  activeType: ReviewType;
  counts: {
    flags: number;
    compliance: number;
    definitions: number;
    needs_info: number;
  };
  mode?: ReviewMode;
}

export function ReviewTypeTabs({ activeType, counts, mode = 'review' }: ReviewTypeTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (type: ReviewType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', type);
    // Reset to page 1 and default filters when switching tabs
    params.set('page', '1');
    params.delete('category');
    params.delete('issueType');
    params.delete('developerStatus');
    params.delete('developer');
    router.push(`${pathname}?${params.toString()}`);
  };

  const getCount = (type: ReviewType): number => {
    switch (type) {
      case 'flags':
        return counts.flags;
      case 'compliance':
        return counts.compliance;
      case 'definitions':
        return counts.definitions;
      case 'needs_info':
        return counts.needs_info;
      default:
        return 0;
    }
  };

  // In developer mode, show different tabs
  const tabsToShow = mode === 'developer'
    ? REVIEW_TYPES.filter(tab => tab.value === 'needs_info') // Only needs_info in dev mode (main view is combined)
    : REVIEW_TYPES;

  // If in developer mode and showing combined view, show all items tab differently
  if (mode === 'developer') {
    const isAllActive = activeType !== 'definitions' && activeType !== 'needs_info';
    const isDefinitionsActive = activeType === 'definitions';
    const isNeedsInfoActive = activeType === 'needs_info';

    return (
      <div className="flex gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] mb-4">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('type');
            params.set('page', '1');
            router.push(`${pathname}?${params.toString()}`);
          }}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isAllActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          Red Flags & Issues
          {(counts.flags + counts.compliance) > 0 && (
            <Badge
              variant={isAllActive ? 'info' : 'default'}
              className="text-xs"
            >
              {counts.flags + counts.compliance}
            </Badge>
          )}
        </button>
        <button
          onClick={() => handleTabChange('definitions')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isDefinitionsActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          Definitions
          {counts.definitions > 0 && (
            <Badge
              variant={isDefinitionsActive ? 'info' : 'default'}
              className="text-xs"
            >
              {counts.definitions}
            </Badge>
          )}
        </button>
        <button
          onClick={() => handleTabChange('needs_info')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
            transition-all duration-[var(--duration-fast)]
            ${
              isNeedsInfoActive
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
            }
          `}
        >
          Needs More Info
          {counts.needs_info > 0 && (
            <Badge
              variant={isNeedsInfoActive ? 'warning' : 'default'}
              className="text-xs"
            >
              {counts.needs_info}
            </Badge>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] mb-4">
      {REVIEW_TYPES.map((tab) => {
        const isActive = activeType === tab.value;
        const count = getCount(tab.value);

        return (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
              transition-all duration-[var(--duration-fast)]
              ${
                isActive
                  ? 'bg-white text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
              }
            `}
          >
            {tab.label}
            {count > 0 && (
              <Badge
                variant={isActive ? (tab.value === 'needs_info' ? 'warning' : 'info') : 'default'}
                className="text-xs"
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ReviewTypeTabs;
