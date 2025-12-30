'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField } from '@/components/ui';
import { reviewQueueParsers, type ReviewStatusValue, type SeverityValue } from '@/lib/url/parsers';
import { formatLabel } from '@/types/regulation';
import {
  REVIEW_STATUS_FILTER_OPTIONS,
  SEVERITY_FILTER_OPTIONS,
  REVIEW_SORT_OPTIONS,
} from '@/lib/constants/filters';

interface ReviewFiltersProps {
  categories: string[];
  className?: string;
}

export function ReviewFilters({
  categories,
  className = '',
}: ReviewFiltersProps) {
  const [filters, setFilters] = useQueryStates(reviewQueueParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      reviewStatus: 'unreviewed',
      severity: 'all',
      category: null,
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    (filters.severity && filters.severity !== 'all') ||
    filters.category
  );

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat, label: formatLabel(cat) }))
  ], [categories]);

  return (
    <FilterBar
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={REVIEW_SORT_OPTIONS}
      onSortByChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
      <FilterField label="Status">
        <Select
          value={filters.reviewStatus || 'unreviewed'}
          onValueChange={(value) => setFilters({ reviewStatus: value as ReviewStatusValue, page: 1 })}
          options={REVIEW_STATUS_FILTER_OPTIONS}
          aria-label="Filter by status"
        />
      </FilterField>

      <FilterField label="Severity">
        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters({ severity: value as SeverityValue, page: 1 })}
          options={SEVERITY_FILTER_OPTIONS}
          aria-label="Filter by severity"
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

export default ReviewFilters;
