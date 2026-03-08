'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField } from '@/components/ui';
import { searchResultsParsers } from '@/lib/url/parsers';
import {
  SEARCH_DOC_TYPE_OPTIONS,
  SEARCH_CLASSIFICATION_OPTIONS,
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

  const hasActiveFilters = Boolean(
    filters.docType ||
    filters.sectionType ||
    filters.hierarchyLevel ||
    filters.classification
  );

  const clearFilters = useCallback(() => {
    setFilters({
      docType: null,
      sectionType: null,
      hierarchyLevel: null,
      classification: null,
      page: 1,
    });
    router.refresh();
  }, [setFilters, router]);

  const updateFilter = useCallback((updates: Record<string, string | number | null>) => {
    setFilters({ ...updates, page: 1 });
    router.refresh();
  }, [setFilters, router]);

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

      <FilterField label="Classification">
        <Select
          value={filters.classification || 'all'}
          onValueChange={(v) => updateFilter({ classification: v === 'all' ? null : v })}
          options={SEARCH_CLASSIFICATION_OPTIONS}
          aria-label="Filter by classification"
        />
      </FilterField>
    </FilterBar>
  );
}
