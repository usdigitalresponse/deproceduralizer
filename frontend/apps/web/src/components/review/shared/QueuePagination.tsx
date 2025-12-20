'use client';

import { Button } from '@/components/ui';

interface QueuePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Shared pagination component for review queues.
 *
 * @example
 * <QueuePagination
 *   page={pagination.page}
 *   totalPages={pagination.totalPages}
 *   onPageChange={goToPage}
 * />
 */
export function QueuePagination({ page, totalPages, onPageChange }: QueuePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </Button>
      <span className="px-4 text-sm text-[var(--color-text-secondary)]">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}

export default QueuePagination;
