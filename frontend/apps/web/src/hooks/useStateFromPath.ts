'use client';

import { usePathname } from 'next/navigation';
import { type StateCode, DEFAULT_STATE } from '@/types/state';

/**
 * Extract state code from the current URL pathname
 * e.g., /ny/browse -> 'ny', /nj/review -> 'nj'
 *
 * @param defaultState - Fallback state if none found in path (default: DEFAULT_STATE)
 * @returns The state code from the URL path
 */
export function useStateFromPath(defaultState: StateCode = DEFAULT_STATE): StateCode {
  const pathname = usePathname();
  const match = pathname.match(/^\/(ny|nj)/);
  return (match?.[1] as StateCode) || defaultState;
}

/**
 * Pure function version for non-hook contexts
 * Useful when you already have the pathname from usePathname()
 */
export function getStateFromPathname(pathname: string, defaultState: StateCode = DEFAULT_STATE): StateCode {
  const match = pathname.match(/^\/(ny|nj)/);
  return (match?.[1] as StateCode) || defaultState;
}
