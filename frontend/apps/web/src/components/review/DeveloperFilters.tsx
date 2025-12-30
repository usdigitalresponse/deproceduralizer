'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField } from '@/components/ui';
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
  const [filters, setFilters] = useQueryStates(developerQueueParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned
  );

  return (
    <FilterBar
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={SORT_OPTIONS}
      onSortByChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
      <FilterField label="Status">
        <Select
          value={filters.developerStatus || 'all'}
          onValueChange={(value) => setFilters({ developerStatus: value as any, page: 1 })}
          options={DEV_STATUS_OPTIONS}
          aria-label="Filter by developer status"
        />
      </FilterField>

      <FilterField label="Developer">
        <Select
          value={filters.developerAssigned || 'all'}
          onValueChange={(value) => setFilters({ developerAssigned: value === 'all' ? null : value, page: 1 })}
          options={DEVELOPER_OPTIONS}
          aria-label="Filter by developer"
        />
      </FilterField>
    </FilterBar>
  );
}

export default DeveloperFilters;
