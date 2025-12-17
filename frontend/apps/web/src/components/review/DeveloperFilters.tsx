'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { getStateFromPathname } from '@/hooks';
import { DEVELOPER_STATUSES, DEVELOPERS } from '@/types/regulation';

interface DeveloperFiltersProps {
  currentDeveloperStatus?: string;
  currentDeveloperAssigned?: string;
  sortBy: string;
  sortOrder: string;
  className?: string;
}

const DEV_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  ...DEVELOPER_STATUSES,
];

const DEVELOPER_OPTIONS = [
  { value: 'all', label: 'All Developers' },
  ...DEVELOPERS,
];

const SORT_OPTIONS = [
  { value: 'reviewedAt', label: 'Review Date' },
  { value: 'developerCheckedAt', label: 'Last Updated' },
];

export function DeveloperFilters({
  currentDeveloperStatus = 'all',
  currentDeveloperAssigned = 'all',
  sortBy,
  sortOrder,
  className = '',
}: DeveloperFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change
      params.set('page', '1');

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.push(`/${state}/review?${params.toString()}`);
    },
    [router, searchParams, state]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    params.set('mode', 'developer');
    router.push(`/${state}/review?${params.toString()}`);
  }, [router, state]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (currentDeveloperStatus && currentDeveloperStatus !== 'all') ||
    (currentDeveloperAssigned && currentDeveloperAssigned !== 'all');

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Developer Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Status:
        </label>
        <Select
          value={currentDeveloperStatus || 'all'}
          onValueChange={(value) => updateParams({ developerStatus: value })}
          options={DEV_STATUS_OPTIONS}
          aria-label="Filter by developer status"
        />
      </div>

      {/* Developer Assigned filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Developer:
        </label>
        <Select
          value={currentDeveloperAssigned || 'all'}
          onValueChange={(value) => updateParams({ developer: value })}
          options={DEVELOPER_OPTIONS}
          aria-label="Filter by developer"
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Sort by:
        </label>
        <Select
          value={sortBy}
          onValueChange={(value) => updateParams({ sortBy: value })}
          options={SORT_OPTIONS}
          aria-label="Sort by"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => updateParams({ sortOrder: sortOrder === 'desc' ? 'asc' : 'desc' })}
          aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
        >
          {sortOrder === 'desc' ? '↓' : '↑'}
        </Button>
      </div>
    </div>
  );
}

export default DeveloperFilters;
