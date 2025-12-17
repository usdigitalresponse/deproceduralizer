'use client';

import { useState, useEffect } from 'react';
import type { DeveloperValue } from '@/types/regulation';

const STORAGE_KEY = 'developerName';

export function useDeveloperName() {
  const [developerName, setDeveloperName] = useState<DeveloperValue | ''>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as DeveloperValue | null;
    if (stored === 'Michael' || stored === 'Abigail') {
      setDeveloperName(stored);
    }
    setIsLoaded(true);
  }, []);

  const saveDeveloperName = (name: DeveloperValue) => {
    localStorage.setItem(STORAGE_KEY, name);
    setDeveloperName(name);
  };

  return { developerName, saveDeveloperName, isLoaded };
}
