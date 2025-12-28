'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DEVELOPER_STATUSES, DEVELOPERS, REVIEW_STATUSES, COMPLIANCE_ISSUE_TYPES, formatLabel } from '@/types/regulation';
import { complianceDeveloperQueueParsers } from '@/lib/url/parsers';
import { SEVERITY_FILTER_OPTIONS } from '@/lib/constants/filters';

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
  ...REVIEW_STATUSES.filter(s => s.value !== 'unreviewed'), // Exclude unreviewed since these are all reviewed
];

const SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'issueType', label: 'Issue Type' },
  { value: 'reviewedAt', label: 'Review Date' },
  { value: 'developerCheckedAt', label: 'Last Updated' },
];

export function ComplianceDeveloperFilters({
  issueTypes,
  className = '',
}: ComplianceDeveloperFiltersProps) {
  const [filters, setFilters] = useQueryStates(complianceDeveloperQueueParsers, {
    shallow: false,
  });

  const issueTypeOptions = [
    { value: 'all', label: 'All Issue Types' },
    ...issueTypes.map(t => {
      const found = COMPLIANCE_ISSUE_TYPES.find(ct => ct.value === t);
      return { value: t, label: found?.label || formatLabel(t) };
    }),
  ];

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      severity: 'all',
      reviewStatus: 'all',
      issueType: null,
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.reviewStatus && filters.reviewStatus !== 'all') ||
    filters.issueType;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Developer Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Dev Status:
        </label>
        <Select
          value={filters.developerStatus || 'all'}
          onValueChange={(value) => setFilters({ developerStatus: value as any, page: 1 })}
          options={DEV_STATUS_OPTIONS}
          aria-label="Filter by developer status"
        />
      </div>

      {/* Developer Assigned filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Developer:
        </label>
        <Select
          value={filters.developerAssigned || 'all'}
          onValueChange={(value) => setFilters({ developerAssigned: value === 'all' ? null : value, page: 1 })}
          options={DEVELOPER_OPTIONS}
          aria-label="Filter by developer"
        />
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Severity:
        </label>
        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters({ severity: value as any, page: 1 })}
          options={SEVERITY_FILTER_OPTIONS}
          aria-label="Filter by severity"
        />
      </div>

      {/* Review Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Review:
        </label>
        <Select
          value={filters.reviewStatus || 'all'}
          onValueChange={(value) => setFilters({ reviewStatus: value as any, page: 1 })}
          options={REVIEW_STATUS_OPTIONS}
          aria-label="Filter by review status"
        />
      </div>

      {/* Issue Type filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Issue Type:
        </label>
        <Select
          value={filters.issueType || 'all'}
          onValueChange={(value) => setFilters({ issueType: value === 'all' ? null : value, page: 1 })}
          options={issueTypeOptions}
          aria-label="Filter by issue type"
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Sort:
        </label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
          options={SORT_OPTIONS}
          aria-label="Sort by"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
          aria-label={`Sort ${filters.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
        >
          {filters.sortOrder === 'desc' ? '↓' : '↑'}
        </Button>
      </div>
    </div>
  );
}

export default ComplianceDeveloperFilters;
