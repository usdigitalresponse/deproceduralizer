'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Total number of items (for showing item range) */
  total?: number;
  /** Items per page (for calculating item range) */
  pageSize?: number;
  /** Show "Showing X - Y of Z" text */
  showItemCount?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

/**
 * A reusable pagination component with optional item count display.
 *
 * @example
 * ```tsx
 * // Simple pagination
 * <Pagination
 *   page={currentPage}
 *   totalPages={10}
 *   onPageChange={setPage}
 * />
 *
 * // With item count
 * <Pagination
 *   page={currentPage}
 *   totalPages={10}
 *   total={100}
 *   pageSize={10}
 *   showItemCount
 *   onPageChange={setPage}
 * />
 * ```
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  showItemCount = false,
  size = 'sm',
  className = '',
}: PaginationProps) {
  // Don't render if only one page
  if (totalPages <= 1) {
    return null;
  }

  const showRange = showItemCount && total !== undefined && pageSize !== undefined;
  const startItem = showRange ? (page - 1) * pageSize + 1 : 0;
  const endItem = showRange ? Math.min(page * pageSize, total) : 0;

  const buttonSize = size;
  const textSize = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div
      className={`flex items-center ${showRange ? 'justify-between' : 'justify-center'} gap-4 ${className}`}
    >
      {/* Item count */}
      {showRange && (
        <p className={`${textSize} text-[var(--color-text-muted)]`}>
          Showing{' '}
          <span className="font-medium text-[var(--color-text)]">{startItem}</span>
          {' '}-{' '}
          <span className="font-medium text-[var(--color-text)]">{endItem}</span>
          {' '}of{' '}
          <span className="font-medium text-[var(--color-text)]">{total}</span>
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size={buttonSize}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="sr-only sm:not-sr-only">Previous</span>
        </Button>

        <span
          className={`px-2 ${textSize} text-[var(--color-text-muted)]`}
          aria-current="page"
        >
          Page{' '}
          <span className="font-medium text-[var(--color-text)]">{page}</span>
          {' '}of{' '}
          <span className="font-medium text-[var(--color-text)]">{totalPages}</span>
        </span>

        <Button
          variant="secondary"
          size={buttonSize}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Go to next page"
        >
          <span className="sr-only sm:not-sr-only">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
