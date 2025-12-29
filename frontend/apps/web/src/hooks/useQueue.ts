'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { getStateFromPathname } from './useStateFromPath';
import { pageParser } from '@/lib/url/parsers';

/**
 * Generic pagination info type used across all queues
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Configuration for the useQueue hook
 */
interface UseQueueConfig<TItem, TCounts> {
  /** Initial items from server */
  initialItems: TItem[];
  /** Initial status counts from server */
  initialCounts: TCounts;
  /** Extract ID from an item for comparison */
  getItemId: (item: TItem) => string | number;
  /** Get the status field from an item (for count updates) */
  getItemStatus?: (item: TItem) => string;
  /** Default status when item has no status */
  defaultStatus?: string;
  /** Get regulation ID from an item (for modal) */
  getRegulationId: (item: TItem) => number;
  /** Current status filter - items not matching will be removed after update */
  statusFilter?: string;
}

/**
 * Return type for the useQueue hook
 */
interface UseQueueReturn<TItem, TCounts> {
  /** Current items (with optimistic updates) */
  items: TItem[];
  /** Current counts (with optimistic updates) */
  counts: TCounts;
  /** Currently selected regulation ID for modal */
  selectedRegulationId: number | null;
  /** State code extracted from pathname */
  state: string;
  /** Set selected regulation ID */
  setSelectedRegulationId: (id: number | null) => void;
  /** Handle viewing a regulation (opens modal) */
  handleViewRegulation: (regulationId: number) => void;
  /** Handle item update with optimistic count adjustment */
  handleItemUpdated: (updatedItem: TItem) => void;
  /** Navigate to a page */
  goToPage: (page: number) => void;
}

/**
 * Generic hook for managing queue state, optimistic updates, and pagination.
 * Used by ReviewQueue, ComplianceReviewQueue, DeveloperQueue, and NeedMoreInfoQueue.
 */
export function useQueue<TItem, TCounts extends object>({
  initialItems,
  initialCounts,
  getItemId,
  getItemStatus,
  defaultStatus = 'unreviewed',
  getRegulationId,
  statusFilter,
}: UseQueueConfig<TItem, TCounts>): UseQueueReturn<TItem, TCounts> {
  const pathname = usePathname();
  // Use shallow: false to trigger full navigation and server re-fetch
  const [, setPage] = useQueryState('page', pageParser.withOptions({ shallow: false }));

  // Extract state from pathname
  const state = getStateFromPathname(pathname);

  // Local state for optimistic updates
  const [items, setItems] = useState<TItem[]>(initialItems);
  const [counts, setCounts] = useState<TCounts>(initialCounts);

  // Modal state
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Sync with server data when props change
  // Use stable keys to prevent infinite re-render loops from object reference changes
  const itemsKey = initialItems.length > 0
    ? initialItems.map((i) => getItemId(i)).join(',')
    : 'empty';
  const countsKey = JSON.stringify(initialCounts);

  useEffect(() => {
    setItems(initialItems);
    setCounts(initialCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, countsKey]);

  // Handle view regulation
  const handleViewRegulation = useCallback((regulationId: number) => {
    setSelectedRegulationId(regulationId);
  }, []);

  // Handle item update with optimistic count adjustment
  const handleItemUpdated = useCallback((updatedItem: TItem) => {
    setItems((prevItems) => {
      const updatedId = getItemId(updatedItem);
      const oldItem = prevItems.find((item) => getItemId(item) === updatedId);

      // Update counts if status changed and getItemStatus is provided
      if (getItemStatus && oldItem) {
        const oldStatus = getItemStatus(oldItem) || defaultStatus;
        const newStatus = getItemStatus(updatedItem) || defaultStatus;

        if (oldStatus !== newStatus) {
          setCounts((prevCounts) => {
            const newCounts = { ...prevCounts };

            // Decrement old status count
            if (oldStatus in newCounts && oldStatus !== 'total') {
              (newCounts as Record<string, number>)[oldStatus] = Math.max(
                0,
                (newCounts as Record<string, number>)[oldStatus] - 1
              );
            }

            // Increment new status count
            if (newStatus in newCounts && newStatus !== 'total') {
              (newCounts as Record<string, number>)[newStatus] =
                (newCounts as Record<string, number>)[newStatus] + 1;
            }

            return newCounts;
          });

          // Remove item if it no longer matches the filter
          if (statusFilter && statusFilter !== 'all' && newStatus !== statusFilter) {
            return prevItems.filter((item) => getItemId(item) !== updatedId);
          }
        }
      }

      return prevItems.map((item) =>
        getItemId(item) === updatedId ? updatedItem : item
      );
    });
  }, [getItemId, getItemStatus, defaultStatus, statusFilter]);

  // Pagination helper
  const goToPage = useCallback((page: number) => {
    setPage(page);
  }, [setPage]);

  return {
    items,
    counts,
    selectedRegulationId,
    state,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated,
    goToPage,
  };
}
