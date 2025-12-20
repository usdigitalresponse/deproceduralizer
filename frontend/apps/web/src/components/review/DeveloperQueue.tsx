'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import { getStateFromPathname, useDeepLink, useQueueNavigation } from '@/hooks';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  // Local state for optimistic updates
  const [items, setItems] = useState<DeveloperItem[]>(initialItems);
  const [counts, setCounts] = useState<CombinedDeveloperStatusCounts>(statusCounts);

  // Modal state for viewing regulation
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Keyboard navigation hook
  const { 
    focusedIndex, 
    setFocusedIndex, 
    setCardRef, 
    handleKeyDown,
    cardRefs 
  } = useQueueNavigation({
    items: items,
    getItemId: (i) => `${i.type}-${i.id}`,
    onViewRegulation: (i) => setSelectedRegulationId(i.regulation.id),
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: items.map((i) => ({ id: i.id, type: i.type })),
    cardRefs,
    setFocusedIndex,
  });

  // Sync with server data when props change
  useEffect(() => {
    setItems(initialItems);
    setCounts(statusCounts);
  }, [initialItems, statusCounts]);

  // Handle item update (optimistic)
  const handleItemUpdated = useCallback((updatedItem: DeveloperItem) => {
    setItems((prevItems) => {
      const oldItem = prevItems.find((item) =>
        item.type === updatedItem.type && item.id === updatedItem.id
      );
      const oldStatus = oldItem?.developerStatus || 'unresolved';
      const newStatus = updatedItem.developerStatus || 'unresolved';

      // Update counts if status changed
      if (oldStatus !== newStatus) {
        setCounts((prevCounts) => {
          const newCounts = { ...prevCounts };
          // Decrement old status count
          if (oldStatus in newCounts && oldStatus !== 'total') {
            newCounts[oldStatus as keyof CombinedDeveloperStatusCounts] = Math.max(
              0,
              (newCounts[oldStatus as keyof CombinedDeveloperStatusCounts] as number) - 1
            );
          }
          // Increment new status count
          if (newStatus in newCounts && newStatus !== 'total') {
            newCounts[newStatus as keyof CombinedDeveloperStatusCounts] =
              (newCounts[newStatus as keyof CombinedDeveloperStatusCounts] as number) + 1;
          }
          return newCounts;
        });
      }

      return prevItems.map((item) =>
        item.type === updatedItem.type && item.id === updatedItem.id ? updatedItem : item
      );
    });
  }, []);

  // Handle view regulation
  const handleViewRegulation = useCallback((regulationId: number) => {
    setSelectedRegulationId(regulationId);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Pagination helpers
  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/${state}/review?${params.toString()}`);
  }, [router, searchParams, state]);

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