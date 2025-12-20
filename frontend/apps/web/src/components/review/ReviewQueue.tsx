'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type {
  RedFlagWithContext,
  ReviewStatusCounts,
  RedFlagFilterOptions,
} from '@deproceduralizer/database';
import { ReviewProgress } from './ReviewProgress';
import { ReviewFilters } from './ReviewFilters';
import { ReviewCard } from './ReviewCard';
import { ReviewKeyboardNav } from './ReviewKeyboardNav';
import { Button } from '@/components/ui/Button';
import RegulationModal from './RegulationModal';
import { getStateFromPathname, useDeepLink } from '@/hooks';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Filter options without state - state is handled at the page level
type UIFilterOptions = Omit<RedFlagFilterOptions, 'state'>;

interface ReviewQueueProps {
  initialFlags: RedFlagWithContext[];
  pagination: PaginationInfo;
  statusCounts: ReviewStatusCounts;
  categories: string[];
  currentFilters: UIFilterOptions;
  sortBy: string;
  sortOrder: string;
  compact?: boolean;
}

export function ReviewQueue({
  initialFlags,
  pagination,
  statusCounts,
  categories,
  currentFilters,
  sortBy,
  sortOrder,
  compact = false,
}: ReviewQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  // Local state for optimistic updates
  const [flags, setFlags] = useState<RedFlagWithContext[]>(initialFlags);
  const [counts, setCounts] = useState<ReviewStatusCounts>(statusCounts);

  // Focused card for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Modal state for viewing regulation
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

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

  // Keyboard navigation handlers
  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    setFocusedIndex((prev) => {
      const newIndex = direction === 'down'
        ? Math.min(prev + 1, flags.length - 1)
        : Math.max(prev - 1, 0);

      // Scroll card into view
      cardRefs.current[newIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      return newIndex;
    });
  }, [flags.length]);

  const handleNextUnreviewed = useCallback(() => {
    const nextUnreviewedIndex = flags.findIndex(
      (f, i) => i > focusedIndex && (f.reviewStatus === 'unreviewed' || !f.reviewStatus)
    );
    if (nextUnreviewedIndex !== -1) {
      setFocusedIndex(nextUnreviewedIndex);
      cardRefs.current[nextUnreviewedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [flags, focusedIndex]);

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
        currentFilters={currentFilters}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      {/* Keyboard navigation */}
      <ReviewKeyboardNav
        onNavigate={handleNavigate}
        onNextUnreviewed={handleNextUnreviewed}
        onViewRegulation={() => {
          if (flags[focusedIndex]) {
            handleViewRegulation(flags[focusedIndex].regulation.id);
          }
        }}
      />

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <span>
          Showing {flags.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
          –{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} flags
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Press <kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">?</kbd> for keyboard shortcuts
        </span>
      </div>

      {/* Flag cards */}
      {flags.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No flags found</p>
          <p className="text-sm">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag, index) => (
            <ReviewCard
              key={flag.id}
              ref={(el) => { cardRefs.current[index] = el; }}
              flag={flag}
              onUpdated={handleFlagUpdated}
              onViewRegulation={handleViewRegulation}
              isFocused={index === focusedIndex}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => goToPage(pagination.page - 1)}
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
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Regulation Modal */}
      <RegulationModal
        regulationId={selectedRegulationId}
        onClose={() => setSelectedRegulationId(null)}
      />
    </div>
  );
}

export default ReviewQueue;
