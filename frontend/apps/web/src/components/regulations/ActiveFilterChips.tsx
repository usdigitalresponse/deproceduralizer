'use client';

import { X } from 'lucide-react';

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (key: string, value: string) => void;
  onClearAll: () => void;
}

/**
 * Display active filter pills with remove buttons.
 */
export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
}: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
      <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
        Active Filters:
      </span>
      {filters.map((filter) => (
        <span
          key={`${filter.key}-${filter.value}`}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-[var(--color-neutral-200)] rounded-full text-[var(--color-text-secondary)]"
        >
          <span className="font-medium text-[var(--color-text-muted)]">
            {filter.label}:
          </span>
          <span>{filter.value}</span>
          <button
            type="button"
            onClick={() => onRemove(filter.key, filter.value)}
            className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--color-neutral-100)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            aria-label={`Remove ${filter.label}: ${filter.value} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
