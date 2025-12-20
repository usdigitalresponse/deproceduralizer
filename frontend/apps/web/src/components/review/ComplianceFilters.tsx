'use client';

import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button, Select } from '@/components/ui';
import { reviewStatusParser, complianceSortByParser, sortOrderParser, searchParser, pageParser, type ReviewStatusValue } from '@/lib/url/parsers';
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
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active
  const hasActiveFilters =
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    filters.issueType;

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
        onClick={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
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
