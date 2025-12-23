'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Shortcut definitions for keyboard help display
 */
export interface KeyboardShortcut {
  key: string;
  description: string;
}

interface UseQueueNavigationOptions<T> {
  /** Array of items in the queue */
  items: T[];
  /** Function to get item ID for comparison */
  getItemId: (item: T) => string;
  /** Callback when viewing regulation is triggered (v key) */
  onViewRegulation?: (item: T) => void;
  /** Find next unreviewed item (n key) - return index or -1 */
  findNextUnreviewed?: (currentIndex: number) => number;
  /** Custom key handler for additional shortcuts (e.g., 'x' for selection) */
  onCustomKey?: (key: string, item: T | null, index: number) => boolean;
  /** Whether to auto-attach keyboard listener (default: true) */
  autoAttach?: boolean;
  /** Enable help modal on '?' key (default: false) */
  enableHelpModal?: boolean;
  /** Item label for shortcuts (e.g., 'flag', 'issue', 'definition') */
  itemLabel?: string;
}

/**
 * Check if keyboard event target is an interactive element that should capture input
 */
function isInteractiveElement(e: KeyboardEvent): boolean {
  const target = e.target;

  // Check standard form elements
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  // Check for Radix UI dropdowns and other ARIA widgets
  if (target instanceof HTMLElement) {
    const role = target.getAttribute('role');
    if (role === 'combobox' || role === 'listbox' || role === 'option') {
      return true;
    }

    // Check if inside an open Radix Select portal
    if (
      target.closest('[data-radix-select-viewport]') ||
      target.closest('[role="listbox"]')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Shared hook for queue keyboard navigation.
 * Handles j/k navigation, focus management, scroll-to-card, and optional help modal.
 *
 * @example
 * // Basic usage with auto-attach (recommended)
 * const { focusedIndex, setCardRef, showHelp, setShowHelp, shortcuts } = useQueueNavigation({
 *   items: flags,
 *   getItemId: (f) => `flag-${f.id}`,
 *   onViewRegulation: (f) => setSelectedRegulationId(f.regulation.id),
 *   findNextUnreviewed: (idx) => flags.findIndex((f, i) => i > idx && !f.reviewStatus),
 *   enableHelpModal: true,
 *   itemLabel: 'flag',
 * });
 *
 * @example
 * // With custom key handler for selection
 * const { focusedIndex } = useQueueNavigation({
 *   items: definitions,
 *   getItemId: (d) => `def-${d.id}`,
 *   onCustomKey: (key, item, index) => {
 *     if (key === 'x' && item) {
 *       toggleSelection(item.id);
 *       return true; // handled
 *     }
 *     return false;
 *   },
 * });
 */
export function useQueueNavigation<T>({
  items,
  getItemId,
  onViewRegulation,
  findNextUnreviewed,
  onCustomKey,
  autoAttach = true,
  enableHelpModal = false,
  itemLabel = 'item',
}: UseQueueNavigationOptions<T>) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Build shortcuts list for help modal
  const shortcuts: KeyboardShortcut[] = [
    { key: 'j / ↓', description: `Next ${itemLabel}` },
    { key: 'k / ↑', description: `Previous ${itemLabel}` },
    ...(findNextUnreviewed ? [{ key: 'n', description: `Next unreviewed ${itemLabel}` }] : []),
    ...(onViewRegulation ? [{ key: 'v', description: 'View regulation' }] : []),
    ...(enableHelpModal ? [{ key: '?', description: 'Show keyboard help' }] : []),
  ];

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
    // Ignore when typing in inputs or interacting with dropdowns
    if (isInteractiveElement(e)) {
      return;
    }

    // Check custom key handler first
    if (onCustomKey) {
      const handled = onCustomKey(e.key, items[focusedIndex] ?? null, focusedIndex);
      if (handled) {
        e.preventDefault();
        return;
      }
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
        if (findNextUnreviewed) {
          e.preventDefault();
          goToNextUnreviewed();
        }
        break;
      case 'v':
        if (items[focusedIndex] && onViewRegulation) {
          e.preventDefault();
          onViewRegulation(items[focusedIndex]);
        }
        break;
      case '?':
        if (enableHelpModal) {
          e.preventDefault();
          setShowHelp(true);
        }
        break;
      case 'Escape':
        if (showHelp) {
          e.preventDefault();
          setShowHelp(false);
        }
        break;
    }
  }, [items, focusedIndex, navigate, goToNextUnreviewed, onViewRegulation, onCustomKey, findNextUnreviewed, enableHelpModal, showHelp]);

  // Auto-attach keyboard listener
  useEffect(() => {
    if (!autoAttach) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [autoAttach, handleKeyDown]);

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
    // Help modal state
    showHelp,
    setShowHelp,
    shortcuts,
  };
}

export default useQueueNavigation;
