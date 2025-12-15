'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { STATE_STORAGE_KEY, DEFAULT_STATE, isValidState } from '@/types/state';

/**
 * Root page that redirects to the user's last selected state.
 * Uses localStorage to remember the user's preference.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Get saved state from localStorage, or use default
    const savedState = typeof window !== 'undefined'
      ? localStorage.getItem(STATE_STORAGE_KEY)
      : null;

    const targetState = savedState && isValidState(savedState)
      ? savedState
      : DEFAULT_STATE;

    // Redirect to state-specific home
    router.replace(`/${targetState}`);
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
      <svg
        className="animate-spin mr-3 h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      Loading...
    </div>
  );
}
