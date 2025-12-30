'use client';

import { Button } from '../Button';
import { Select, type SelectOption } from '../Select';

export interface SortControlsProps {
  /** Current sort field value */
  sortBy: string;
  /** Current sort order */
  sortOrder: 'asc' | 'desc';
  /** Available sort options */
  sortOptions: SelectOption[];
  /** Callback when sort field changes */
  onSortByChange: (value: string) => void;
  /** Callback when sort order toggles */
  onSortOrderToggle: () => void;
}

/**
 * Sort controls with a dropdown and order toggle button.
 *
 * @example
 * ```tsx
 * <SortControls
 *   sortBy={filters.sortBy}
 *   sortOrder={filters.sortOrder}
 *   sortOptions={REVIEW_SORT_OPTIONS}
 *   onSortByChange={(value) => setFilters({ sortBy: value })}
 *   onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
 * />
 * ```
 */
export function SortControls({
  sortBy,
  sortOrder,
  sortOptions,
  onSortByChange,
  onSortOrderToggle,
}: SortControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-[var(--color-text-secondary)]">
        Sort by:
      </label>
      <Select
        value={sortBy}
        onValueChange={onSortByChange}
        options={sortOptions}
        aria-label="Sort by"
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={onSortOrderToggle}
        aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
      >
        {sortOrder === 'desc' ? '↓' : '↑'}
      </Button>
    </div>
  );
}
