'use client';

import { Pagination } from '@/components/ui';

interface QueuePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Pagination component for review queues.
 * Thin wrapper around the shared Pagination component for backward compatibility.
 *
 * @example
 * <QueuePagination
 *   page={pagination.page}
 *   totalPages={pagination.totalPages}
 *   onPageChange={goToPage}
 * />
 */
export function QueuePagination({ page, totalPages, onPageChange }: QueuePaginationProps) {
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      className="pt-4"
    />
  );
}

export default QueuePagination;
