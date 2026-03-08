'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, MultiSelect, FilterBar, FilterField } from '@/components/ui';
import { DEVELOPER_STATUSES, DEVELOPERS, REVIEW_STATUSES, COMPLIANCE_ISSUE_TYPES, formatLabel } from '@/types/regulation';
import {
  complianceDeveloperQueueParsers,
  parseCommaSeparated,
  serializeCommaSeparated,
  type ComplianceDeveloperSortByValue,
  type DeveloperStatusValue,
  type ReviewStatusValue,
} from '@/lib/url/parsers';
import { typedValue } from '@/lib/url/type-helpers';
import { SEVERITY_MULTISELECT_OPTIONS, COMPLIANCE_DEVELOPER_SORT_OPTIONS } from '@/lib/constants/filters';

interface ComplianceDeveloperFiltersProps {
  issueTypes: string[];
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

const REVIEW_STATUS_OPTIONS = [
  { value: 'all', label: 'All Review Statuses' },
  ...REVIEW_STATUSES.filter(s => s.value !== 'unreviewed'),
];


export function ComplianceDeveloperFilters({
  issueTypes,
  className = '',
}: ComplianceDeveloperFiltersProps) {
  const [filters, setFilters] = useQueryStates(complianceDeveloperQueueParsers, {
    shallow: false,
  });

  const selectedIssueTypes = useMemo(() => parseCommaSeparated(filters.issueType), [filters.issueType]);
  const selectedSeverities = useMemo(() => parseCommaSeparated(filters.severity), [filters.severity]);

  const issueTypeOptions = useMemo(() =>
    issueTypes.map(t => {
      const found = COMPLIANCE_ISSUE_TYPES.find(ct => ct.value === t);
      return { value: t, label: found?.label || formatLabel(t) };
    }),
  [issueTypes]);

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      severity: null,
      reviewStatus: 'all',
      issueType: null,
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned ||
    filters.severity ||
    (filters.reviewStatus && filters.reviewStatus !== 'all') ||
    filters.issueType
  );

  return (
    <FilterBar
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={COMPLIANCE_DEVELOPER_SORT_OPTIONS}
      onSortByChange={typedValue<ComplianceDeveloperSortByValue>((value) => setFilters({ sortBy: value, page: 1 }))}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
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

      <FilterField label="Review">
        <Select
          value={filters.reviewStatus || 'all'}
          onValueChange={typedValue<ReviewStatusValue>((value) => setFilters({ reviewStatus: value, page: 1 }))}
          options={REVIEW_STATUS_OPTIONS}
          aria-label="Filter by review status"
        />
      </FilterField>

      <FilterField label="Issue Type">
        <MultiSelect
          label="Issue Type"
          value={selectedIssueTypes}
          onChange={(values) => setFilters({ issueType: serializeCommaSeparated(values), page: 1 })}
          options={issueTypeOptions}
          placeholder="All Issue Types"
          aria-label="Filter by issue type"
        />
      </FilterField>
    </FilterBar>
  );
}

export default ComplianceDeveloperFilters;
