'use client';

import { useState, type ReactNode } from 'react';
import { FilterBar, type FilterBarProps } from './FilterBar';
import { AdvancedFilterToggle } from './AdvancedFilterToggle';
import { AnimatedCollapse } from '@/components/ui/AnimatedCollapse';

export interface TieredFilterBarProps extends Omit<FilterBarProps, 'children'> {
  primaryFilters: ReactNode;
  advancedFilters?: ReactNode;
  quickToggles?: ReactNode;
  advancedLabel?: string;
  advancedCount?: number;
  onClearAdvanced?: () => void;
}

export function TieredFilterBar({
  primaryFilters,
  advancedFilters,
  quickToggles,
  advancedLabel = 'More Filters',
  advancedCount = 0,
  onClearAdvanced,
  ...filterBarProps
}: TieredFilterBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <div className="space-y-0">
      <FilterBar {...filterBarProps}>
        {primaryFilters}
      </FilterBar>

      {(quickToggles || advancedFilters) && (
        <div className="flex items-center gap-4 flex-wrap py-2">
          {quickToggles}
          <div className="flex-1" />
          {advancedFilters && (
            <AdvancedFilterToggle
              isOpen={isAdvancedOpen}
              onClick={() => setIsAdvancedOpen(prev => !prev)}
              label={advancedLabel}
              activeCount={advancedCount}
            />
          )}
        </div>
      )}

      {advancedFilters && (
        <AnimatedCollapse isOpen={isAdvancedOpen}>
          <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                {advancedLabel}
              </span>
              {advancedCount > 0 && onClearAdvanced && (
                <button
                  type="button"
                  onClick={onClearAdvanced}
                  className="text-xs text-[var(--color-danger)] hover:underline cursor-pointer"
                >
                  Clear {advancedLabel.toLowerCase()}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {advancedFilters}
            </div>
          </div>
        </AnimatedCollapse>
      )}
    </div>
  );
}
