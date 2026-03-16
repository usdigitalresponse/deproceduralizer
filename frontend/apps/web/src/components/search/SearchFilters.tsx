'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField, MultiSelect } from '@/components/ui';
import { searchResultsParsers, parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/parsers';
import {
  SEARCH_DOC_TYPE_OPTIONS,
  SEARCH_CLASSIFICATION_OPTIONS,
  SEARCH_ISSUE_SYSTEM_OPTIONS,
  SEVERITY_MULTISELECT_OPTIONS,
  ISSUE_TYPE_MULTISELECT_OPTIONS,
  JENAI_CATEGORY_MULTISELECT_OPTIONS,
} from '@/lib/constants/filters';
import type { SearchFilterOptions } from '@deproceduralizer/database';

/** Capitalize first letter of each word for display labels */
function toLabel(value: string): string {
  return value.replace(/\b\w/g, c => c.toUpperCase());
}

interface SearchFiltersProps {
  className?: string;
  filterOptions?: SearchFilterOptions;
}

export function SearchFilters({ className = '', filterOptions }: SearchFiltersProps) {
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(searchResultsParsers, {
    shallow: false,
  });

  const issueSystem = filters.issueSystem || null;

  const hasActiveFilters = Boolean(
    filters.docType ||
    filters.sectionType ||
    filters.hierarchyLevel ||
    filters.issueSystem ||
    filters.issueType ||
    filters.issueCategory ||
    filters.issueSeverity ||
    filters.classification
  );

  const clearFilters = useCallback(() => {
    setFilters({
      docType: null,
      sectionType: null,
      hierarchyLevel: null,
      issueSystem: null,
      issueType: null,
      issueCategory: null,
      issueSeverity: null,
      classification: null,
      page: 1,
    });
    router.refresh();
  }, [setFilters, router]);

  const updateFilter = useCallback((updates: Record<string, string | number | null>) => {
    setFilters({ ...updates, page: 1 });
    router.refresh();
  }, [setFilters, router]);

  // When the issue system changes, clear all sub-filters
  const handleIssueSystemChange = useCallback((value: string) => {
    setFilters({
      issueSystem: value === 'all' ? null : value,
      issueType: null,
      issueCategory: null,
      issueSeverity: null,
      classification: null,
      page: 1,
    });
    router.refresh();
  }, [setFilters, router]);

  // Multi-select value helpers
  const issueTypeValues = useMemo(() => parseCommaSeparated(filters.issueType), [filters.issueType]);
  const issueCategoryValues = useMemo(() => parseCommaSeparated(filters.issueCategory), [filters.issueCategory]);
  const issueSeverityValues = useMemo(() => parseCommaSeparated(filters.issueSeverity), [filters.issueSeverity]);

  // Build dynamic dropdown options from server-provided filter values
  const sectionTypeOptions = useMemo(() => {
    if (!filterOptions?.sectionTypes?.length) {
      return [{ value: 'all', label: 'All section types' }];
    }
    return [
      { value: 'all', label: 'All section types' },
      ...filterOptions.sectionTypes.map(v => ({ value: v, label: toLabel(v) })),
    ];
  }, [filterOptions?.sectionTypes]);

  const hierarchyLevelOptions = useMemo(() => {
    if (!filterOptions?.hierarchyLevels?.length) {
      return [{ value: 'all', label: 'All levels' }];
    }
    return [
      { value: 'all', label: 'All levels' },
      ...filterOptions.hierarchyLevels.map(v => ({ value: v, label: toLabel(v) })),
    ];
  }, [filterOptions?.hierarchyLevels]);

  return (
    <FilterBar
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
      <FilterField label="Type">
        <Select
          value={filters.docType || 'all'}
          onValueChange={(v) => updateFilter({ docType: v === 'all' ? null : v })}
          options={SEARCH_DOC_TYPE_OPTIONS}
          aria-label="Filter by document type"
        />
      </FilterField>

      <FilterField label="Section">
        <Select
          value={filters.sectionType || 'all'}
          onValueChange={(v) => updateFilter({ sectionType: v === 'all' ? null : v })}
          options={sectionTypeOptions}
          aria-label="Filter by section type"
        />
      </FilterField>

      <FilterField label="Level">
        <Select
          value={filters.hierarchyLevel || 'all'}
          onValueChange={(v) => updateFilter({ hierarchyLevel: v === 'all' ? null : v })}
          options={hierarchyLevelOptions}
          aria-label="Filter by hierarchy level"
        />
      </FilterField>

      <FilterField label="Issues">
        <Select
          value={issueSystem || 'all'}
          onValueChange={handleIssueSystemChange}
          options={SEARCH_ISSUE_SYSTEM_OPTIONS}
          aria-label="Filter by issue system"
        />
      </FilterField>

      {/* Conditional sub-filters based on issue system — animated in/out */}
      <div className={`
        flex items-center gap-3
        transition-all duration-200 ease-out overflow-hidden
        ${issueSystem === 'compliance' ? 'max-w-[500px] opacity-100' : 'max-w-0 opacity-0'}
      `}>
        <FilterField label="Classification">
          <Select
            value={filters.classification || 'all'}
            onValueChange={(v) => updateFilter({ classification: v === 'all' ? null : v })}
            options={SEARCH_CLASSIFICATION_OPTIONS}
            aria-label="Filter by classification"
          />
        </FilterField>
        <FilterField label="Issue Type">
          <MultiSelect
            label="Issue Type"
            options={ISSUE_TYPE_MULTISELECT_OPTIONS}
            value={issueTypeValues}
            onChange={(values) => updateFilter({ issueType: serializeCommaSeparated(values) })}
            placeholder="All issue types"
            aria-label="Filter by compliance issue type"
          />
        </FilterField>
      </div>

      <div className={`
        flex items-center gap-3
        transition-all duration-200 ease-out overflow-hidden
        ${issueSystem === 'jenai' ? 'max-w-[300px] opacity-100' : 'max-w-0 opacity-0'}
      `}>
        <FilterField label="Category">
          <MultiSelect
            label="Category"
            options={JENAI_CATEGORY_MULTISELECT_OPTIONS}
            value={issueCategoryValues}
            onChange={(values) => updateFilter({ issueCategory: serializeCommaSeparated(values) })}
            placeholder="All categories"
            aria-label="Filter by JenAI category"
          />
        </FilterField>
      </div>

      <div className={`
        flex items-center gap-3
        transition-all duration-200 ease-out overflow-hidden
        ${issueSystem && issueSystem !== 'none' ? 'max-w-[250px] opacity-100' : 'max-w-0 opacity-0'}
      `}>
        <FilterField label="Severity">
          <MultiSelect
            label="Severity"
            options={SEVERITY_MULTISELECT_OPTIONS}
            value={issueSeverityValues}
            onChange={(values) => updateFilter({ issueSeverity: serializeCommaSeparated(values) })}
            placeholder="All severities"
            aria-label="Filter by severity"
          />
        </FilterField>
      </div>
    </FilterBar>
  );
}
