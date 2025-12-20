'use client';

import { useLocalStorageName } from './useLocalStorageName';

const STORAGE_KEY = 'reviewerName';

/**
 * Hook for managing the reviewer's name in localStorage.
 * Returns empty string until client-side hydration completes.
 */
export function useReviewerName() {
  const { name, saveName, isLoaded } = useLocalStorageName({ key: STORAGE_KEY });

  return {
    reviewerName: name,
    saveReviewerName: saveName,
    isLoaded,
  };
}
