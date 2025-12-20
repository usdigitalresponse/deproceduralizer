'use client';

import { Button } from '@/components/ui';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface QueuePaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

/**
 * Shared pagination component for review queues.
 *
 * @example
 * <QueuePagination
 *   pagination={pagination}
 *   onPageChange={goToPage}
 * />
 */
export function QueuePagination({ pagination, onPageChange }: QueuePaginationProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={pagination.page <= 1}
      >
        Previous
      </Button>
      <span className="px-4 text-sm text-[var(--color-text-secondary)]">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={pagination.page >= pagination.totalPages}
      >
        Next
      </Button>
    </div>
  );
}

export default QueuePagination;
