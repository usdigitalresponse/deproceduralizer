'use client';

import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';

interface UseQueueNavigationOptions<T> {
  /** Array of items in the queue */
  items: T[];
  /** Function to get item ID for comparison */
  getItemId: (item: T) => string;
  /** Callback when viewing regulation is triggered (v key) */
  onViewRegulation?: (item: T) => void;
  /** Find next unreviewed item (n key) - return index or -1 */
  findNextUnreviewed?: (currentIndex: number) => number;
}

/**
 * Shared hook for queue keyboard navigation.
 * Handles j/k navigation, focus management, and scroll-to-card.
 *
 * @example
 * const { focusedIndex, cardRefs, handleKeyDown } = useQueueNavigation({
 *   items: flags,
 *   getItemId: (f) => `flag-${f.id}`,
 *   onViewRegulation: (f) => setSelectedRegulationId(f.regulation.id),
 *   findNextUnreviewed: (idx) => flags.findIndex((f, i) => i > idx && !f.reviewStatus),
 * });
 *
 * // Attach to window
 * useEffect(() => {
 *   window.addEventListener('keydown', handleKeyDown);
 *   return () => window.removeEventListener('keydown', handleKeyDown);
 * }, [handleKeyDown]);
 */
export function useQueueNavigation<T>({
  items,
  getItemId,
  onViewRegulation,
  findNextUnreviewed,
}: UseQueueNavigationOptions<T>) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Navigate up/down
  const navigate = useCallback((direction: 'up' | 'down') => {
    setFocusedIndex((prev) => {
      const newIndex = direction === 'down'
        ? Math.min(prev + 1, items.length - 1)
        : Math.max(prev - 1, 0);

      cardRefs.current[newIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      return newIndex;
    });
  }, [items.length]);

  // Go to next unreviewed
  const goToNextUnreviewed = useCallback(() => {
    if (!findNextUnreviewed) return;

    const nextIndex = findNextUnreviewed(focusedIndex);
    if (nextIndex !== -1) {
      setFocusedIndex(nextIndex);
      cardRefs.current[nextIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [focusedIndex, findNextUnreviewed]);

  // Go to specific index
  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setFocusedIndex(index);
      cardRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [items.length]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        navigate('down');
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        navigate('up');
        break;
      case 'n':
        e.preventDefault();
        goToNextUnreviewed();
        break;
      case 'v':
        if (items[focusedIndex] && onViewRegulation) {
          e.preventDefault();
          onViewRegulation(items[focusedIndex]);
        }
        break;
    }
  }, [items, focusedIndex, navigate, goToNextUnreviewed, onViewRegulation]);

  // Provide ref setter
  const setCardRef = useCallback((index: number, el: HTMLDivElement | null) => {
    cardRefs.current[index] = el;
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    cardRefs,
    setCardRef,
    navigate,
    goToNextUnreviewed,
    goToIndex,
    handleKeyDown,
    currentItem: items[focusedIndex] ?? null,
  };
}

export default useQueueNavigation;
