'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button, Select, FilterBar, FilterField } from '@/components/ui';
import {
  reviewStatusParser,
  complianceSortByParser,
  sortOrderParser,
  searchParser,
  pageParser,
  severityParser,
  statuteSourceParser,
  requirementFoundParser,
  tierFilterParser,
  federalMandateFilterParser,
  hasAnalysisFilterParser,
  type ReviewStatusValue,
  type SeverityValue,
  type StatuteSourceValue,
  type RequirementFoundValue,
  type TierFilterValue,
  type FederalMandateFilterValue,
  type HasAnalysisFilterValue,
} from '@/lib/url/parsers';
import {
  SEVERITY_FILTER_OPTIONS,
  STATUTE_SOURCE_FILTER_OPTIONS,
  REQUIREMENT_FOUND_FILTER_OPTIONS,
  TIER_FILTER_OPTIONS,
  FEDERAL_MANDATE_FILTER_OPTIONS,
  HAS_ANALYSIS_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { REVIEW_STATUSES, COMPLIANCE_ISSUE_TYPES, formatLabel } from '@/types/regulation';

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
    tierCompleted: tierFilterParser,
    federalMandate: federalMandateFilterParser,
    hasAnalysis: hasAnalysisFilterParser,
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
      requirementFound: 'true',
      tierCompleted: 'all',
      federalMandate: 'all',
      hasAnalysis: 'all',
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters = Boolean(
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    filters.issueType ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.statuteSource && filters.statuteSource !== 'all') ||
    (filters.requirementFound && filters.requirementFound !== 'true') ||
    (filters.tierCompleted && filters.tierCompleted !== 'all') ||
    (filters.federalMandate && filters.federalMandate !== 'all') ||
    (filters.hasAnalysis && filters.hasAnalysis !== 'all')
  );

  const statusOptions = [{ value: 'all', label: 'All Statuses' }, ...REVIEW_STATUSES];
  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...issueTypes.map(t => {
      const found = COMPLIANCE_ISSUE_TYPES.find(ct => ct.value === t);
      return { value: t, label: found?.label || formatLabel(t) };
    }),
  ];
  const sortOptions = [
    { value: 'severity', label: 'Severity' },
    { value: 'createdAt', label: 'Date Created' },
    { value: 'issueType', label: 'Issue Type' },
    { value: 'reviewedAt', label: 'Last Reviewed' },
  ];

  return (
    <FilterBar
      variant="panel"
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      className={className}
    >
      <FilterField label="Status">
        <Select
          value={filters.reviewStatus || 'unreviewed'}
          onValueChange={(value) => setFilters({ reviewStatus: value as ReviewStatusValue, page: 1 })}
          options={statusOptions}
        />
      </FilterField>

      <FilterField label="Type">
        <Select
          value={filters.issueType || 'all'}
          onValueChange={(value) => setFilters({ issueType: value === 'all' ? null : value, page: 1 })}
          options={typeOptions}
          data-testid="issue-type-filter"
        />
      </FilterField>

      <FilterField label="Severity">
        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters({ severity: value as SeverityValue, page: 1 })}
          options={SEVERITY_FILTER_OPTIONS}
        />
      </FilterField>

      <FilterField label="Source">
        <Select
          value={filters.statuteSource || 'all'}
          onValueChange={(value) => setFilters({ statuteSource: value as StatuteSourceValue, page: 1 })}
          options={STATUTE_SOURCE_FILTER_OPTIONS}
        />
      </FilterField>

      <FilterField label="LLM">
        <Select
          value={filters.requirementFound || 'true'}
          onValueChange={(value) => setFilters({ requirementFound: value as RequirementFoundValue, page: 1 })}
          options={REQUIREMENT_FOUND_FILTER_OPTIONS}
        />
      </FilterField>

      <FilterField label="Tier">
        <Select
          value={filters.tierCompleted || 'all'}
          onValueChange={(value) => setFilters({ tierCompleted: value as TierFilterValue, page: 1 })}
          options={TIER_FILTER_OPTIONS}
        />
      </FilterField>

      <FilterField label="Federal">
        <Select
          value={filters.federalMandate || 'all'}
          onValueChange={(value) => setFilters({ federalMandate: value as FederalMandateFilterValue, page: 1 })}
          options={FEDERAL_MANDATE_FILTER_OPTIONS}
        />
      </FilterField>

      <FilterField label="Analysis">
        <Select
          value={filters.hasAnalysis || 'all'}
          onValueChange={(value) => setFilters({ hasAnalysis: value as HasAnalysisFilterValue, page: 1 })}
          options={HAS_ANALYSIS_FILTER_OPTIONS}
        />
      </FilterField>

      <FilterField label="Sort">
        <Select
          value={filters.sortBy}
          onValueChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
          options={sortOptions}
        />
      </FilterField>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
        aria-label={`Sort ${filters.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
      >
        {filters.sortOrder === 'desc' ? '↓' : '↑'}
      </Button>
    </FilterBar>
  );
}

export default ComplianceFilters;
