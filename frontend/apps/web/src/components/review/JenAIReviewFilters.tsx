'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, MultiSelect, FilterBar, FilterField } from '@/components/ui';
import {
  jenaiReviewQueueParsers,
  parseCommaSeparated,
  serializeCommaSeparated,
  type ReviewStatusValue,
  type JenAIReviewSortByValue,
  type JenAISourceValue,
} from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import {
  REVIEW_STATUS_FILTER_OPTIONS,
  SEVERITY_MULTISELECT_OPTIONS,
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

  const selectedCategories = useMemo(() => parseCommaSeparated(filters.category), [filters.category]);
  const selectedSeverities = useMemo(() => parseCommaSeparated(filters.severity), [filters.severity]);

  const clearFilters = useCallback(() => {
    setFilters({
      reviewStatus: 'unreviewed',
      severity: null,
      category: null,
      source: 'all',
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    filters.severity ||
    (filters.source && filters.source !== 'all') ||
    filters.category
  );

  const categoryOptions = useMemo(() =>
    categories.map(cat => ({
      value: cat.category,
      label: `${JENAI_CATEGORY_LABELS[cat.category] || formatLabel(cat.category)} (${cat.count})`,
    })),
  [categories]);

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
        <MultiSelect
          label="Severity"
          value={selectedSeverities}
          onChange={(values) => setFilters({ severity: serializeCommaSeparated(values), page: 1 })}
          options={SEVERITY_MULTISELECT_OPTIONS}
          placeholder="All Severities"
          aria-label="Filter by severity"
        />
      </FilterField>

      <FilterField label="Category">
        <MultiSelect
          label="Category"
          value={selectedCategories}
          onChange={(values) => setFilters({ category: serializeCommaSeparated(values), page: 1 })}
          options={categoryOptions}
          placeholder="All Categories"
          aria-label="Filter by category"
        />
      </FilterField>
    </FilterBar>
  );
}
