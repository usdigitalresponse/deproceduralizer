'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'reviewerName';

export function useReviewerName() {
  const [reviewerName, setReviewerName] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setReviewerName(stored);
    }
    setIsLoaded(true);
  }, []);

  const saveReviewerName = (name: string) => {
    localStorage.setItem(STORAGE_KEY, name);
    setReviewerName(name);
  };

  return { reviewerName, saveReviewerName, isLoaded };
}
