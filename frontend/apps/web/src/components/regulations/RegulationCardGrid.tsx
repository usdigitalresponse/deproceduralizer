'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { RegulationCard } from './RegulationCard';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface RegulationCardGridProps {
  data: RegulationWithAnalysis[];
  pagination: PaginationInfo;
  onCardClick: (regulation: RegulationWithAnalysis) => void;
  onPageChange: (page: number) => void;
}

/**
 * Responsive grid layout for regulation cards with pagination.
 */
export function RegulationCardGrid({
  data,
  pagination,
  onCardClick,
  onPageChange,
}: RegulationCardGridProps) {
  const { page, totalPages, total } = pagination;
  const startItem = (page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(page * pagination.pageSize, total);

  if (data.length === 0) {
    return (
      <EmptyState
        title="No regulations found"
        description="Try adjusting your filters or search terms"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((regulation) => (
          <RegulationCard
            key={regulation.id}
            regulation={regulation}
            onClick={() => onCardClick(regulation)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-neutral-200)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            Showing <span className="font-medium text-[var(--color-text)]">{startItem}</span> -{' '}
            <span className="font-medium text-[var(--color-text)]">{endItem}</span> of{' '}
            <span className="font-medium text-[var(--color-text)]">{total}</span> regulations
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <span className="text-sm text-[var(--color-text-muted)] px-2">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
