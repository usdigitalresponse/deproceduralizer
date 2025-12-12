'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
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

  const selectClass = `
    px-3 py-2 text-sm
    bg-[var(--color-surface)]
    border border-[var(--color-neutral-300)]
    rounded-[var(--radius-md)]
    text-[var(--color-text)]
    transition-colors duration-[var(--transition-fast)]
    hover:border-[var(--color-neutral-400)]
    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
  `;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm text-[var(--color-text-secondary)]">
          Status:
        </label>
        <select
          id="status-filter"
          value={currentFilters.status || 'all'}
          onChange={(e) => updateParams({ status: e.target.value })}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="severity-filter" className="text-sm text-[var(--color-text-secondary)]">
          Severity:
        </label>
        <select
          id="severity-filter"
          value={currentFilters.severity || 'all'}
          onChange={(e) => updateParams({ severity: e.target.value })}
          className={selectClass}
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="category-filter" className="text-sm text-[var(--color-text-secondary)]">
          Category:
        </label>
        <select
          id="category-filter"
          value={currentFilters.category || ''}
          onChange={(e) => updateParams({ category: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort-by" className="text-sm text-[var(--color-text-secondary)]">
          Sort by:
        </label>
        <select
          id="sort-by"
          value={sortBy}
          onChange={(e) => updateParams({ sortBy: e.target.value })}
          className={selectClass}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => updateParams({ sortOrder: sortOrder === 'desc' ? 'asc' : 'desc' })}
          className={`
            px-2 py-2 text-sm
            bg-[var(--color-surface)]
            border border-[var(--color-neutral-300)]
            rounded-[var(--radius-md)]
            text-[var(--color-text)]
            transition-colors duration-[var(--transition-fast)]
            hover:border-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-50)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2
          `}
          aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
        >
          {sortOrder === 'desc' ? '↓' : '↑'}
        </button>
      </div>
    </div>
  );
}

export default ReviewFilters;
