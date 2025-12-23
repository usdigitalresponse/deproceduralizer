'use client';

import type { DeveloperItem, CombinedDeveloperStatusCounts } from '@/lib/actions/developer';
import { DeveloperProgress } from './DeveloperProgress';
import { DeveloperFilters } from './DeveloperFilters';
import { DeveloperCard } from './DeveloperCard';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination
} from './shared';
import { useDeepLink, useQueueNavigation, useQueue, type PaginationInfo } from '@/hooks';

interface DeveloperQueueProps {
  initialItems: DeveloperItem[];
  pagination: PaginationInfo;
  statusCounts: CombinedDeveloperStatusCounts;
}

export function DeveloperQueue({
  initialItems,
  pagination,
  statusCounts,
}: DeveloperQueueProps) {
  // Use generic queue hook for state management
  const {
    items,
    counts,
    selectedRegulationId,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated,
    goToPage,
  } = useQueue<DeveloperItem, CombinedDeveloperStatusCounts>({
    initialItems,
    initialCounts: statusCounts,
    getItemId: (i) => `${i.type}-${i.id}`,
    getItemStatus: (i) => i.developerStatus || 'unresolved',
    defaultStatus: 'unresolved',
    getRegulationId: (i) => i.regulation.id,
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
    itemLabel: 'item',
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: items.map((i) => ({ id: i.id, type: i.type })),
    cardRefs,
    setFocusedIndex,
  });

  return (
    <div className="space-y-6">
      {/* Progress */}
      <DeveloperProgress counts={counts} />

      {/* Filters */}
      <DeveloperFilters className="mb-2" />

      {/* Results info */}
      <QueueResultsInfo
        startItem={items.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
        endItem={Math.min(pagination.page * pagination.pageSize, pagination.total)}
        total={pagination.total}
        itemLabel="items"
        keyboardHintText="Use j/k to navigate"
      />

      {/* Item cards */}
      {items.length === 0 ? (
        <QueueEmptyState 
          title="No reviewed items found" 
          description="Items will appear here after they have been reviewed in Review Mode." 
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

export default DeveloperQueue;