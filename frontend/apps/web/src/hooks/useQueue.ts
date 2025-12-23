'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getStateFromPathname } from './useStateFromPath';

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
  /** Optional: custom path for pagination (defaults to current pathname) */
  paginationPath?: string;
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
  paginationPath,
}: UseQueueConfig<TItem, TCounts>): UseQueueReturn<TItem, TCounts> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname
  const state = getStateFromPathname(pathname);

  // Local state for optimistic updates
  const [items, setItems] = useState<TItem[]>(initialItems);
  const [counts, setCounts] = useState<TCounts>(initialCounts);

  // Modal state
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Sync with server data when props change
  useEffect(() => {
    setItems(initialItems);
    setCounts(initialCounts);
  }, [initialItems, initialCounts]);

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
        }
      }

      return prevItems.map((item) =>
        getItemId(item) === updatedId ? updatedItem : item
      );
    });
  }, [getItemId, getItemStatus, defaultStatus]);

  // Pagination helper
  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    const basePath = paginationPath || pathname;
    router.push(`${basePath}?${params.toString()}`);
  }, [router, pathname, searchParams, paginationPath]);

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
