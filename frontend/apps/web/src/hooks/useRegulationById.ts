'use client';

import { useState, useEffect } from 'react';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { getRegulationById } from '@/lib/actions/regulations';

export function useRegulationById(regulationId: number | null) {
  const [regulation, setRegulation] = useState<RegulationWithAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (regulationId === null) {
      setRegulation(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getRegulationById(regulationId)
      .then((result) => {
        if (!result.success) {
          setError(result.error);
          setRegulation(null);
        } else {
          setRegulation(result.data);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load regulation');
        setRegulation(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [regulationId]);

  return { regulation, setRegulation, isLoading, error };
}
