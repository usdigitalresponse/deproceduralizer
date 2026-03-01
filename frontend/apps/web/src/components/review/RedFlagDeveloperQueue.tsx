'use client';

import { useMemo } from 'react';
import type { RedFlagWithContext } from '@deproceduralizer/database';
import type { DeveloperItem, CombinedDeveloperStatusCounts } from '@/lib/actions/developer';
import { DeveloperProgress } from './DeveloperProgress';
import { RedFlagDeveloperFilters } from './RedFlagDeveloperFilters';
import { DeveloperCard } from './DeveloperCard';
import { ExcludedSectionsList } from './ExcludedSectionsList';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination
} from './shared';
import { useDeepLink, useQueueNavigation, useQueue, type PaginationInfo } from '@/hooks';
import { useQueryState } from 'nuqs';
import { developerStatusParser } from '@/lib/url/parsers';

interface RedFlagDeveloperQueueProps {
  initialItems: RedFlagWithContext[];
  pagination: PaginationInfo;
  statusCounts: CombinedDeveloperStatusCounts;
  categories: string[];
}

/**
 * Convert RedFlagWithContext to DeveloperItem format for reusing DeveloperCard
 */
function toDeveloperItem(flag: RedFlagWithContext): DeveloperItem {
  return {
    id: flag.id,
    type: 'red_flag' as const,
    reviewStatus: flag.reviewStatus,
    reviewedBy: flag.reviewedBy,
    reviewedAt: flag.reviewedAt,
    justificationNotes: flag.justificationNotes,
    teamNotes: flag.teamNotes,
    developerStatus: flag.developerStatus,
    developerAssigned: flag.developerAssigned,
    developerNotes: flag.developerNotes,
    resolutionType: flag.resolutionType,
    resolutionComments: flag.resolutionComments,
    developerQuestion: flag.developerQuestion,
    developerCheckedAt: flag.developerCheckedAt,
    regulation: {
      id: flag.regulation.id,
      title: flag.regulation.title,
      url: flag.regulation.url,
    },
    redFlagData: flag,
  };
}

export function RedFlagDeveloperQueue({
  initialItems,
  pagination,
  statusCounts,
  categories,
}: RedFlagDeveloperQueueProps) {
  // Read current developer status filter from URL for filter-aware item removal
  const [developerStatus] = useQueryState('developerStatus', developerStatusParser);

  // Convert to DeveloperItem format - memoize to prevent infinite re-renders
  const initialDeveloperItems = useMemo(
    () => initialItems.map(toDeveloperItem),
    [initialItems]
  );

  // Use generic queue hook for state management
  const {
    items,
    counts,
    selectedRegulationId,
    jurisdiction: state,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated,
    goToPage,
  } = useQueue<DeveloperItem, CombinedDeveloperStatusCounts>({
    initialItems: initialDeveloperItems,
    initialCounts: statusCounts,
    getItemId: (i) => `${i.type}-${i.id}`,
    getItemStatus: (i) => i.developerStatus || 'unresolved',
    defaultStatus: 'unresolved',
    getRegulationId: (i) => i.regulation.id,
    statusFilter: developerStatus || 'all',
  });

  // Keyboard navigation hook (auto-attaches listener)
  const {
    focusedIndex,
    setFocusedIndex,
    setCardRef,
    cardRefs,
  } = useQueueNavigation({
    items: items,
    getItemId: (i) => `${i.type}-${i.id}`,
    onViewRegulation: (i) => setSelectedRegulationId(i.regulation.id),
    itemLabel: 'flag',
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: items.map((i) => ({ id: i.id, type: i.type })),
    cardRefs,
    setFocusedIndex,
  });

  return (
    <div className="space-y-6">
      {/* Excluded Sections - collapsible */}
      <ExcludedSectionsList />

      {/* Progress */}
      <DeveloperProgress counts={counts} />

      {/* Filters */}
      <RedFlagDeveloperFilters categories={categories} className="mb-2" />

      {/* Results info */}
      <QueueResultsInfo
        startItem={items.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
        endItem={Math.min(pagination.page * pagination.pageSize, pagination.total)}
        total={pagination.total}
        itemLabel="red flags"
        keyboardHintText="Use j/k to navigate"
      />

      {/* Item cards */}
      {items.length === 0 ? (
        <QueueEmptyState
          title="No reviewed red flags found"
          description="Red flags will appear here after they have been reviewed in Review Mode."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <DeveloperCard
              key={`${item.type}-${item.id}`}
              ref={(el) => setCardRef(index, el)}
              item={item}
              onUpdated={handleItemUpdated}
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

export default RedFlagDeveloperQueue;
