'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { reviewQueueParsers, type ReviewStatusValue, type SeverityValue } from '@/lib/url/parsers';
import { formatLabel } from '@/types/regulation';
import {
  REVIEW_STATUS_FILTER_OPTIONS,
  SEVERITY_FILTER_OPTIONS,
  REVIEW_SORT_OPTIONS,
} from '@/lib/constants/filters';

interface ReviewFiltersProps {
  categories: string[];
  className?: string;
}

export function ReviewFilters({
  categories,
  className = '',
}: ReviewFiltersProps) {
  const [filters, setFilters] = useQueryStates(reviewQueueParsers, {
    shallow: false, // Ensure server-side navigation for SEO/SSR
  });

  const clearFilters = useCallback(() => {
    // Reset to defaults
    setFilters({
      reviewStatus: 'unreviewed',
      severity: 'all',
      category: null,
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (filters.reviewStatus && filters.reviewStatus !== 'unreviewed') ||
    (filters.severity && filters.severity !== 'all') ||
    filters.category;

  // Build category options dynamically
  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat, label: formatLabel(cat) }))
  ], [categories]);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Status:
        </label>
        <Select
          value={filters.reviewStatus || 'unreviewed'}
          onValueChange={(value) => setFilters({ reviewStatus: value as ReviewStatusValue, page: 1 })}
          options={REVIEW_STATUS_FILTER_OPTIONS}
          aria-label="Filter by status"
        />
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Severity:
        </label>
        <Select
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters({ severity: value as SeverityValue, page: 1 })}
          options={SEVERITY_FILTER_OPTIONS}
          aria-label="Filter by severity"
        />
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Category:
        </label>
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => setFilters({ category: value === 'all' ? null : value, page: 1 })}
          options={categoryOptions}
          aria-label="Filter by category"
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
          Sort by:
        </label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => setFilters({ sortBy: value as any, page: 1 })}
          options={REVIEW_SORT_OPTIONS}
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

export default ReviewFilters;
