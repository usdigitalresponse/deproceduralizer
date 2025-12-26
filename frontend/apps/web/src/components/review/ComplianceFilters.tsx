'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button, Select } from '@/components/ui';
import {
  reviewStatusParser,
  complianceSortByParser,
  sortOrderParser,
  searchParser,
  pageParser,
  severityParser,
  statuteSourceParser,
  requirementFoundParser,
  type ReviewStatusValue,
  type SeverityValue,
  type StatuteSourceValue,
  type RequirementFoundValue,
} from '@/lib/url/parsers';
import {
  SEVERITY_FILTER_OPTIONS,
  STATUTE_SOURCE_FILTER_OPTIONS,
  REQUIREMENT_FOUND_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { REVIEW_STATUSES, COMPLIANCE_ISSUE_TYPES } from '@/types/regulation';

interface ComplianceFiltersProps {
  issueTypes: string[];
  className?: string;
}

export function ComplianceFilters({
  issueTypes,
  className = '',
}: ComplianceFiltersProps) {
  const [filters, setFilters] = useQueryStates({
    reviewStatus: reviewStatusParser,
    issueType: searchParser,
    severity: severityParser,
    statuteSource: statuteSourceParser,
    requirementFound: requirementFoundParser,
    sortBy: complianceSortByParser,
    sortOrder: sortOrderParser,
    page: pageParser,
  }, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      reviewStatus: 'unreviewed',
      issueType: null,
      severity: 'all',
      statuteSource: 'all',
      requirementFound: 'true', // Default to showing only LLM-confirmed issues
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (excluding requirementFound='true' which is the default)
  const hasActiveFilters =
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    filters.issueType ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.statuteSource && filters.statuteSource !== 'all') ||
    (filters.requirementFound && filters.requirementFound !== 'true');

  // Build filter options
  const statusOptions = [{ value: 'all', label: 'All Statuses' }, ...REVIEW_STATUSES];
  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...issueTypes.map(t => {
      const found = COMPLIANCE_ISSUE_TYPES.find(ct => ct.value === t);
      return { value: t, label: found?.label || t };
    }),
  ];
  const sortOptions = [
    { value: 'severity', label: 'Severity' },
    { value: 'createdAt', label: 'Date Created' },
    { value: 'issueType', label: 'Issue Type' },
    { value: 'reviewedAt', label: 'Last Reviewed' },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-3 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)] ${className}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Status:</label>
        <Select
          value={filters.reviewStatus || 'unreviewed'}
          onValueChange={(value) => setFilters({ reviewStatus: value as ReviewStatusValue, page: 1 })}
          options={statusOptions}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Type:</label>
        <Select
          value={filters.issueType || 'all'}
          onValueChange={(value) => setFilters({ issueType: value === 'all' ? null : value, page: 1 })}
          options={typeOptions}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Severity:</label>
        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters({ severity: value as SeverityValue, page: 1 })}
          options={SEVERITY_FILTER_OPTIONS}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Source:</label>
        <Select
          value={filters.statuteSource || 'all'}
          onValueChange={(value) => setFilters({ statuteSource: value as StatuteSourceValue, page: 1 })}
          options={STATUTE_SOURCE_FILTER_OPTIONS}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">LLM:</label>
        <Select
          value={filters.requirementFound || 'true'}
          onValueChange={(value) => setFilters({ requirementFound: value as RequirementFoundValue, page: 1 })}
          options={REQUIREMENT_FOUND_FILTER_OPTIONS}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Sort:</label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
          options={sortOptions}
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
        aria-label={`Sort ${filters.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
      >
        {filters.sortOrder === 'desc' ? '↓' : '↑'}
      </Button>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}

export default ComplianceFilters;
