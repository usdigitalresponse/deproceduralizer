'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export interface DeepLinkTarget {
  type: 'compliance';
  id: number;
}

/**
 * Parses a hash like "#compliance-456" into a DeepLinkTarget
 */
export function parseDeepLinkHash(hash: string): DeepLinkTarget | null {
  if (!hash || !hash.startsWith('#')) return null;

  const match = hash.match(/^#(compliance)-(\d+)$/);
  if (!match) return null;

  return {
    type: match[1] as 'compliance',
    id: parseInt(match[2], 10),
  };
}

interface UseDeepLinkOptions {
  /** Array of items currently on the page */
  items: Array<{ id: number; type?: 'compliance_issue' }>;
  /** Refs to card elements for scrolling */
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  /** Setter for focused index */
  setFocusedIndex: (index: number) => void;
  /** The type of items if not specified in item.type (for single-type queues) */
  itemType?: 'compliance';
}

/**
 * Hook for handling deep links to specific review items.
 *
 * On mount, checks for a hash in the URL (e.g., #flag-123).
 * If the item is in the current page, scrolls to it and focuses it.
 * If the item is not found (different page or filtered out), clears filters
 * and navigates to page 1 with the hash preserved.
 */
export function useDeepLink({
  items,
  cardRefs,
  setFocusedIndex,
  itemType,
}: UseDeepLinkOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasNavigatedRef = useRef(false);
  const hasProcessedRef = useRef(false);

  // Find item index in current items
  const findItemIndex = useCallback((target: DeepLinkTarget): number => {
    return items.findIndex((item) => {
      const currentType = item.type === 'compliance_issue' ? 'compliance' :
                          itemType;
      return currentType === target.type && item.id === target.id;
    });
  }, [items, itemType]);

  // Handle deep link on mount/hash change
  useEffect(() => {
    const hash = window.location.hash;
    const target = parseDeepLinkHash(hash);

    if (!target) return;

    const index = findItemIndex(target);

    if (index !== -1) {
      // Item found on current page - scroll to it
      setFocusedIndex(index);

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = cardRefs.current[index];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }, 100);

      hasProcessedRef.current = true;
    } else if (!hasNavigatedRef.current && !hasProcessedRef.current) {
      // Item not found - clear filters and go to page 1
      // This ensures the item will be visible (if it exists at all)
      hasNavigatedRef.current = true;

      const params = new URLSearchParams(searchParams.toString());

      // Keep mode parameter if present
      const mode = params.get('mode');
      const type = params.get('type');

      // Clear all params except mode
      const newParams = new URLSearchParams();
      if (mode) newParams.set('mode', mode);
      if (type) newParams.set('type', type);
      newParams.set('page', '1');

      // Navigate with hash preserved
      router.push(`${pathname}?${newParams.toString()}${hash}`);
    }
  }, [items, findItemIndex, setFocusedIndex, cardRefs, router, pathname, searchParams]);

  // Reset navigation flag when hash changes
  useEffect(() => {
    const handleHashChange = () => {
      hasNavigatedRef.current = false;
      hasProcessedRef.current = false;
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
}

export default useDeepLink;
