'use client';

import type { ReactNode } from 'react';

export interface FilterFieldProps {
  /** Label for the filter field */
  label: string;
  /** The filter control (Select, Input, etc.) */
  children: ReactNode;
  /** HTML id for the control (for accessibility) */
  htmlFor?: string;
  /** Tooltip text shown on hover */
  title?: string;
}

/**
 * A labeled filter field with consistent styling.
 *
 * @example
 * ```tsx
 * <FilterField label="Status" htmlFor="status-filter">
 *   <Select id="status-filter" ... />
 * </FilterField>
 * ```
 */
export function FilterField({ label, children, htmlFor, title }: FilterFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        className="text-sm text-[var(--color-text-secondary)]"
        htmlFor={htmlFor}
        title={title}
      >
        {label}:
      </label>
      {children}
    </div>
  );
}
