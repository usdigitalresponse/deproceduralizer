'use client';

import { RegulationCard } from './RegulationCard';
import { EmptyState, Pagination } from '@/components/ui';
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
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.pageSize}
        showItemCount
        onPageChange={onPageChange}
        className="pt-4 border-t border-[var(--color-neutral-200)]"
      />
    </div>
  );
}
