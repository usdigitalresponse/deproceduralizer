'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui';
import { REVIEW_TYPES, type ReviewType } from '@/types/regulation';

interface ReviewTypeTabsProps {
  activeType: ReviewType;
  counts: {
    flags: number;
    compliance: number;
  };
}

export function ReviewTypeTabs({ activeType, counts }: ReviewTypeTabsProps) {
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
    router.push(`${pathname}?${params.toString()}`);
  };

  const getCount = (type: ReviewType): number => {
    switch (type) {
      case 'flags':
        return counts.flags;
      case 'compliance':
        return counts.compliance;
      case 'all':
        return counts.flags + counts.compliance;
    }
  };

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
                variant={isActive ? 'info' : 'default'}
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
