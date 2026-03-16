'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Hook for navigating from chart click events to filtered views.
 * Returns a function that navigates to the target path with query params.
 *
 * @example
 * ```tsx
 * const navigate = useChartNavigation('/ny/ibr');
 * // In chart onClick:
 * navigate({ tab: 'browse', organization: 'ASTM' });
 * ```
 */
export function useChartNavigation(targetPath: string) {
  const router = useRouter();

  return useCallback(
    (params: Record<string, string>) => {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value) searchParams.set(key, value);
      }
      const qs = searchParams.toString();
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [router, targetPath]
  );
}
