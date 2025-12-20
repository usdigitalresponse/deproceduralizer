'use client';

import { useLocalStorageName } from './useLocalStorageName';
import type { DeveloperValue } from '@/types/regulation';

const STORAGE_KEY = 'developerName';

// Validation function to ensure stored value is a valid developer
const validateDeveloper = (value: string): value is DeveloperValue =>
  value === 'Michael' || value === 'Abigail';

/**
 * Hook for managing the developer's name in localStorage.
 * Only accepts valid developer values ('Michael' or 'Abigail').
 * Returns empty string until client-side hydration completes.
 */
export function useDeveloperName() {
  const { name, saveName, isLoaded } = useLocalStorageName<DeveloperValue>({
    key: STORAGE_KEY,
    validate: validateDeveloper,
  });

  return {
    developerName: name,
    saveDeveloperName: saveName,
    isLoaded,
  };
}
