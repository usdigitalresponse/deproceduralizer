'use client';

import { useState, useEffect } from 'react';
import type { ReviewMode } from '@/types/regulation';

const STORAGE_KEY = 'reviewMode';

export function useReviewMode() {
  const [mode, setMode] = useState<ReviewMode>('review');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'developer' || stored === 'review') {
      setMode(stored);
    }
    setIsLoaded(true);
  }, []);

  const setReviewMode = (newMode: ReviewMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setMode(newMode);
  };

  return { mode, setReviewMode, isLoaded, isDeveloperMode: mode === 'developer' };
}
