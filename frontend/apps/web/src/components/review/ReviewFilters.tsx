'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { RedFlagFilterOptions } from '@deproceduralizer/database';

interface ReviewFiltersProps {
  categories: string[];
  currentFilters: RedFlagFilterOptions;
  sortBy: string;
  sortOrder: string;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'needs_context', label: 'Needs Context' },
  { value: 'deferred', label: 'Deferred' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'high', label: 'High (7-10)' },
  { value: 'medium', label: 'Medium (4-6)' },
  { value: 'low', label: 'Low (1-3)' },
];

const SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'category', label: 'Category' },
  { value: 'reviewedAt', label: 'Last Reviewed' },
];

export function ReviewFilters({
  categories,
  currentFilters,
  sortBy,
  sortOrder,
  className = '',
}: ReviewFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change
      params.set('page', '1');

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.push(`/review?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push('/review?status=all');
  }, [router]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (currentFilters.status && currentFilters.status !== 'all' && currentFilters.status !== 'unreviewed') ||
    currentFilters.severity ||
    currentFilters.category;

  // Build category options dynamically
  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat, label: cat }))
  ], [categories]);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Status:
        </label>
        <Select
          value={currentFilters.status || 'all'}
          onValueChange={(value) => updateParams({ status: value })}
          options={STATUS_OPTIONS}
          aria-label="Filter by status"
        />
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Severity:
        </label>
        <Select
          value={currentFilters.severity || 'all'}
          onValueChange={(value) => updateParams({ severity: value })}
          options={SEVERITY_OPTIONS}
          aria-label="Filter by severity"
        />
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Category:
        </label>
        <Select
          value={currentFilters.category || 'all'}
          onValueChange={(value) => updateParams({ category: value })}
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
          value={sortBy}
          onValueChange={(value) => updateParams({ sortBy: value })}
          options={SORT_OPTIONS}
          aria-label="Sort by"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => updateParams({ sortOrder: sortOrder === 'desc' ? 'asc' : 'desc' })}
          aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
        >
          {sortOrder === 'desc' ? '↓' : '↑'}
        </Button>
      </div>
    </div>
  );
}

export default ReviewFilters;
