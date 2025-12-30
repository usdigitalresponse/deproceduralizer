'use client';

import { X } from 'lucide-react';
import { Button } from '../Button';

export interface ClearFiltersButtonProps {
  /** Whether there are active filters to clear */
  hasActiveFilters: boolean;
  /** Callback when clicked */
  onClick: () => void;
  /** Display variant */
  variant?: 'text' | 'icon';
}

/**
 * A button to clear active filters, only visible when filters are active.
 *
 * @example
 * ```tsx
 * <ClearFiltersButton
 *   hasActiveFilters={hasActiveFilters}
 *   onClick={clearFilters}
 * />
 * ```
 */
export function ClearFiltersButton({
  hasActiveFilters,
  onClick,
  variant = 'text',
}: ClearFiltersButtonProps) {
  if (!hasActiveFilters) {
    return null;
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {variant === 'icon' && <X className="w-4 h-4 mr-1" />}
      Clear{variant === 'text' ? ' filters' : ' all'}
    </Button>
  );
}
