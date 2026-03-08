'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, MultiSelect, FilterBar, FilterField } from '@/components/ui';
import { DEVELOPER_STATUSES, DEVELOPERS } from '@/types/regulation';
import {
  jenaiDeveloperQueueParsers,
  parseCommaSeparated,
  serializeCommaSeparated,
  type JenAIDeveloperSortByValue,
  type DeveloperStatusValue,
  type JenAISourceValue,
} from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import {
  SEVERITY_MULTISELECT_OPTIONS,
  JENAI_DEVELOPER_SORT_OPTIONS,
  JENAI_SOURCE_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { formatLabel } from '@/types/regulation';

interface JenAIDeveloperFiltersProps {
  categories: { category: string; count: number }[];
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

export function JenAIDeveloperFilters({
  categories,
  className = '',
}: JenAIDeveloperFiltersProps) {
  const [filters, setFilters] = useQueryStates(jenaiDeveloperQueueParsers, {
    shallow: false,
  });

  const selectedCategories = useMemo(() => parseCommaSeparated(filters.category), [filters.category]);
  const selectedSeverities = useMemo(() => parseCommaSeparated(filters.severity), [filters.severity]);

  const categoryOptions = useMemo(() =>
    categories.map(cat => ({
      value: cat.category,
      label: `${JENAI_CATEGORY_LABELS[cat.category] || formatLabel(cat.category)} (${cat.count})`,
    })),
  [categories]);

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      severity: null,
      category: null,
      source: 'all',
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned ||
    filters.severity ||
    (filters.source && filters.source !== 'all') ||
    filters.category
  );

  return (
    <FilterBar
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={JENAI_DEVELOPER_SORT_OPTIONS}
      onSortByChange={typedValue<JenAIDeveloperSortByValue>((value) => setFilters({ sortBy: value, page: 1 }))}
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
