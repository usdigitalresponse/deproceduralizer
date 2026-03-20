'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, MultiSelect, FilterBar, FilterField } from '@/components/ui';
import { analysisTableParsers } from '@/lib/url/parsers';
import type { AnalysisSortByValue } from '@/lib/constants/values';
import {
  TIER_FILTER_OPTIONS,
  ANALYSIS_SORT_OPTIONS,
  ISSUE_TYPE_FILTER_OPTIONS,
  PIPELINE_SEVERITY_FILTER_OPTIONS,
  CLASSIFICATION_FILTER_OPTIONS,
  toMultiSelectOptions,
} from '@/lib/constants/filters';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';

interface GuidanceAnalysisTableFiltersProps {
  agencies: string[];
  docTypes: string[];
}

export function GuidanceAnalysisTableFilters({ agencies, docTypes }: GuidanceAnalysisTableFiltersProps) {
  const [filters, setFilters] = useQueryStates(analysisTableParsers, {
    shallow: false,
  });

  // On first load, apply default classification if no URL param is set
  const didApplyDefaults = useRef(false);
  useEffect(() => {
    if (!didApplyDefaults.current && filters.classification === null) {
      didApplyDefaults.current = true;
      setFilters({ classification: 'burdensome,justified,needs_research' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = useCallback(() => {
    setFilters({
      tierCompleted: null,
      classification: 'burdensome,justified,needs_research',
      issueType: null,
      severity: null,
      agency: null,
      docType: null,
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    filters.tierCompleted ||
    (filters.classification && filters.classification !== 'burdensome,justified,needs_research') ||
    filters.issueType ||
    filters.severity ||
    filters.agency ||
    filters.docType
  );

  const agencyOptions = agencies.map(a => ({ value: a, label: a }));
  const docTypeOptions = docTypes.map(dt => ({ value: dt, label: dt }));

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
      clearFiltersLabel="Reset Filters"
    >
      <FilterField label="Tier">
        <MultiSelect
          label="Tier"
          value={parseCommaSeparated(filters.tierCompleted)}
          onChange={(values) => setFilters({ tierCompleted: serializeCommaSeparated(values), page: 1 })}
          options={toMultiSelectOptions(TIER_FILTER_OPTIONS)}
        />
      </FilterField>

      <FilterField label="Classification">
        <MultiSelect
          label="Classification"
          value={parseCommaSeparated(filters.classification)}
          onChange={(values) => setFilters({ classification: serializeCommaSeparated(values), page: 1 })}
          options={toMultiSelectOptions(CLASSIFICATION_FILTER_OPTIONS)}
        />
      </FilterField>

      <FilterField label="Issue Type">
        <MultiSelect
          label="Issue Type"
          value={parseCommaSeparated(filters.issueType)}
          onChange={(values) => setFilters({ issueType: serializeCommaSeparated(values), page: 1 })}
          options={toMultiSelectOptions(ISSUE_TYPE_FILTER_OPTIONS)}
          searchable
        />
      </FilterField>

      <FilterField label="Severity">
        <MultiSelect
          label="Severity"
          value={parseCommaSeparated(filters.severity)}
          onChange={(values) => setFilters({ severity: serializeCommaSeparated(values), page: 1 })}
          options={toMultiSelectOptions(PIPELINE_SEVERITY_FILTER_OPTIONS)}
        />
      </FilterField>

      <FilterField label="Agency">
        <MultiSelect
          label="Agency"
          value={parseCommaSeparated(filters.agency)}
          onChange={(values) => setFilters({ agency: serializeCommaSeparated(values), page: 1 })}
          options={agencyOptions}
          searchable
        />
      </FilterField>

      <FilterField label="Doc Type">
        <MultiSelect
          label="Doc Type"
          value={parseCommaSeparated(filters.docType)}
          onChange={(values) => setFilters({ docType: serializeCommaSeparated(values), page: 1 })}
          options={docTypeOptions}
        />
      </FilterField>
    </FilterBar>
  );
}
