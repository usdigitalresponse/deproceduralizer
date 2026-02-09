'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField } from '@/components/ui';
import { DEVELOPER_STATUSES, DEVELOPERS, REVIEW_STATUSES } from '@/types/regulation';
import { redFlagDeveloperQueueParsers, type RedFlagDeveloperSortByValue, type DeveloperStatusValue, type SeverityValue, type ReviewStatusValue } from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import { SEVERITY_FILTER_OPTIONS, RED_FLAG_DEVELOPER_SORT_OPTIONS } from '@/lib/constants/filters';

interface RedFlagDeveloperFiltersProps {
  categories: string[];
  className?: string;
}

const DEV_STATUS_OPTIONS = [
  { value: 'all', label: 'All Dev Statuses' },
  ...DEVELOPER_STATUSES,
];

const DEVELOPER_OPTIONS = [
  { value: 'all', label: 'All Developers' },
  ...DEVELOPERS,
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'all', label: 'All Review Statuses' },
  ...REVIEW_STATUSES.filter(s => s.value !== 'unreviewed'),
];


export function RedFlagDeveloperFilters({
  categories,
  className = '',
}: RedFlagDeveloperFiltersProps) {
  const [filters, setFilters] = useQueryStates(redFlagDeveloperQueueParsers, {
    shallow: false,
  });

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat, label: cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })),
  ];

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      severity: 'all',
      reviewStatus: 'all',
      category: null,
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.reviewStatus && filters.reviewStatus !== 'all') ||
    filters.category
  );

  return (
    <FilterBar
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={RED_FLAG_DEVELOPER_SORT_OPTIONS}
      onSortByChange={typedValue<RedFlagDeveloperSortByValue>((value) => setFilters({ sortBy: value, page: 1 }))}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
      <FilterField label="Dev Status">
        <Select
          value={filters.developerStatus || 'all'}
          onValueChange={typedValue<DeveloperStatusValue>((value) => setFilters({ developerStatus: value, page: 1 }))}
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

      <FilterField label="Severity">
        <Select
          value={filters.severity || 'all'}
          onValueChange={typedValue<SeverityValue>((value) => setFilters({ severity: value, page: 1 }))}
          options={SEVERITY_FILTER_OPTIONS}
          aria-label="Filter by severity"
        />
      </FilterField>

      <FilterField label="Review">
        <Select
          value={filters.reviewStatus || 'all'}
          onValueChange={typedValue<ReviewStatusValue>((value) => setFilters({ reviewStatus: value, page: 1 }))}
          options={REVIEW_STATUS_OPTIONS}
          aria-label="Filter by review status"
        />
      </FilterField>

      <FilterField label="Category">
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => setFilters({ category: value === 'all' ? null : value, page: 1 })}
          options={categoryOptions}
          aria-label="Filter by category"
        />
      </FilterField>
    </FilterBar>
  );
}

export default RedFlagDeveloperFilters;
