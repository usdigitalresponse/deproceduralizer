'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { DeveloperItem, NeedMoreInfoCounts } from '@/lib/actions/developer';
import { NeedMoreInfoCard } from './NeedMoreInfoCard';
import { Button, Card } from '@/components/ui';
import RegulationModal from './RegulationModal';
import { getStateFromPathname } from '@/hooks';
import { MessageCircleQuestion, User } from 'lucide-react';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname (e.g., /nj/review -> nj)
  const state = getStateFromPathname(pathname, 'nj');

  // Local state
  const [items, setItems] = useState<DeveloperItem[]>(initialItems);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Sync with server data when props change
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Handle item update
  const handleItemUpdated = useCallback((updatedItem: DeveloperItem) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.type === updatedItem.type && item.id === updatedItem.id ? updatedItem : item
      )
    );
  }, []);

  // Handle view regulation
  const handleViewRegulation = useCallback((regulationId: number) => {
    setSelectedRegulationId(regulationId);
  }, []);

  // Keyboard navigation
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

  // Separate items into owner's and others
  const ownerItems = reviewerName
    ? items.filter((item) => item.reviewedBy === reviewerName)
    : [];
  const otherItems = reviewerName
    ? items.filter((item) => item.reviewedBy !== reviewerName)
    : items;

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
            <span className="text-[var(--color-text-muted)]">Red Flags:</span>
            <span className="font-medium">{counts.flags.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Compliance Issues:</span>
            <span className="font-medium">{counts.compliance.total}</span>
          </div>
          {reviewerName && counts.combined.forReviewer > 0 && (
            <div className="flex items-center gap-2 ml-auto text-[var(--color-info)]">
              <User className="w-4 h-4" />
              <span className="font-medium">{counts.combined.forReviewer} assigned to you</span>
            </div>
          )}
        </div>
      </Card>

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

      {/* No items */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <MessageCircleQuestion className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No items need more information</p>
          <p className="text-sm">
            When developers need clarification on reviewed items, they will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Owner's items first (if any) */}
          {ownerItems.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[var(--color-info)] flex items-center gap-2">
                <User className="w-4 h-4" />
                Questions About Your Reviews ({ownerItems.length})
              </h4>
              {ownerItems.map((item, index) => (
                <NeedMoreInfoCard
                  key={`${item.type}-${item.id}`}
                  ref={(el) => { cardRefs.current[index] = el; }}
                  item={item}
                  isOwner={true}
                  onUpdated={handleItemUpdated}
                  onViewRegulation={handleViewRegulation}
                  isFocused={index === focusedIndex}
                />
              ))}
            </div>
          )}

          {/* Other items */}
          {otherItems.length > 0 && (
            <div className="space-y-4">
              {ownerItems.length > 0 && (
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Other Items ({otherItems.length})
                </h4>
              )}
              {otherItems.map((item, index) => {
                const actualIndex = ownerItems.length + index;
                return (
                  <NeedMoreInfoCard
                    key={`${item.type}-${item.id}`}
                    ref={(el) => { cardRefs.current[actualIndex] = el; }}
                    item={item}
                    isOwner={false}
                    onUpdated={handleItemUpdated}
                    onViewRegulation={handleViewRegulation}
                    isFocused={actualIndex === focusedIndex}
                  />
                );
              })}
            </div>
          )}
        </>
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

export default NeedMoreInfoQueue;
