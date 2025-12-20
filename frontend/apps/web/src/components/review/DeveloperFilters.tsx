'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { getStateFromPathname } from '@/hooks';
import { DEVELOPER_STATUSES, DEVELOPERS } from '@/types/regulation';
import { developerQueueParsers } from '@/lib/url/parsers';

interface DeveloperFiltersProps {
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
  className = '',
}: DeveloperFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useQueryStates(developerQueueParsers, {
    shallow: false,
  });

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Developer Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Status:
        </label>
        <Select
          value={filters.developerStatus || 'all'}
          onValueChange={(value) => setFilters({ developerStatus: value as any, page: 1 })}
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
          value={filters.developerAssigned || 'all'}
          onValueChange={(value) => setFilters({ developerAssigned: value === 'all' ? null : value, page: 1 })}
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
          value={filters.sortBy}
          onValueChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
          options={SORT_OPTIONS}
          aria-label="Sort by"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
          aria-label={`Sort ${filters.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
        >
          {filters.sortOrder === 'desc' ? '↓' : '↑'}
        </Button>
      </div>
    </div>
  );
}

export default DeveloperFilters;
