'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, MultiSelect, FilterBar, FilterField, SearchInput } from '@/components/ui';
import { DEVELOPER_STATUSES, DEVELOPERS } from '@/types/regulation';
import {
  jenaiDeveloperQueueParsers,
  parseCommaSeparated,
  serializeCommaSeparated,
  type JenAIDeveloperSortByValue,
  type DeveloperStatusValue,
  type JenAISourceValue,
  type JenAIVerbatimValue,
} from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import {
  SEVERITY_MULTISELECT_OPTIONS,
  JENAI_DEVELOPER_SORT_OPTIONS,
  JENAI_SOURCE_FILTER_OPTIONS,
  COMPLEXITY_MULTISELECT_OPTIONS,
  JENAI_VERBATIM_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { formatLabel } from '@/types/regulation';

interface JenAIDeveloperFiltersProps {
  categories: { category: string; count: number }[];
  parts: { part: string; partName: string | null; count: number }[];
  sectionTypes: { sectionType: string; count: number }[];
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
  parts,
  sectionTypes,
  className = '',
}: JenAIDeveloperFiltersProps) {
  const [filters, setFilters] = useQueryStates(jenaiDeveloperQueueParsers);

  const selectedCategories = useMemo(() => parseCommaSeparated(filters.category), [filters.category]);
  const selectedSeverities = useMemo(() => parseCommaSeparated(filters.severity), [filters.severity]);
  const selectedParts = useMemo(() => parseCommaSeparated(filters.part), [filters.part]);
  const selectedSectionTypes = useMemo(() => parseCommaSeparated(filters.sectionType), [filters.sectionType]);
  const selectedComplexities = useMemo(() => parseCommaSeparated(filters.complexity), [filters.complexity]);

  const categoryOptions = useMemo(() =>
    categories.map(cat => ({
      value: cat.category,
      label: JENAI_CATEGORY_LABELS[cat.category] || formatLabel(cat.category),
      count: cat.count,
    })),
  [categories]);

  const partOptions = useMemo(() =>
    parts.map(p => ({
      value: p.part,
      label: p.partName
        ? `${p.partName} (Part ${p.part})`
        : `Part ${p.part}`,
      count: p.count,
    })),
  [parts]);

  const sectionTypeOptions = useMemo(() =>
    sectionTypes.map(st => ({
      value: st.sectionType,
      label: formatLabel(st.sectionType),
      count: st.count,
    })),
  [sectionTypes]);

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      severity: null,
      category: null,
      source: 'all',
      part: null,
      sectionType: null,
      search: null,
      complexity: null,
      verbatim: 'all',
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned ||
    filters.severity ||
    (filters.source && filters.source !== 'all') ||
    filters.category ||
    filters.part ||
    filters.sectionType ||
    filters.search ||
    filters.complexity ||
    (filters.verbatim && filters.verbatim !== 'all')
  );

  const isGuidanceOnly = filters.source === 'guidance';

  return (
    <FilterBar
      variant="panel"
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
      <FilterField label="Search">
        <SearchInput
          value={filters.search || ''}
          onSearch={(value) => setFilters({ search: value || null, page: 1 })}
          placeholder="Search topics..."
          size="sm"
          aria-label="Search JenAI issues"
        />
      </FilterField>

      <FilterField label="Source">
        <Select
          value={filters.source || 'all'}
          onValueChange={typedValue<JenAISourceValue>((value) => setFilters({ source: value, part: null, sectionType: null, page: 1 }))}
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

      <FilterField label="Complexity">
        <MultiSelect
          label="Complexity"
          value={selectedComplexities}
          onChange={(values) => setFilters({ complexity: serializeCommaSeparated(values), page: 1 })}
          options={COMPLEXITY_MULTISELECT_OPTIONS}
          placeholder="All Complexities"
          aria-label="Filter by complexity"
        />
      </FilterField>

      <FilterField label="Verbatim">
        <Select
          value={filters.verbatim || 'all'}
          onValueChange={typedValue<JenAIVerbatimValue>((value) => setFilters({ verbatim: value, page: 1 }))}
          options={JENAI_VERBATIM_FILTER_OPTIONS}
          aria-label="Filter by verbatim"
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

      {!isGuidanceOnly && partOptions.length > 0 && (
        <FilterField label="Part">
          <MultiSelect
            label="Part"
            value={selectedParts}
            onChange={(values) => setFilters({ part: serializeCommaSeparated(values), page: 1 })}
            options={partOptions}
            placeholder="All Parts"
            searchable
            aria-label="Filter by part"
          />
        </FilterField>
      )}

      {!isGuidanceOnly && sectionTypeOptions.length > 0 && (
        <FilterField label="Section Type">
          <MultiSelect
            label="Section Type"
            value={selectedSectionTypes}
            onChange={(values) => setFilters({ sectionType: serializeCommaSeparated(values), page: 1 })}
            options={sectionTypeOptions}
            placeholder="All Section Types"
            aria-label="Filter by section type"
          />
        </FilterField>
      )}
    </FilterBar>
  );
}
