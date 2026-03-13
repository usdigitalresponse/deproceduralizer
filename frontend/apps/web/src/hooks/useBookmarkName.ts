'use client';

import { useLocalStorageName } from './useLocalStorageName';

const STORAGE_KEY = 'bookmarkName';

/**
 * Hook for managing the bookmarker's name in localStorage.
 * Returns empty string until client-side hydration completes.
 */
export function useBookmarkName() {
  const { name, saveName, isLoaded } = useLocalStorageName({ key: STORAGE_KEY });

  return {
    bookmarkName: name,
    saveBookmarkName: saveName,
    isLoaded,
  };
}
