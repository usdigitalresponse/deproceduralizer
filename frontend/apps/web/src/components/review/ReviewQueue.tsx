'use client';

import type {
  RedFlagWithContext,
  ReviewStatusCounts,
} from '@deproceduralizer/database';
import { ReviewProgress } from './ReviewProgress';
import { ReviewFilters } from './ReviewFilters';
import { ReviewCard } from './ReviewCard';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination,
  KeyboardHelpModal,
} from './shared';
import { useDeepLink, useQueueNavigation, useQueue, type PaginationInfo } from '@/hooks';
import { useQueryState } from 'nuqs';
import { reviewStatusParser } from '@/lib/url/parsers';

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
  // Read current review status filter from URL for filter-aware item removal
  const [reviewStatus] = useQueryState('reviewStatus', reviewStatusParser);

  // Use generic queue hook for state management
  const {
    items: flags,
    counts,
    selectedRegulationId,
    jurisdiction: state,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated: handleFlagUpdated,
    goToPage,
  } = useQueue<RedFlagWithContext, ReviewStatusCounts>({
    initialItems: initialFlags,
    initialCounts: statusCounts,
    getItemId: (f) => f.id,
    getItemStatus: (f) => f.reviewStatus || 'unreviewed',
    defaultStatus: 'unreviewed',
    getRegulationId: (f) => f.regulation.id,
    statusFilter: reviewStatus || 'unreviewed',
  });

  // Keyboard navigation hook (auto-attaches listener)
  const {
    focusedIndex,
    setFocusedIndex,
    setCardRef,
    cardRefs,
    showHelp,
    setShowHelp,
    shortcuts,
  } = useQueueNavigation({
    items: flags,
    getItemId: (f) => `flag-${f.id}`,
    onViewRegulation: (f) => setSelectedRegulationId(f.regulation.id),
    findNextUnreviewed: (idx) => flags.findIndex(
      (f, i) => i > idx && (f.reviewStatus === 'unreviewed' || !f.reviewStatus)
    ),
    enableHelpModal: true,
    itemLabel: 'flag',
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: flags.map((f) => ({ id: f.id })),
    cardRefs,
    setFocusedIndex,
    itemType: 'flag',
  });

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ReviewProgress counts={counts} />

      {/* Filters */}
      <ReviewFilters
        categories={categories}
        className="mb-2"
      />

      {/* Keyboard help modal */}
      <KeyboardHelpModal
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
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
              state={state}
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
