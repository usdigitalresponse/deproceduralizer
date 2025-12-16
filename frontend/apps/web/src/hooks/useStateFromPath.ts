'use client';

import { usePathname } from 'next/navigation';
import type { StateCode } from '@deproceduralizer/database';

/**
 * Extract state code from the current URL pathname
 * e.g., /ny/browse -> 'ny', /nj/review -> 'nj'
 *
 * @param defaultState - Fallback state if none found in path (default: 'ny')
 * @returns The state code from the URL path
 */
export function useStateFromPath(defaultState: StateCode = 'ny'): StateCode {
  const pathname = usePathname();
  const match = pathname.match(/^\/(ny|nj)/);
  return (match?.[1] as StateCode) || defaultState;
}

/**
 * Pure function version for non-hook contexts
 * Useful when you already have the pathname from usePathname()
 */
export function getStateFromPathname(pathname: string, defaultState: StateCode = 'ny'): StateCode {
  const match = pathname.match(/^\/(ny|nj)/);
  return (match?.[1] as StateCode) || defaultState;
}
