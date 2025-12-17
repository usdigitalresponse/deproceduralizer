'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { DeveloperItem, CombinedDeveloperStatusCounts } from '@/lib/actions/developer';
import { DeveloperProgress } from './DeveloperProgress';
import { DeveloperFilters } from './DeveloperFilters';
import { DeveloperCard } from './DeveloperCard';
import { Button } from '@/components/ui/Button';
import RegulationModal from './RegulationModal';
import { getStateFromPathname } from '@/hooks';

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
  currentDeveloperStatus?: string;
  currentDeveloperAssigned?: string;
  sortBy: string;
  sortOrder: string;
}

export function DeveloperQueue({
  initialItems,
  pagination,
  statusCounts,
  currentDeveloperStatus,
  currentDeveloperAssigned,
  sortBy,
  sortOrder,
}: DeveloperQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  // Local state for optimistic updates
  const [items, setItems] = useState<DeveloperItem[]>(initialItems);
  const [counts, setCounts] = useState<CombinedDeveloperStatusCounts>(statusCounts);

  // Focused card for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Modal state for viewing regulation
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

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

  // Keyboard navigation handlers
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex = Math.min(prev + 1, items.length - 1);
          cardRefs.current[newIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          return newIndex;
        });
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex = Math.max(prev - 1, 0);
          cardRefs.current[newIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          return newIndex;
        });
        break;
      case 'v':
        if (items[focusedIndex]) {
          handleViewRegulation(items[focusedIndex].regulation.id);
        }
        break;
    }
  }, [items, focusedIndex, handleViewRegulation]);

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
      <DeveloperFilters
        currentDeveloperStatus={currentDeveloperStatus}
        currentDeveloperAssigned={currentDeveloperAssigned}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <span>
          Showing {items.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
          –{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Use <kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">j</kbd>/<kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">k</kbd> to navigate
        </span>
      </div>

      {/* Item cards */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No reviewed items found</p>
          <p className="text-sm">Items will appear here after they have been reviewed in Review Mode.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <DeveloperCard
              key={`${item.type}-${item.id}`}
              ref={(el) => { cardRefs.current[index] = el; }}
              item={item}
              onUpdated={handleItemUpdated}
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

export default DeveloperQueue;
