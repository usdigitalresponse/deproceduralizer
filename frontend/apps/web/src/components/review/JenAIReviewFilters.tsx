'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, MultiSelect, FilterBar, FilterField, SearchInput } from '@/components/ui';
import {
  jenaiReviewQueueParsers,
  parseCommaSeparated,
  serializeCommaSeparated,
  type ReviewStatusValue,
  type JenAIReviewSortByValue,
  type JenAISourceValue,
  type JenAIVerbatimValue,
} from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import {
  REVIEW_STATUS_FILTER_OPTIONS,
  SEVERITY_MULTISELECT_OPTIONS,
  JENAI_REVIEW_SORT_OPTIONS,
  JENAI_SOURCE_FILTER_OPTIONS,
  COMPLEXITY_MULTISELECT_OPTIONS,
  JENAI_VERBATIM_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { formatLabel } from '@/types/regulation';

interface JenAIReviewFiltersProps {
  categories: { category: string; count: number }[];
  parts: { part: string; partName: string | null; count: number }[];
  sectionTypes: { sectionType: string; count: number }[];
  className?: string;
}

export function JenAIReviewFilters({
  categories,
  parts,
  sectionTypes,
  className = '',
}: JenAIReviewFiltersProps) {
  const [filters, setFilters] = useQueryStates(jenaiReviewQueueParsers);

  const selectedCategories = useMemo(() => parseCommaSeparated(filters.category), [filters.category]);
  const selectedSeverities = useMemo(() => parseCommaSeparated(filters.severity), [filters.severity]);
  const selectedParts = useMemo(() => parseCommaSeparated(filters.part), [filters.part]);
  const selectedSectionTypes = useMemo(() => parseCommaSeparated(filters.sectionType), [filters.sectionType]);
  const selectedComplexities = useMemo(() => parseCommaSeparated(filters.complexity), [filters.complexity]);

  const clearFilters = useCallback(() => {
    setFilters({
      reviewStatus: 'unreviewed',
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
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    filters.severity ||
    (filters.source && filters.source !== 'all') ||
    filters.category ||
    filters.part ||
    filters.sectionType ||
    filters.search ||
    filters.complexity ||
    (filters.verbatim && filters.verbatim !== 'all')
  );

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

  const isGuidanceOnly = filters.source === 'guidance';

  return (
    <FilterBar
      variant="panel"
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
