'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type {
  RedFlagWithContext,
  ReviewStatusCounts,
} from '@deproceduralizer/database';
import { ReviewProgress } from './ReviewProgress';
import { ReviewFilters } from './ReviewFilters';
import { ReviewCard } from './ReviewCard';
import { ReviewKeyboardNav } from './ReviewKeyboardNav';
import RegulationModal from './RegulationModal';
import { 
  QueueResultsInfo, 
  QueueEmptyState, 
  QueuePagination 
} from './shared';
import { getStateFromPathname, useDeepLink, useQueueNavigation } from '@/hooks';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ReviewQueueProps {
  initialFlags: RedFlagWithContext[];
  pagination: PaginationInfo;
  statusCounts: ReviewStatusCounts;
  categories: string[];
}

export function ReviewQueue({
  initialFlags,
  pagination,
  statusCounts,
  categories,
}: ReviewQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  // Local state for optimistic updates
  const [flags, setFlags] = useState<RedFlagWithContext[]>(initialFlags);
  const [counts, setCounts] = useState<ReviewStatusCounts>(statusCounts);

  // Modal state for viewing regulation
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Keyboard navigation hook
  const { 
    focusedIndex, 
    setFocusedIndex, 
    setCardRef, 
    navigate, 
    goToNextUnreviewed,
    cardRefs 
  } = useQueueNavigation({
    items: flags,
    getItemId: (f) => `flag-${f.id}`,
    onViewRegulation: (f) => setSelectedRegulationId(f.regulation.id),
    findNextUnreviewed: (idx) => flags.findIndex(
      (f, i) => i > idx && (f.reviewStatus === 'unreviewed' || !f.reviewStatus)
    ),
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: flags.map((f) => ({ id: f.id })),
    cardRefs,
    setFocusedIndex,
    itemType: 'flag',
  });

  // Sync with server data when props change
  useEffect(() => {
    setFlags(initialFlags);
    setCounts(statusCounts);
  }, [initialFlags, statusCounts]);

  // Handle flag update (optimistic)
  const handleFlagUpdated = useCallback((updatedFlag: RedFlagWithContext) => {
    // Update flags and counts together to avoid stale closure issues
    setFlags((prevFlags) => {
      // Compute old status from the actual previous state, not a closure
      const oldFlag = prevFlags.find((f) => f.id === updatedFlag.id);
      const oldStatus = oldFlag?.reviewStatus || 'unreviewed';
      const newStatus = updatedFlag.reviewStatus || 'unreviewed';

      // Update counts if status changed
      if (oldStatus !== newStatus) {
        setCounts((prevCounts) => {
          const newCounts = { ...prevCounts };
          // Decrement old status count
          if (oldStatus in newCounts && oldStatus !== 'total') {
            newCounts[oldStatus as keyof ReviewStatusCounts] = Math.max(
              0,
              (newCounts[oldStatus as keyof ReviewStatusCounts] as number) - 1
            );
          }
          // Increment new status count
          if (newStatus in newCounts && newStatus !== 'total') {
            newCounts[newStatus as keyof ReviewStatusCounts] =
              (newCounts[newStatus as keyof ReviewStatusCounts] as number) + 1;
          }
          return newCounts;
        });
      }

      return prevFlags.map((f) => (f.id === updatedFlag.id ? updatedFlag : f));
    });
  }, []);

  // Handle view regulation
  const handleViewRegulation = useCallback((regulationId: number) => {
    setSelectedRegulationId(regulationId);
  }, []);

  // Pagination helpers
  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/${state}/review?${params.toString()}`);
  }, [router, searchParams, state]);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ReviewProgress counts={counts} />

      {/* Filters */}
      <ReviewFilters
        categories={categories}
        className="mb-2"
      />

      {/* Keyboard navigation */}
      <ReviewKeyboardNav
        onNavigate={navigate}
        onNextUnreviewed={goToNextUnreviewed}
        onViewRegulation={() => {
          if (flags[focusedIndex]) {
            handleViewRegulation(flags[focusedIndex].regulation.id);
          }
        }}
      />

      {/* Results info */}
      <QueueResultsInfo
        startItem={flags.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
        endItem={Math.min(pagination.page * pagination.pageSize, pagination.total)}
        total={pagination.total}
        itemLabel="flags"
      />

      {/* Flag cards */}
      {flags.length === 0 ? (
        <QueueEmptyState 
          title="No flags found" 
          description="Try adjusting your filters or check back later." 
        />
      ) : (
        <div className="space-y-4">
          {flags.map((flag, index) => (
            <ReviewCard
              key={flag.id}
              ref={(el) => setCardRef(index, el)}
              flag={flag}
              onUpdated={handleFlagUpdated}
              onViewRegulation={handleViewRegulation}
              isFocused={index === focusedIndex}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <QueuePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={goToPage}
      />

      {/* Regulation Modal */}
      <RegulationModal
        regulationId={selectedRegulationId}
        onClose={() => setSelectedRegulationId(null)}
      />
    </div>
  );
}

export default ReviewQueue;
