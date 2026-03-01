'use client';

import { usePathname } from 'next/navigation';
import { type JurisdictionCode, DEFAULT_JURISDICTION } from '@/types/state';

/**
 * Extract jurisdiction code from the current URL pathname
 * e.g., /ny/browse -> 'ny', /nj/review -> 'nj'
 *
 * @param defaultJurisdiction - Fallback jurisdiction if none found in path (default: DEFAULT_JURISDICTION)
 * @returns The jurisdiction code from the URL path
 */
export function useJurisdictionFromPath(defaultJurisdiction: JurisdictionCode = DEFAULT_JURISDICTION): JurisdictionCode {
  const pathname = usePathname();
  const match = pathname.match(/^\/(nyc|ny|nj)/);
  return (match?.[1] as JurisdictionCode) || defaultJurisdiction;
}

/**
 * Pure function version for non-hook contexts
 * Useful when you already have the pathname from usePathname()
 */
export function getJurisdictionFromPathname(pathname: string, defaultJurisdiction: JurisdictionCode = DEFAULT_JURISDICTION): JurisdictionCode {
  const match = pathname.match(/^\/(nyc|ny|nj)/);
  return (match?.[1] as JurisdictionCode) || defaultJurisdiction;
}
