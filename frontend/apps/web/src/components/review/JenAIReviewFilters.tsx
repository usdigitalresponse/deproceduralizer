'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField } from '@/components/ui';
import {
  jenaiReviewQueueParsers,
  type ReviewStatusValue,
  type SeverityValue,
  type JenAIReviewSortByValue,
  type JenAISourceValue,
} from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import {
  REVIEW_STATUS_FILTER_OPTIONS,
  SEVERITY_FILTER_OPTIONS,
  JENAI_REVIEW_SORT_OPTIONS,
  JENAI_SOURCE_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { formatLabel } from '@/types/regulation';

interface JenAIReviewFiltersProps {
  categories: { category: string; count: number }[];
  className?: string;
}

export function JenAIReviewFilters({
  categories,
  className = '',
}: JenAIReviewFiltersProps) {
  const [filters, setFilters] = useQueryStates(jenaiReviewQueueParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      reviewStatus: 'unreviewed',
      severity: 'all',
      category: null,
      source: 'all',
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.source && filters.source !== 'all') ||
    filters.category
  );

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map(cat => ({
      value: cat.category,
      label: `${JENAI_CATEGORY_LABELS[cat.category] || formatLabel(cat.category)} (${cat.count})`,
    })),
  ], [categories]);

  return (
    <FilterBar
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={JENAI_REVIEW_SORT_OPTIONS}
      onSortByChange={typedValue<JenAIReviewSortByValue>((value) => setFilters({ sortBy: value, page: 1 }))}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
      <FilterField label="Source">
        <Select
          value={filters.source || 'all'}
          onValueChange={typedValue<JenAISourceValue>((value) => setFilters({ source: value, page: 1 }))}
          options={JENAI_SOURCE_FILTER_OPTIONS}
          aria-label="Filter by source"
        />
      </FilterField>

      <FilterField label="Status">
        <Select
          value={filters.reviewStatus || 'unreviewed'}
          onValueChange={typedValue<ReviewStatusValue>((value) => setFilters({ reviewStatus: value, page: 1 }))}
          options={REVIEW_STATUS_FILTER_OPTIONS}
          aria-label="Filter by status"
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
