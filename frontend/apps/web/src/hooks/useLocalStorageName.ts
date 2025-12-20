'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseLocalStorageNameOptions<T extends string> {
  /** localStorage key */
  key: string;
  /** Optional validation function - if provided, only valid values are loaded */
  validate?: (value: string) => value is T;
}

interface UseLocalStorageNameReturn<T extends string> {
  /** Current name value (empty string if not set) */
  name: T | '';
  /** Save a new name to localStorage and state */
  saveName: (name: T) => void;
  /** Whether the initial load from localStorage has completed */
  isLoaded: boolean;
}

/**
 * Generic hook for managing a name stored in localStorage.
 * Handles hydration safely (returns empty until client-side load completes).
 *
 * @example
 * // Simple usage (any string)
 * const { name, saveName, isLoaded } = useLocalStorageName({ key: 'reviewerName' });
 *
 * @example
 * // With validation (typed values only)
 * const { name, saveName, isLoaded } = useLocalStorageName({
 *   key: 'developerName',
 *   validate: (v): v is 'Michael' | 'Abigail' => v === 'Michael' || v === 'Abigail'
 * });
 */
export function useLocalStorageName<T extends string = string>(
  options: UseLocalStorageNameOptions<T>
): UseLocalStorageNameReturn<T> {
  const { key, validate } = options;
  const [name, setName] = useState<T | ''>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) {
      // If validation provided, only set if valid
      if (validate) {
        if (validate(stored)) {
          setName(stored);
        }
      } else {
        // No validation - accept any string
        setName(stored as T);
      }
    }
    setIsLoaded(true);
  }, [key, validate]);

  const saveName = useCallback((newName: T) => {
    localStorage.setItem(key, newName);
    setName(newName);
  }, [key]);

  return { name, saveName, isLoaded };
}
