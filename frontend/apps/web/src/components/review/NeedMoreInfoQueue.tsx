'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { DeveloperItem, NeedMoreInfoCounts } from '@/lib/actions/developer';
import { NeedMoreInfoCard } from './NeedMoreInfoCard';
import { Card } from '@/components/ui';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination
} from './shared';
import { useDeepLink, useQueueNavigation, useQueue, type PaginationInfo } from '@/hooks';
import { getJurisdictionFromPathname } from '@/hooks/useStateFromPath';
import { MessageCircleQuestion, User } from 'lucide-react';

interface NeedMoreInfoQueueProps {
  initialItems: DeveloperItem[];
  pagination: PaginationInfo;
  counts: NeedMoreInfoCounts;
  reviewerName?: string;
}

export function NeedMoreInfoQueue({
  initialItems,
  pagination,
  counts,
  reviewerName,
}: NeedMoreInfoQueueProps) {
  const pathname = usePathname();
  const jurisdictionCode = getJurisdictionFromPathname(pathname);
  // Use generic queue hook for state management (no status tracking for this queue)
  const {
    items,
    selectedRegulationId,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated,
    goToPage,
  } = useQueue<DeveloperItem, NeedMoreInfoCounts>({
    initialItems,
    initialCounts: counts,
    getItemId: (i) => `${i.type}-${i.id}`,
    // No getItemStatus - this queue doesn't track status changes in counts
    getRegulationId: (i) => i.regulation.id,
  });

  // Derive a single visibleItems array so refs/indexing match render order (Phase 4.2 fix)
  const visibleItems = useMemo(() => {
    if (!reviewerName) return items;
    const ownerItems = items.filter((item) => item.reviewedBy === reviewerName);
    const otherItems = items.filter((item) => item.reviewedBy !== reviewerName);
    return [...ownerItems, ...otherItems];
  }, [items, reviewerName]);

  // Keyboard navigation hook (auto-attaches listener)
  const {
    focusedIndex,
    setFocusedIndex,
    setCardRef,
    cardRefs,
  } = useQueueNavigation({
    items: visibleItems,
    getItemId: (i) => `${i.type}-${i.id}`,
    onViewRegulation: (i) => setSelectedRegulationId(i.regulation.id),
    itemLabel: 'item',
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: visibleItems.map((i) => ({ id: i.id, type: i.type })),
    cardRefs,
    setFocusedIndex,
  });

  // Split indices for rendering sections
  const ownerCount = reviewerName ? items.filter(i => i.reviewedBy === reviewerName).length : 0;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <Card padding="md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[var(--color-info-bg)] rounded-[var(--radius-md)]">
            <MessageCircleQuestion className="w-6 h-6 text-[var(--color-info)]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              Items Needing More Information
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Developers have requested additional context for these reviewed items.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--color-info)]">
              {counts.combined.total}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Total Questions
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-[var(--color-neutral-200)] text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Compliance Issues:</span>
            <span className="font-medium">{counts.compliance.total}</span>
          </div>
        </div>
      </Card>

      {/* Results info */}
      <QueueResultsInfo
        startItem={visibleItems.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
        endItem={Math.min(pagination.page * pagination.pageSize, pagination.total)}
        total={pagination.total}
        itemLabel="items"
        keyboardHintText="Use j/k to navigate"
      />

      {/* No items */}
      {visibleItems.length === 0 ? (
        <QueueEmptyState
          title="No items need more information"
          description="When developers need clarification on reviewed items, they will appear here."
          icon={MessageCircleQuestion}
        />
      ) : (
        <>
          {/* Owner's items first (if any) */}
          {ownerCount > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[var(--color-info)] flex items-center gap-2">
                <User className="w-4 h-4" />
                Questions About Your Reviews ({ownerCount})
              </h4>
              {visibleItems.slice(0, ownerCount).map((item, index) => (
                <NeedMoreInfoCard
                  key={`${item.type}-${item.id}`}
                  ref={(el) => setCardRef(index, el)}
                  item={item}
                  isOwner={true}
                  onUpdated={handleItemUpdated}
                  onViewRegulation={handleViewRegulation}
                  isFocused={index === focusedIndex}
                  state={jurisdictionCode}
                />
              ))}
            </div>
          )}

          {/* Other items */}
          {visibleItems.length > ownerCount && (
            <div className="space-y-4">
              {ownerCount > 0 && (
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Other Items ({visibleItems.length - ownerCount})
                </h4>
              )}
              {visibleItems.slice(ownerCount).map((item, index) => {
                const actualIndex = ownerCount + index;
                return (
                  <NeedMoreInfoCard
                    key={`${item.type}-${item.id}`}
                    ref={(el) => setCardRef(actualIndex, el)}
                    item={item}
                    isOwner={false}
                    onUpdated={handleItemUpdated}
                    onViewRegulation={handleViewRegulation}
                    isFocused={actualIndex === focusedIndex}
                    state={jurisdictionCode}
                  />
                );
              })}
            </div>
          )}
        </>
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

export default NeedMoreInfoQueue;