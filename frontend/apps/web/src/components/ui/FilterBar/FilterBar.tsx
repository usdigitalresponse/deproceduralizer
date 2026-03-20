'use client';

import type { ReactNode } from 'react';
import type { SelectOption } from '../Select';
import { SortControls } from './SortControls';
import { ClearFiltersButton } from './ClearFiltersButton';

export interface FilterBarProps {
  /** Filter fields (FilterField components) */
  children: ReactNode;
  /** Visual variant */
  variant?: 'default' | 'panel';
  /** Whether to show sort controls */
  showSortControls?: boolean;
  /** Current sort field (required if showSortControls) */
  sortBy?: string;
  /** Current sort order (required if showSortControls) */
  sortOrder?: 'asc' | 'desc';
  /** Available sort options (required if showSortControls) */
  sortOptions?: SelectOption[];
  /** Callback when sort field changes */
  onSortByChange?: (value: string) => void;
  /** Callback when sort order toggles */
  onSortOrderToggle?: () => void;
  /** Whether there are active filters */
  hasActiveFilters?: boolean;
  /** Callback to clear/reset filters */
  onClearFilters?: () => void;
  /** Label for the clear/reset button (default: "Clear filters") */
  clearFiltersLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A flexible filter bar container with optional sort controls and clear button.
 *
 * @example
 * ```tsx
 * <FilterBar
 *   variant="panel"
 *   showSortControls
 *   sortBy={filters.sortBy}
 *   sortOrder={filters.sortOrder}
 *   sortOptions={SORT_OPTIONS}
 *   onSortByChange={(value) => setFilters({ sortBy: value })}
 *   onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
 *   hasActiveFilters={hasActiveFilters}
 *   onClearFilters={clearFilters}
 * >
 *   <FilterField label="Status">
 *     <Select ... />
 *   </FilterField>
 *   <FilterField label="Severity">
 *     <Select ... />
 *   </FilterField>
 * </FilterBar>
 * ```
 */
export function FilterBar({
  children,
  variant = 'default',
  showSortControls = false,
  sortBy,
  sortOrder,
  sortOptions,
  onSortByChange,
  onSortOrderToggle,
  hasActiveFilters = false,
  onClearFilters,
  clearFiltersLabel,
  className = '',
}: FilterBarProps) {
  const variantStyles = {
    default: '',
    panel: 'p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]',
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${variantStyles[variant]} ${className}`}>
      {/* Filter fields */}
      {children}

      {/* Clear filters button */}
      {onClearFilters && (
        <ClearFiltersButton
          hasActiveFilters={hasActiveFilters}
          onClick={onClearFilters}
          label={clearFiltersLabel}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort controls */}
      {showSortControls && sortBy !== undefined && sortOrder && sortOptions && onSortByChange && onSortOrderToggle && (
        <SortControls
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          onSortByChange={onSortByChange}
          onSortOrderToggle={onSortOrderToggle}
        />
      )}
    </div>
  );
}
