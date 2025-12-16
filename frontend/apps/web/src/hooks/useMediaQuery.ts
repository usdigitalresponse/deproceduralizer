'use client';

import { useState, useEffect } from 'react';

/**
 * SSR-safe hook to detect media query matches.
 * Returns false during SSR and first render to avoid hydration mismatch.
 *
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // Set initial value after mount
    setMatches(mediaQuery.matches);

    // Listen for changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Tailwind breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Hook to get responsive state based on Tailwind breakpoints.
 * Returns object with boolean flags for each breakpoint category.
 *
 * Note: During SSR, all values default to desktop (largest) to avoid layout shift.
 * The actual values are set after hydration.
 */
export function useResponsive() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
  const isTablet = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`);
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);

  return {
    isMobile,  // < 768px
    isTablet,  // 768px - 1023px
    isDesktop, // >= 1024px
    // Convenience helpers
    isMobileOrTablet: isMobile || isTablet,
    isTabletOrDesktop: isTablet || isDesktop,
  };
}

/**
 * Hook to check if a specific Tailwind breakpoint is active (min-width).
 *
 * @param breakpoint - Tailwind breakpoint name
 * @returns boolean indicating if viewport is at or above the breakpoint
 */
export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}
