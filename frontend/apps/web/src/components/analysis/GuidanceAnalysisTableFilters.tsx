'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, FilterBar, FilterField } from '@/components/ui';
import { analysisTableParsers } from '@/lib/url/parsers';
import type {
  ClassificationFilterValue,
  TierFilterValue,
  AnalysisSortByValue,
  PipelineSeverityFilterValue,
} from '@/lib/constants/values';
import {
  TIER_FILTER_OPTIONS,
  ANALYSIS_SORT_OPTIONS,
  ISSUE_TYPE_FILTER_OPTIONS,
  PIPELINE_SEVERITY_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { CLASSIFICATION_COLORS, COLORED_CLASSIFICATION_OPTIONS } from '@/lib/constants/pipeline';

interface GuidanceAnalysisTableFiltersProps {
  agencies: string[];
  docTypes: string[];
}

export function GuidanceAnalysisTableFilters({ agencies, docTypes }: GuidanceAnalysisTableFiltersProps) {
  const [filters, setFilters] = useQueryStates(analysisTableParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      tierCompleted: 'all',
      classification: 'all',
      issueType: null,
      severity: 'all',
      agency: null,
      docType: null,
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    filters.tierCompleted !== 'all' ||
    filters.classification !== 'all' ||
    filters.issueType ||
    filters.severity !== 'all' ||
    filters.agency ||
    filters.docType
  );

  const agencyOptions = [
    { value: 'all', label: 'All Agencies' },
    ...agencies.map(a => ({ value: a, label: a })),
  ];

  const docTypeOptions = [
    { value: 'all', label: 'All Doc Types' },
    ...docTypes.map(dt => ({ value: dt, label: dt })),
  ];

  return (
    <FilterBar
      variant="panel"
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={ANALYSIS_SORT_OPTIONS}
      onSortByChange={(value) => setFilters({ sortBy: value as AnalysisSortByValue, page: 1 })}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
    >
      <FilterField label="Tier">
        <Select
          value={filters.tierCompleted}
          onValueChange={(value) => setFilters({ tierCompleted: value as TierFilterValue, page: 1 })}
          options={TIER_FILTER_OPTIONS}
          aria-label="Filter by tier completed"
        />
      </FilterField>

      <FilterField label="Classification">
        <Select
          value={filters.classification}
          onValueChange={(value) => setFilters({ classification: value as ClassificationFilterValue, page: 1 })}
          options={COLORED_CLASSIFICATION_OPTIONS}
          aria-label="Filter by classification"
          renderOption={(option) => {
            const colorClass = CLASSIFICATION_COLORS[option.value as keyof typeof CLASSIFICATION_COLORS];
            if (!colorClass || option.value === 'all') {
              return <span>{option.label}</span>;
            }
            return (
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colorClass.bg} border ${colorClass.border}`} />
                {option.label}
              </span>
            );
          }}
        />
      </FilterField>

      <FilterField label="Issue Type">
        <Select
          value={filters.issueType || 'all'}
          onValueChange={(value) => setFilters({ issueType: value === 'all' ? null : value, page: 1 })}
          options={ISSUE_TYPE_FILTER_OPTIONS}
          aria-label="Filter by issue type"
        />
      </FilterField>

      <FilterField label="Severity">
        <Select
          value={filters.severity}
          onValueChange={(value) => setFilters({ severity: value as PipelineSeverityFilterValue, page: 1 })}
          options={PIPELINE_SEVERITY_FILTER_OPTIONS}
          aria-label="Filter by severity"
        />
      </FilterField>

      <FilterField label="Agency">
        <Select
          value={filters.agency || 'all'}
          onValueChange={(value) => setFilters({ agency: value === 'all' ? null : value, page: 1 })}
          options={agencyOptions}
          aria-label="Filter by agency"
        />
      </FilterField>

      <FilterField label="Doc Type">
        <Select
          value={filters.docType || 'all'}
          onValueChange={(value) => setFilters({ docType: value === 'all' ? null : value, page: 1 })}
          options={docTypeOptions}
          aria-label="Filter by document type"
        />
      </FilterField>
    </FilterBar>
  );
}
