import { useMemo } from 'react';

/**
 * Count how many filter keys have non-null, non-undefined values.
 * Use to compute badge counts for TieredFilterBar's advancedCount prop.
 */
export function useActiveFilterCount(
  filters: Record<string, unknown>,
  keys: string[],
): number {
  return useMemo(
    () => keys.filter(k => filters[k] !== null && filters[k] !== undefined).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, ...keys]
  );
}
