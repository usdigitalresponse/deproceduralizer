'use client';

import { useEffect } from 'react';

/**
 * Client component that scrolls to the element matching the URL hash on mount.
 * Needed because Next.js client-side navigation doesn't auto-scroll to hash
 * fragments for server-rendered pages.
 */
export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    // Small delay to let server-rendered content hydrate
    const timer = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
